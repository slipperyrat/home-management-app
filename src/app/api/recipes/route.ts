import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createRecipeInputSchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 GET: Fetching recipes for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();
      
      // Get all recipes for the household (shared between members)
      const { data: recipes, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching recipes:', error);
        return createErrorResponse('Failed to fetch recipes', 500, error.message);
      }

      // Transform recipes to match frontend expectations
      const transformedRecipes = recipes?.map(recipe => ({
        id: recipe.id,
        name: recipe.title, // Map 'title' to 'name' for frontend compatibility
        description: recipe.description,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        created_at: recipe.created_at,
        updated_at: recipe.updated_at,
        household_id: recipe.household_id,
        created_by: recipe.created_by,
        tags: recipe.tags || [],
        image_url: recipe.image_url,
        is_favorite: false, // TODO: Implement favorites system
        difficulty: 'medium', // TODO: Implement difficulty calculation
        created_by_user: {
          email: 'Unknown',
          first_name: 'Unknown',
          last_name: 'User'
        }
      })) || [];

      return createSuccessResponse({ recipes: transformedRecipes }, 'Recipes fetched successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/recipes', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 POST: Creating recipe for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Parse and validate request body using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        console.log('Request body:', body);
        
        validatedData = createRecipeInputSchema.parse(body);
      } catch (validationError: any) {
        console.log('Validation failed:', validationError.errors);
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      // Parse ingredients from text to structured format
      const parsedIngredients = parseIngredients(validatedData.ingredients);
      
      // Parse instructions from text to array
      const parsedInstructions = parseInstructions(validatedData.instructions);

      const supabase = getDatabaseClient();

      // Create the recipe in the database with validated data
      const { data: recipe, error: insertError } = await supabase
        .from('recipes')
        .insert([{
          household_id: household.id,
          title: validatedData.title,
          description: validatedData.description || '',
          ingredients: parsedIngredients, // JSONB array
          instructions: parsedInstructions, // TEXT array
          prep_time: validatedData.prep_time,
          cook_time: validatedData.cook_time,
          servings: validatedData.servings,
          tags: validatedData.tags || [],
          created_by: user.id
        }])
        .select('*')
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        return createErrorResponse('Failed to save recipe to database', 500, insertError.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'recipe.created',
        targetTable: 'recipes',
        targetId: recipe.id,
        userId: user.id,
        metadata: { 
          recipe_title: validatedData.title,
          household_id: household.id,
          ingredients_count: parsedIngredients.length
        }
      });

      console.log('Recipe created successfully:', recipe);

      return createSuccessResponse({ 
        recipe: {
          id: recipe.id,
          name: recipe.title, // Map back to 'name' for frontend compatibility
          description: recipe.description,
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_time,
          servings: recipe.servings,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          created_at: recipe.created_at,
          household_id: recipe.household_id,
          created_by: recipe.created_by,
          updated_at: recipe.updated_at,
          image_url: recipe.image_url,
          tags: recipe.tags || [],
          is_favorite: false, // Default value
          difficulty: 'medium' // Default value
        }
      }, 'Recipe created successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/recipes', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

// Helper function to parse ingredients text into structured format
function parseIngredients(ingredientsText: string): any[] {
  if (!ingredientsText) return [];
  
  // Split by newlines and clean up
  const lines = ingredientsText.split('\n').map(line => line.trim()).filter(Boolean);
  
  return lines.map((line, index) => {
    // Try to parse quantity and unit from the line - improved regex
    // Look for: optional number + optional unit + ingredient name
    const match = line.match(/^(\d+(?:\.\d+)?)\s+([a-zA-Z]+)\s+(.+)$/);
    
    if (match) {
      const [, amount, unit, name] = match;
      return {
        id: `temp-${index}`,
        recipe_id: '', // Will be set by database
        name: name.trim(),
        amount: parseFloat(amount),
        unit: unit.trim(),
        notes: ''
      };
    }
    
    // Try to parse just quantity + ingredient name (no unit)
    const simpleMatch = line.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (simpleMatch) {
      const [, amount, name] = simpleMatch;
      return {
        id: `temp-${index}`,
        recipe_id: '', // Will be set by database
        name: name.trim(),
        amount: parseFloat(amount),
        unit: '',
        notes: ''
      };
    }
    
    // If no quantity pattern, treat as just a name
    return {
      id: `temp-${index}`,
      recipe_id: '', // Will be set by database
      name: line.trim(),
      amount: 1,
      unit: '',
      notes: ''
    };
  });
}

// Helper function to parse instructions text into array format
function parseInstructions(instructionsText: string): string[] {
  if (!instructionsText) return [];
  
  // Split by newlines and clean up
  return instructionsText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, _index) => {
      // Remove step numbers if they exist (e.g., "1. ", "Step 1: ")
      const cleaned = line.replace(/^(\d+\.?\s*|Step\s*\d+:\s*)/i, '').trim();
      return cleaned || line; // If cleaning results in empty string, use original
    });
}
