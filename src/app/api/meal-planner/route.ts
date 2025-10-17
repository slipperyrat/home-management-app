import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logging/logger';
import type { Database, Json } from '@/types/supabase.generated';
import { z } from 'zod';

interface MealSlots {
  breakfast?: string | null;
  lunch?: string | null;
  dinner?: string | null;
}

interface MealPlanPayload {
  week_start: string;
  meals: Array<{
    day: string;
    slots: MealSlots;
    notes?: string;
  }>;
}

type MealPlanRow = Database['public']['Tables']['meal_plans']['Row'];

type SerializedMeals = Record<string, {
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
} | null>;

function serializeMeals(mealPlan: MealPlanPayload['meals']): SerializedMeals {
  return mealPlan.reduce<SerializedMeals>((acc, entry) => {
    acc[entry.day] = {
      breakfast: entry.slots.breakfast ?? null,
      lunch: entry.slots.lunch ?? null,
      dinner: entry.slots.dinner ?? null,
    };
    return acc;
  }, {});
}

function toJsonMeals(meals: SerializedMeals): Json {
  return meals as unknown as Json;
}

function deserializeMeals(meals: unknown): MealPlanPayload['meals'] {
  if (!meals || typeof meals !== 'object') {
    return [];
  }

  return Object.entries(meals as Record<string, SerializedMeals[string]>).map(([day, slots]) => ({
    day,
    slots: {
      breakfast: slots?.breakfast ?? null,
      lunch: slots?.lunch ?? null,
      dinner: slots?.dinner ?? null,
    },
  }));
}

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      logger.info('Fetching meal plan', { userId: user.id });

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      const weekStartDate = searchParams.get('week_start_date');

      if (!weekStartDate) {
        return createErrorResponse('week_start_date parameter is required', 400);
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(weekStartDate)) {
        return createErrorResponse('week_start_date must be in YYYY-MM-DD format', 400);
      }

      const supabase = getDatabaseClient();
      const { data: mealPlan, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('household_id', household.id)
        .eq('week_start_date', weekStartDate)
        .maybeSingle<MealPlanRow>();

      if (error) {
        logger.error('Error fetching meal plan', error, { householdId: household.id, weekStartDate });
        return createErrorResponse('Failed to fetch meal plan', 500, error.message);
      }

      return createSuccessResponse({
        mealPlan: mealPlan
          ? {
              ...mealPlan,
              meals: deserializeMeals(mealPlan.meals),
            }
          : null,
      }, 'Meal plan fetched successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/meal-planner', method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}

export async function PUT(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      logger.info('Updating meal plan', { userId: user.id });

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      let validatedData: MealPlanPayload;
      try {
        const body = await req.json();
        const { createMealPlanSchema } = await import('@/lib/validation/schemas');
        const tempSchema = createMealPlanSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body) as unknown as MealPlanPayload;
      } catch (validationError: unknown) {
        if (validationError instanceof z.ZodError) {
          logger.warn('Meal plan update validation failed', {
            userId: user.id,
            errors: validationError.errors,
          });
          return createErrorResponse('Invalid input', 400, validationError.errors);
        }
        logger.error('Meal plan update validation error', validationError instanceof Error ? validationError : new Error(String(validationError)), {
          userId: user.id,
        });
        return createErrorResponse('Invalid input', 400);
      }

      const supabase = getDatabaseClient();
      const { data: existingPlan, error: checkError } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('household_id', household.id)
        .eq('week_start_date', validatedData.week_start)
        .maybeSingle<{ id: string }>();

      if (checkError) {
        const logError = checkError instanceof Error ? checkError : new Error('Postgrest error');
        logger.error('Error checking existing meal plan', logError, {
          householdId: household.id,
          weekStart: validatedData.week_start,
          ...(checkError && 'message' in checkError ? { error: checkError.message } : {}),
        });
        return createErrorResponse('Failed to check existing meal plan', 500, checkError && 'message' in checkError ? checkError.message : 'Failed to check existing meal plan');
      }

      const serializedMeals = serializeMeals(validatedData.meals);
      const serializedJson = toJsonMeals(serializedMeals);
      const now = new Date().toISOString();

      if (existingPlan) {
        const { data: updatedPlan, error: updateError } = await supabase
          .from('meal_plans')
          .update({
            meals: serializedJson,
            updated_at: now,
          })
          .eq('id', existingPlan.id)
          .select('*')
          .maybeSingle<MealPlanRow>();

        if (updateError || !updatedPlan) {
          const logError = updateError instanceof Error ? updateError : new Error('Postgrest error');
          logger.error('Error updating meal plan', logError, {
            householdId: household.id,
            weekStart: validatedData.week_start,
            ...(updateError && 'message' in updateError ? { error: updateError.message } : {}),
          });
          return createErrorResponse('Failed to update meal plan', 500, updateError && 'message' in updateError ? updateError.message : 'Update failed');
        }

        return createSuccessResponse({
          mealPlan: {
            ...updatedPlan,
            meals: deserializeMeals(updatedPlan.meals),
          },
        }, 'Meal plan updated successfully');
      }

      const { data: newPlan, error: insertError } = await supabase
        .from('meal_plans')
        .insert({
          household_id: household.id,
          week_start_date: validatedData.week_start,
          meals: serializedJson,
          created_at: now,
          updated_at: now,
        })
        .select('*')
        .maybeSingle<MealPlanRow>();

      if (insertError || !newPlan) {
        const logError = insertError instanceof Error ? insertError : new Error('Postgrest error');
        logger.error('Error creating meal plan', logError, {
          householdId: household.id,
          weekStart: validatedData.week_start,
          ...(insertError && 'message' in insertError ? { error: insertError.message } : {}),
        });
        return createErrorResponse('Failed to create meal plan', 500, insertError && 'message' in insertError ? insertError.message : 'Insert failed');
      }

      return createSuccessResponse({
        mealPlan: {
          ...newPlan,
          meals: deserializeMeals(newPlan.meals),
        },
      }, 'Meal plan created successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/meal-planner', method: 'PUT', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}
