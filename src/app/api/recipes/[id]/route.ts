import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createRecipeSchema } from '@/lib/validation/schemas';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { id: recipeId } = await params;

      if (!recipeId) {
        return createErrorResponse('Recipe ID is required', 400);
      }

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      // First, verify the recipe belongs to the user's household
      const { data: existingRecipe, error: fetchError } = await supabase
        .from('recipes')
        .select('id, household_id, title')
        .eq('id', recipeId)
        .eq('household_id', household.id)
        .single();

      if (fetchError || !existingRecipe) {
        return createErrorResponse('Recipe not found or access denied', 404);
      }

      // Delete the recipe
      const { error: deleteError } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)
        .eq('household_id', household.id);

      if (deleteError) {
        console.error('Error deleting recipe:', deleteError);
        return createErrorResponse('Failed to delete recipe', 500, deleteError.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'recipe.deleted',
        targetTable: 'recipes',
        targetId: recipeId,
        userId: user.id,
        metadata: { 
          recipe_title: existingRecipe.title,
          household_id: household.id
        }
      });

      return createSuccessResponse({}, 'Recipe deleted successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/recipes/[id]', method: 'DELETE', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { id: recipeId } = await params;

      if (!recipeId) {
        return createErrorResponse('Recipe ID is required', 400);
      }

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
        
        const tempSchema = createRecipeSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
      } catch (validationError: any) {
        console.log('Validation failed:', validationError.errors);
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      const supabase = getDatabaseClient();

      // First, verify the recipe belongs to the user's household
      const { data: existingRecipe, error: fetchError } = await supabase
        .from('recipes')
        .select('id, household_id, title')
        .eq('id', recipeId)
        .eq('household_id', household.id)
        .single();

      if (fetchError || !existingRecipe) {
        return createErrorResponse('Recipe not found or access denied', 404);
      }

      // Parse ingredients from text to structured format
      const parsedIngredients = parseIngredients(validatedData.ingredients);
      
      // Parse instructions from text to array
      const parsedInstructions = parseInstructions(validatedData.instructions);

      // Update the recipe in the database with validated data
      const { data: recipe, error: updateError } = await supabase
        .from('recipes')
        .update({
          title: validatedData.title,
          description: validatedData.description || '',
          ingredients: parsedIngredients, // JSONB array
          instructions: parsedInstructions, // TEXT array
          prep_time: validatedData.prep_time,
          cook_time: validatedData.cook_time,
          servings: validatedData.servings,
          tags: validatedData.tags || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', recipeId)
        .eq('household_id', household.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Database update error:', updateError);
        return createErrorResponse('Failed to update recipe in database', 500, updateError.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'recipe.updated',
        targetTable: 'recipes',
        targetId: recipeId,
        userId: user.id,
        metadata: { 
          recipe_title: validatedData.title,
          household_id: household.id,
          ingredients_count: parsedIngredients.length
        }
      });

      console.log('Recipe updated successfully:', recipe);

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
      }, 'Recipe updated successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/recipes/[id]', method: 'PUT', userId: user.id });
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
  
  // Split by newlines or commas and clean up
  const lines = ingredientsText.split(/[\n,]+/).map(line => line.trim()).filter(Boolean);
  
  return lines.map((line, index) => {
    // Try to parse quantity and unit from the line
    const match = line.match(/^(\d+(?:\.\d+)?)?\s*([a-zA-Z]+)?\s*(.+)$/);
    
    if (match) {
      const [, amount, unit, name] = match;
      return {
        id: `temp-${index}`,
        recipe_id: '', // Will be set by database
        name: (name || line).trim(), // Fallback to full line if name is undefined
        amount: amount ? parseFloat(amount) : 1,
        unit: unit ? unit.trim() : '',
        notes: ''
      };
    }
    
    // If no quantity/unit pattern, treat as just a name
    return {
      id: `temp-${index}`,
      recipe_id: '', // Will be set by database
      name: line,
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
