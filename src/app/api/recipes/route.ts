import { NextRequest, NextResponse } from 'next/server';
import { sb, getUserAndHousehold, createErrorResponse, ServerError } from '@/lib/server/supabaseAdmin';
import { CreateRecipeSchema, validateRequest, createValidationErrorResponse } from '@/lib/validation';
import { sanitizeDeep, createSanitizePolicy } from '@/lib/security/sanitize';

export async function GET(request: NextRequest) {
  try {
    const { householdId } = await getUserAndHousehold();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    // Build query
    let supabaseQuery = sb()
      .from('recipes')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    // Add search filter if query provided
    if (query && query.trim()) {
      supabaseQuery = supabaseQuery.or(`name.ilike.%${query.trim()}%,description.ilike.%${query.trim()}%`);
    }

    const { data: recipes, error } = await supabaseQuery;

    if (error) {
      console.error('Error fetching recipes:', error);
      throw new ServerError('Failed to fetch recipes', 500);
    }

    return NextResponse.json({
      success: true,
      recipes: recipes || []
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    
    console.error('Unexpected error in GET /api/recipes:', error);
    return createErrorResponse(new ServerError('Internal server error'));
  }
}

export async function POST(request: NextRequest) {
  try {
    const { householdId, userId } = await getUserAndHousehold();
    const body = await request.json();

    // Sanitize input data
    const recipePolicy = createSanitizePolicy({
      title: 'text',
      description: 'rich',
      instructions: 'rich',
      image_url: 'text',
      tags: 'text',
      prep_time: 'skip',
      cook_time: 'skip',
      servings: 'skip'
    });
    
    const clean = sanitizeDeep(body, recipePolicy);
    
    // Sanitize ingredients array separately to preserve numeric amounts
    if (clean.ingredients && Array.isArray(clean.ingredients)) {
      clean.ingredients = clean.ingredients.map((ingredient: any) => {
        if (typeof ingredient === 'object' && ingredient !== null) {
          return {
            ...ingredient,
            name: typeof ingredient.name === 'string' ? sanitizeDeep(ingredient.name) : ingredient.name,
            unit: typeof ingredient.unit === 'string' ? sanitizeDeep(ingredient.unit) : ingredient.unit,
            category: typeof ingredient.category === 'string' ? sanitizeDeep(ingredient.category) : ingredient.category,
            // Preserve numeric amount as-is
            amount: ingredient.amount
          };
        }
        return ingredient;
      });
    }

    // Validate request body with Zod
    const validation = validateRequest(CreateRecipeSchema, clean);
    if (!validation.success) {
      return createValidationErrorResponse(validation.error);
    }

    const validatedData = validation.data;

    // Prepare recipe data - map to database schema
    const recipeData = {
      name: validatedData.title, // Map title to name
      description: validatedData.description || '',
      ingredients: validatedData.ingredients, // Keep as JSONB
      instructions: validatedData.instructions.map((instruction: any) => 
        typeof instruction === 'string' ? instruction : instruction.instruction
      ), // Convert to string array
      prep_time: validatedData.prep_time,
      cook_time: validatedData.cook_time,
      servings: validatedData.servings,
      difficulty: 'medium', // Default value
      household_id: householdId,
      created_by: userId
    };

    // Insert recipe
    const { data: recipe, error } = await sb()
      .from('recipes')
      .insert(recipeData)
      .select()
      .single();

    if (error) {
      console.error('Error creating recipe:', error);
      throw new ServerError('Failed to create recipe', 500);
    }

    return NextResponse.json({
      success: true,
      recipe
    }, { status: 201 });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    
    console.error('Unexpected error in POST /api/recipes:', error);
    return createErrorResponse(new ServerError('Internal server error'));
  }
}
