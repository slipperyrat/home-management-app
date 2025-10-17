import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { mealPlannerClearSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';
import type { Database, Json } from '@/types/supabase.generated';
import { z } from 'zod';

type MealPlanRow = Database['public']['Tables']['meal_plans']['Row'];

type EmptyMealDay = {
  breakfast: null;
  lunch: null;
  dinner: null;
};

const emptyMeals: Record<string, EmptyMealDay> = {
  monday: { breakfast: null, lunch: null, dinner: null },
  tuesday: { breakfast: null, lunch: null, dinner: null },
  wednesday: { breakfast: null, lunch: null, dinner: null },
  thursday: { breakfast: null, lunch: null, dinner: null },
  friday: { breakfast: null, lunch: null, dinner: null },
  saturday: { breakfast: null, lunch: null, dinner: null },
  sunday: { breakfast: null, lunch: null, dinner: null },
};

const emptyMealsJson: Json = emptyMeals as unknown as Json;

export async function POST(req: NextRequest) {
  return withAPISecurity(req, async (request: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const tempSchema = mealPlannerClearSchema.omit({ household_id: true });
      let validatedData: z.infer<typeof tempSchema>;
      try {
        const body = await request.json();
        validatedData = tempSchema.parse(body);
      } catch (validationError: unknown) {
        if (validationError instanceof z.ZodError) {
          logger.warn('Meal plan clear validation failed', {
            userId: user.id,
            errors: validationError.errors,
          });
          return createErrorResponse('Invalid input', 400, validationError.errors);
        }
        logger.error('Meal plan clear validation error', validationError instanceof Error ? validationError : new Error(String(validationError)), {
          userId: user.id,
        });
        return createErrorResponse('Invalid input', 400);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { week_start: week } = validatedData;
      const supabase = getDatabaseClient();

      const { data: existingPlan, error: checkError } = await supabase
        .from('meal_plans')
        .select('id, meals')
        .eq('household_id', household.id)
        .eq('week_start_date', week)
        .maybeSingle<Pick<MealPlanRow, 'id' | 'meals'>>();

      if (checkError) {
        const logError = checkError instanceof Error
          ? checkError
          : new Error('Postgrest error');
        logger.error('Error checking meal plan before clear', logError, {
          householdId: household.id,
          week,
          ...(checkError && 'message' in checkError ? { error: checkError.message } : {}),
        });
        return createErrorResponse('Failed to check meal plan', 500);
      }

      if (!existingPlan) {
        return createErrorResponse('No meal plan found for this week', 404);
      }

      const { data: updatedPlan, error: updateError } = await supabase
        .from('meal_plans')
        .update({
          meals: emptyMealsJson,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPlan.id)
        .select('*')
        .maybeSingle<MealPlanRow>();

      if (updateError || !updatedPlan) {
        const logError = updateError instanceof Error
          ? updateError
          : new Error('Postgrest error');
        logger.error('Error clearing meal plan', logError, {
          householdId: household.id,
          week,
          ...(updateError && 'message' in updateError ? { error: updateError.message } : {}),
        });
        return createErrorResponse('Failed to clear meal plan', 500);
      }

      await createAuditLog({
        action: 'meal_plan.cleared',
        targetTable: 'meal_plans',
        targetId: existingPlan.id,
        userId: user.id,
        metadata: { week_start_date: week, household_id: household.id },
      });

      return createSuccessResponse({
        message: `Meal plan for week ${week} has been cleared`,
        plan: updatedPlan,
      });
    } catch (error) {
      return handleApiError(error, { route: '/api/meal-planner/clear', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}
