import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { mealPlannerAssignSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';
import type { Database, Json } from '@/types/supabase.generated';
import { z } from 'zod';

type MealPlanRow = Database['public']['Tables']['meal_plans']['Row'];
type MealPlanInsert = Database['public']['Tables']['meal_plans']['Insert'];

type MealDaySlots = {
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
};

type SerializedMeals = Record<string, MealDaySlots | null>;

type MealSlotUpdate = {
  breakfast?: string | null | undefined;
  lunch?: string | null | undefined;
  dinner?: string | null | undefined;
};

function mergeMeals(existing: SerializedMeals, day: string, slots: MealSlotUpdate): SerializedMeals {
  const current: MealDaySlots = existing[day] ?? { breakfast: null, lunch: null, dinner: null };
  const next: MealDaySlots = {
    breakfast: slots.breakfast ?? current.breakfast ?? null,
    lunch: slots.lunch ?? current.lunch ?? null,
    dinner: slots.dinner ?? current.dinner ?? null,
  };
  return {
    ...existing,
    [day]: next,
  };
}

function parseSerializedMeals(meals: MealPlanRow['meals']): SerializedMeals {
  if (!meals || typeof meals !== 'object') {
    return {};
  }
  return Object.entries(meals as Record<string, unknown>).reduce<SerializedMeals>((acc, [day, value]) => {
    if (value && typeof value === 'object') {
      const entry = value as MealDaySlots;
      acc[day] = {
        breakfast: entry.breakfast ?? null,
        lunch: entry.lunch ?? null,
        dinner: entry.dinner ?? null,
      };
    } else {
      acc[day] = null;
    }
    return acc;
  }, {});
}

function toJsonMeals(meals: SerializedMeals): Json {
  return meals as unknown as Json;
}

export async function POST(req: NextRequest) {
  return withAPISecurity(req, async (request, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

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

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { week, day, slots, notes, alsoAddToList, autoConfirm } = validatedData;
      const supabase = getDatabaseClient();

      const { data: existing, error: selErr } = await supabase
        .from('meal_plans')
        .select('id, meals')
        .eq('household_id', household.id)
        .eq('week_start_date', week)
        .maybeSingle<Pick<MealPlanRow, 'id' | 'meals'>>();

      if (selErr) {
        return createErrorResponse('Failed to fetch meal plan', 500, selErr.message);
      }

      const existingMeals = parseSerializedMeals(existing?.meals ?? null);
      const updatedMeals = mergeMeals(existingMeals, day, slots);

      const upsertPayload: MealPlanInsert = {
        household_id: household.id,
        week_start_date: week,
        meals: toJsonMeals(updatedMeals),
      };

      if (existing?.id) {
        upsertPayload.id = existing.id;
      }

      const { data: plan, error: upErr } = await supabase
        .from('meal_plans')
        .upsert(upsertPayload, { onConflict: 'household_id,week_start_date' })
        .select('*')
        .maybeSingle<MealPlanRow>();

      if (upErr || !plan) {
        return createErrorResponse('Failed to update meal plan', 500, upErr?.message ?? 'Upsert failed');
      }

      let ingredientResult: {
        ok: boolean;
        added: number;
        updated: number;
        autoAdded?: number;
        pendingConfirmations?: number;
        error?: string;
      } | null = null;

      if (alsoAddToList && Object.values(slots).some((slotId) => typeof slotId === 'string' && slotId.trim() !== '')) {
        const { addRecipeIngredientsToGroceriesAuto } = await import('@/lib/server/addRecipeIngredientsAuto');

        for (const [slotKey, recipeId] of Object.entries(slots)) {
          if (typeof recipeId !== 'string' || recipeId.trim() === '') {
            continue;
          }

          ingredientResult = await addRecipeIngredientsToGroceriesAuto(
            user.id,
            household.id,
            recipeId,
            autoConfirm ?? false,
            { week, day, slot: slotKey },
          );

          if (!ingredientResult.ok) {
            logger.warn('Meal assigned but failed to add ingredients automatically', {
              userId: user.id,
              householdId: household.id,
              recipeId,
              error: ingredientResult.error,
            });
            return createErrorResponse('Assigned but failed to add ingredients', 207, ingredientResult.error);
          }
        }
      }

      await createAuditLog({
        action: 'meal_plan.assigned',
        targetTable: 'meal_plans',
        targetId: plan.id,
        userId: user.id,
        metadata: {
          week_start_date: week,
          day,
          slots,
          notes: notes ?? null,
          household_id: household.id,
        },
      });

      return createSuccessResponse({
        plan,
        ingredients: ingredientResult
          ? {
              added: ingredientResult.added,
              updated: ingredientResult.updated,
              autoAdded: ingredientResult.autoAdded ?? 0,
              pendingConfirmations: ingredientResult.pendingConfirmations ?? 0,
            }
          : null,
      }, 'Meal assigned successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/meal-planner/assign', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
  });
}
