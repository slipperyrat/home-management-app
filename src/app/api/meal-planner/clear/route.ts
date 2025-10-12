import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { mealPlannerClearSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  return withAPISecurity(req, async (request, user) => {
    try {
      logger.info('Clearing meal plan for household', { userId: user.id });

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

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { week_start: week } = validatedData;

      const supabase = getDatabaseClient();

      // Check if meal plan exists for this week
      const { data: existingPlan, error: checkError } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('household_id', household.id)
        .eq('week_start_date', week)
        .maybeSingle();

      if (checkError) {
        logger.error('Error checking meal plan before clear', checkError, { householdId: household.id, week });
        return createErrorResponse('Failed to check meal plan', 500);
      }

      if (!existingPlan) {
        return createErrorResponse('No meal plan found for this week', 404);
      }

      // Clear all meals for the week (set to empty structure)
      const emptyMeals = {
        monday: { breakfast: null, lunch: null, dinner: null },
        tuesday: { breakfast: null, lunch: null, dinner: null },
        wednesday: { breakfast: null, lunch: null, dinner: null },
        thursday: { breakfast: null, lunch: null, dinner: null },
        friday: { breakfast: null, lunch: null, dinner: null },
        saturday: { breakfast: null, lunch: null, dinner: null },
        sunday: { breakfast: null, lunch: null, dinner: null },
      };

      // Update the meal plan with empty meals
      const { data: updatedPlan, error: updateError } = await supabase
        .from('meal_plans')
        .update({
          meals: emptyMeals,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPlan.id)
        .select()
        .single();

      if (updateError) {
        logger.error('Error clearing meal plan', updateError, { householdId: household.id, week });
        return createErrorResponse('Failed to clear meal plan', 500);
      }

      // Create audit log
      await createAuditLog({
        user_id: user.id,
        household_id: household.id,
        action: 'meal_plan_cleared',
        details: { week_start: week }
      });

      return createSuccessResponse({
        message: `Meal plan for week ${week} has been cleared`,
        plan: updatedPlan
      });
    } catch (error) {
      return handleApiError(error, { route: '/api/meal-planner/clear', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
