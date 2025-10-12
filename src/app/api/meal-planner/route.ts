import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

// This matches the actual data structure stored by the assign API
interface DayMeals {
  breakfast?: string | null;
  lunch?: string | null;
  dinner?: string | null;
}

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      logger.info('Fetching meal plan', { userId: user.id });

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      const weekStartDate = searchParams.get('week_start_date');

      if (!weekStartDate) {
        return createErrorResponse('week_start_date parameter is required', 400);
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(weekStartDate)) {
        return createErrorResponse('week_start_date must be in YYYY-MM-DD format', 400);
      }

      // Fetch meal plan for the specified week
      const supabase = getDatabaseClient();
      const { data: mealPlan, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('household_id', household.id)
        .eq('week_start_date', weekStartDate)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching meal plan', error, { householdId: household.id, weekStartDate });
        return createErrorResponse('Failed to fetch meal plan', 500, error.message);
      }

      return createSuccessResponse({ mealPlan }, 'Meal plan fetched successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/meal-planner', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function PUT(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      logger.info('Updating meal plan', { userId: user.id });

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Parse and validate request body using Zod schema
      let validatedData: { week_start: string; meals: Record<string, DayMeals> };
      try {
        const body = await req.json();
        const { createMealPlanSchema } = await import('@/lib/validation/schemas');
        const tempSchema = createMealPlanSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
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

      // Check if meal plan already exists for this week
      const supabase = getDatabaseClient();
      const { data: existingPlan, error: checkError } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('household_id', household.id)
        .eq('week_start_date', validatedData.week_start)
        .maybeSingle();

      if (checkError) {
        logger.error('Error checking existing meal plan', checkError, { householdId: household.id, weekStart: validatedData.week_start });
        return createErrorResponse('Failed to check existing meal plan', 500, checkError.message);
      }

      const mealPlanData = {
        household_id: household.id,
        week_start_date: validatedData.week_start,
        meals: validatedData.meals
      };

      let result;

      if (existingPlan) {
        // Update existing meal plan
        const { data: updatedPlan, error: updateError } = await supabase
          .from('meal_plans')
          .update(mealPlanData)
          .eq('id', existingPlan.id)
          .select()
          .single();

        if (updateError) {
          logger.error('Error updating meal plan', updateError, { householdId: household.id, weekStart: validatedData.week_start });
          return createErrorResponse('Failed to update meal plan', 500, updateError.message);
        }

        result = updatedPlan;
      } else {
        // Create new meal plan
        const { data: newPlan, error: insertError } = await supabase
          .from('meal_plans')
          .insert(mealPlanData)
          .select()
          .single();

        if (insertError) {
          logger.error('Error creating meal plan', insertError, { householdId: household.id, weekStart: validatedData.week_start });
          return createErrorResponse('Failed to create meal plan', 500, insertError.message);
        }

        result = newPlan;
      }

      return createSuccessResponse({ mealPlan: result }, 'Meal plan updated successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/meal-planner', method: 'PUT', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
