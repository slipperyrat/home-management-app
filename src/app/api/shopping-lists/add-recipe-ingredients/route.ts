import { NextResponse } from 'next/server';
import { getUserAndHousehold } from '@/lib/server/supabaseAdmin';
import { addRecipeIngredientsToGroceries } from '@/lib/server/addRecipeIngredients';
import { addRecipeIngredientsSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const { userId, householdId } = await getUserAndHousehold()
    
    // Parse and validate request body using Zod schema
    const tempSchema = addRecipeIngredientsSchema.omit({ household_id: true });
    let validatedData: z.infer<typeof tempSchema>;
    try {
      const body = await req.json();
      validatedData = tempSchema.parse(body);
    } catch (validationError: unknown) {
      if (validationError instanceof z.ZodError) {
        logger.warn('Invalid add-recipe-ingredients payload', {
          userId,
          errors: validationError.errors,
        });
        return NextResponse.json({
          error: 'Invalid input',
          details: validationError.errors,
        }, { status: 400 });
      }
      logger.error('add-recipe-ingredients validation error', validationError instanceof Error ? validationError : new Error(String(validationError)), {
        userId,
      });
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { recipe_id } = validatedData;
    if (!recipe_id) {
      return NextResponse.json({ error: 'recipe_id required' }, { status: 400 });
    }

    const result = await addRecipeIngredientsToGroceries(userId, householdId, recipe_id);
    
    if (!result.ok) {
      logger.error('addRecipeIngredientsToGroceries failed', new Error(result.error ?? 'Unknown error'), {
        userId,
        householdId,
        recipeId: recipe_id,
      });
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      added: result.added, 
      updated: result.updated, 
      list_id: result.listId 
    });
  } catch (error) {
    logger.error('Error in add-recipe-ingredients API', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/shopping-lists/add-recipe-ingredients',
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: error instanceof Error && 'status' in error ? Number((error as { status?: number }).status) || 500 : 500 });
  }
}