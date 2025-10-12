import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { mealPlannerAssignSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  return withAPISecurity(req, async (request, user) => {
    try {
      logger.info('Assigning meal slot', { userId: user.id });

      const tempSchema = mealPlannerAssignSchema.omit({ household_id: true });
      let validatedData: z.infer<typeof tempSchema>;
      try {
        const body = await request.json();
        validatedData = tempSchema.parse(body);
      } catch (validationError: unknown) {
        if (validationError instanceof z.ZodError) {
          logger.warn('Meal assignment validation failed', {
            userId: user.id,
            errors: validationError.errors,
          });
          return createErrorResponse('Invalid input', 400, validationError.errors);
        }
        logger.error('Meal assignment validation error', validationError instanceof Error ? validationError : new Error(String(validationError)), {
          userId: user.id,
        });
        return createErrorResponse('Invalid input', 400);
      }

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { week, day, slot, recipe_id, alsoAddToList, autoConfirm } = validatedData;

      // NOTE: When adding notes/comments to meal slots in the future, sanitize them here:
      // const clean = sanitizeDeep(body, { notes: 'rich' });
      // const notes = clean.notes || null;

      const supabase = getDatabaseClient();

      // fetch or create the meal_plan row
      const { data: existing, error: selErr } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('household_id', household.id)
        .eq('week_start_date', week)
        .maybeSingle();
      if (selErr) {
        return createErrorResponse('Failed to fetch meal plan', 500, selErr.message);
      }

      type MealSlotKey = 'breakfast' | 'lunch' | 'dinner';
      type MealDay = Record<MealSlotKey, string | null>;

      const meals = (existing?.meals ?? {}) as Record<string, MealDay | null>;
      const dayMeals = meals[day] ?? { breakfast: null, lunch: null, dinner: null };
      meals[day] = dayMeals;
      dayMeals[slot as MealSlotKey] = recipe_id ?? null;

      // upsert the plan
      const serialisedMeals = Object.fromEntries(
        Object.entries(meals).map(([dayKey, value]) => {
          if (value && typeof value === 'object') {
            return [dayKey, {
              breakfast: value.breakfast ?? null,
              lunch: value.lunch ?? null,
              dinner: value.dinner ?? null,
            }]
          }
          return [dayKey, value]
        })
      )

      const { data: plan, error: upErr } = await supabase
        .from('meal_plans')
        .upsert([{ household_id: household.id, week_start_date: week, meals: serialisedMeals }], { onConflict: 'household_id,week_start_date' })
        .select('*')
        .single();
      if (upErr) {
        return createErrorResponse('Failed to update meal plan', 500, upErr.message);
      }

      // optionally add ingredients to grocery list with auto-confirmation
      let ingredientResult: {
        ok: boolean;
        added: number;
        updated: number;
        autoAdded?: number;
        pendingConfirmations?: number;
        error?: string;
      } | null = null;
      if (alsoAddToList && recipe_id) {
        // Always use the enhanced auto-version for meal planner assignments
        // Default to autoConfirm: false to require confirmation
        const { addRecipeIngredientsToGroceriesAuto } = await import('@/lib/server/addRecipeIngredientsAuto');
        ingredientResult = await addRecipeIngredientsToGroceriesAuto(
          user.id,
          household.id,
          recipe_id,
          autoConfirm ?? false,
          { week, day, slot }
        );
        
        if (!ingredientResult.ok) {
          logger.warn('Meal assigned but failed to add ingredients automatically', {
            userId: user.id,
            householdId: household.id,
            recipeId: recipe_id,
            error: ingredientResult.error,
          });
          return createErrorResponse('Assigned but failed to add ingredients', 207, ingredientResult.error);
        }
      }

      // Add audit log entry
      await createAuditLog({
        action: 'meal_plan.assigned',
        targetTable: 'meal_plans',
        targetId: plan.id,
        userId: user.id,
        metadata: { 
          week_start_date: week,
          day,
          meal_type: slot,
          recipe_id,
          household_id: household.id
        }
      });

      return createSuccessResponse({ 
        plan, 
        ingredients: ingredientResult ? {
          added: ingredientResult.added,
          updated: ingredientResult.updated,
          autoAdded: ingredientResult.autoAdded || 0,
          pendingConfirmations: ingredientResult.pendingConfirmations || 0
        } : null
      }, 'Meal assigned successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/meal-planner/assign', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false, // Temporarily disable CSRF to test
    rateLimitConfig: 'api'
  });
}
