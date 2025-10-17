import { NextResponse } from 'next/server';
import { getUserAndHousehold } from '@/lib/server/supabaseAdmin';
import { addRecipeIngredientsToGroceriesAuto } from '@/lib/server/addRecipeIngredientsAuto';
import { addRecipeIngredientsAutoSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const { userId, householdId } = await getUserAndHousehold();

    if (!userId || !householdId) {
      return NextResponse.json({ error: 'User or household not found' }, { status: 401 });
    }

    const tempSchema = addRecipeIngredientsAutoSchema.omit({ household_id: true });
    let validatedData: z.infer<typeof tempSchema>;
    try {
      const body = await req.json();
      validatedData = tempSchema.parse(body);
    } catch (validationError: unknown) {
      if (validationError instanceof z.ZodError) {
        logger.warn('Invalid add-recipe-ingredients-auto payload', {
          userId,
          errors: validationError.errors,
        });
        return NextResponse.json({
          error: 'Invalid input',
          details: validationError.errors,
        }, { status: 400 });
      }
      logger.error('add-recipe-ingredients-auto validation error', validationError instanceof Error ? validationError : new Error(String(validationError)), {
        userId,
      });
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { recipe_id, auto_confirm, source_meal_plan } = validatedData;
    if (!recipe_id) {
      return NextResponse.json({ error: 'recipe_id required' }, { status: 400 });
    }

    const result = await addRecipeIngredientsToGroceriesAuto(
      userId,
      householdId,
      recipe_id,
      auto_confirm ?? false,
      source_meal_plan
    );

    if (!result.ok) {
      logger.error('addRecipeIngredientsToGroceriesAuto failed', new Error(result.error ?? 'Unknown error'), {
        userId,
        householdId,
        recipeId: recipe_id,
      });
      return NextResponse.json({ error: result.error ?? 'Failed to add ingredients' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      added: result.added,
      updated: result.updated,
      pending: result.pending,
      listId: result.listId ?? undefined,
    });
  } catch (error) {
    logger.error('Error in add-recipe-ingredients-auto API', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/shopping-lists/add-recipe-ingredients-auto',
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: error instanceof Error && 'status' in error ? Number((error as { status?: number }).status) || 500 : 500 });
  }
}
