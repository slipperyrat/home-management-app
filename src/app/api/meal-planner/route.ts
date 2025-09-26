import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { ServerError } from '@/lib/server/supabaseAdmin';

// This matches the actual data structure stored by the assign API
interface DayMeals {
  breakfast?: string | null;
  lunch?: string | null;
  dinner?: string | null;
}

interface CreateMealPlanRequest {
  week_start_date: string;
  meals: {
    [day: string]: DayMeals;
  };
}

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 GET: Fetching meal plan for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      const weekStartDate = searchParams.get('week_start_date');

      console.log('🔍 Meal Planner API Debug:', {
        householdId: household.id,
        weekStartDate,
        url: req.url
      });

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

      console.log('🔍 Database Query Result:', {
        mealPlan,
        error,
        query: `SELECT * FROM meal_plans WHERE household_id = '${household.id}' AND week_start_date = '${weekStartDate}'`
      });

      if (error) {
        console.error('Error fetching meal plan:', error);
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
      console.log('🚀 PUT: Updating meal plan for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Parse and validate request body using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        const { createMealPlanSchema } = await import('@/lib/validation/schemas');
        const tempSchema = createMealPlanSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
      } catch (validationError: any) {
        return createErrorResponse('Invalid input', 400, validationError.errors);
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
        console.error('Error checking existing meal plan:', checkError);
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
          console.error('Error updating meal plan:', updateError);
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
          console.error('Error creating meal plan:', insertError);
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
