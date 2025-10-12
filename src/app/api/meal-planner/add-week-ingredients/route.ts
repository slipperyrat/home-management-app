import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { addRecipeIngredientsToGroceries } from '@/lib/server/addRecipeIngredients';
import { z } from 'zod';
import { logger } from '@/lib/logging/logger';

const addWeekIngredientsSchema = z.object({
  week_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = addWeekIngredientsSchema.parse(body);
    const { week_start_date } = validatedData;

    const supabase = getDatabaseClient();
    
    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get meal plan for the week
    const { data: mealPlan, error: mealPlanError } = await supabase
      .from('meal_plans')
      .select('meals')
      .eq('household_id', userData.household_id)
      .eq('week_start_date', week_start_date)
      .single();

    if (mealPlanError || !mealPlan) {
      return NextResponse.json({ error: 'No meal plan found for this week' }, { status: 404 });
    }

    // Collect all recipe IDs from the week's meals
    type MealPlanDay = {
      breakfast?: string | null;
      lunch?: string | null;
      dinner?: string | null;
    };

    const recipeIds = new Set<string>();
    const meals = (mealPlan.meals ?? {}) as Record<string, MealPlanDay | null>;

    Object.values(meals).forEach((dayMeals) => {
      if (!dayMeals) {
        return;
      }
      const { breakfast, lunch, dinner } = dayMeals;
      [breakfast, lunch, dinner].forEach((mealId) => {
        if (typeof mealId === 'string' && mealId.trim() !== '') {
          recipeIds.add(mealId);
        }
      });
    });

    if (recipeIds.size === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No recipes found in meal plan',
        totalAdded: 0,
        totalUpdated: 0,
        recipesProcessed: 0
      });
    }

    // Process each recipe's ingredients
    let totalAdded = 0;
    let totalUpdated = 0;
    let recipesProcessed = 0;
    const results: Array<{ recipeId: string; added: number; updated: number }> = [];

    for (const recipeId of recipeIds) {
      try {
        const result = await addRecipeIngredientsToGroceries(userId, userData.household_id, recipeId);
        if (result.ok) {
          totalAdded += result.added;
          totalUpdated += result.updated;
          recipesProcessed++;
          results.push({
            recipeId,
            added: result.added,
            updated: result.updated
          });
        } else {
          logger.error('Failed to add ingredients for recipe', new Error(result.error ?? 'Unknown error'), {
            recipeId,
            userId,
            householdId: userData.household_id,
          });
        }
      } catch (error) {
        logger.error(
          'Error processing recipe for meal planner add-week-ingredients',
          error instanceof Error ? error : new Error(String(error)),
          { recipeId, userId, householdId: userData.household_id },
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Added ingredients from ${recipesProcessed} recipes to your shopping list`,
      totalAdded,
      totalUpdated,
      recipesProcessed,
      results
    });

  } catch (error) {
    logger.error(
      'Error in POST /api/meal-planner/add-week-ingredients',
      error instanceof Error ? error : new Error(String(error)),
    );
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
