import { NextRequest, NextResponse } from 'next/server';
import { sb, getUserAndHousehold, createErrorResponse, ServerError } from '@/lib/server/supabaseAdmin';

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
  try {
    const { householdId } = await getUserAndHousehold();
    const { searchParams } = new URL(request.url);
    const weekStartDate = searchParams.get('week_start_date');

    if (!weekStartDate) {
      throw new ServerError('week_start_date parameter is required', 400);
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(weekStartDate)) {
      throw new ServerError('week_start_date must be in YYYY-MM-DD format', 400);
    }

    // Fetch meal plan for the specified week
    const { data: mealPlan, error } = await sb()
      .from('meal_plans')
      .select('*')
      .eq('household_id', householdId)
      .eq('week_start_date', weekStartDate)
      .maybeSingle();

    if (error) {
      console.error('Error fetching meal plan:', error);
      throw new ServerError('Failed to fetch meal plan', 500);
    }



    return NextResponse.json({
      success: true,
      mealPlan
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    
    console.error('Unexpected error in GET /api/meal-planner:', error);
    return createErrorResponse(new ServerError('Internal server error'));
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { householdId } = await getUserAndHousehold();
    const body: CreateMealPlanRequest = await request.json();

    // Validate required fields
    if (!body.week_start_date) {
      throw new ServerError('week_start_date is required', 400);
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.week_start_date)) {
      throw new ServerError('week_start_date must be in YYYY-MM-DD format', 400);
    }

    // Validate meals object
    if (!body.meals || typeof body.meals !== 'object') {
      throw new ServerError('meals must be an object', 400);
    }

    // Validate meal structure
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const validMealTypes = ['breakfast', 'lunch', 'dinner'];

    for (const [day, dayMeals] of Object.entries(body.meals)) {
      if (!validDays.includes(day.toLowerCase())) {
        throw new ServerError(`Invalid day: ${day}. Must be one of: ${validDays.join(', ')}`, 400);
      }

      if (dayMeals && typeof dayMeals === 'object') {
        for (const [mealType, _recipeId] of Object.entries(dayMeals)) {
          if (!validMealTypes.includes(mealType)) {
            throw new ServerError(`Invalid meal_type: ${mealType}. Must be one of: ${validMealTypes.join(', ')}`, 400);
          }
        }
      }
    }

    // Check if meal plan already exists for this week
    const { data: existingPlan, error: checkError } = await sb()
      .from('meal_plans')
      .select('id')
      .eq('household_id', householdId)
      .eq('week_start_date', body.week_start_date)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing meal plan:', checkError);
      throw new ServerError('Failed to check existing meal plan', 500);
    }

    const mealPlanData = {
      household_id: householdId,
      week_start_date: body.week_start_date,
      meals: body.meals
    };

    let result;

    if (existingPlan) {
      // Update existing meal plan
      const { data: updatedPlan, error: updateError } = await sb()
        .from('meal_plans')
        .update(mealPlanData)
        .eq('id', existingPlan.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating meal plan:', updateError);
        throw new ServerError('Failed to update meal plan', 500);
      }

      result = updatedPlan;
    } else {
      // Create new meal plan
      const { data: newPlan, error: insertError } = await sb()
        .from('meal_plans')
        .insert(mealPlanData)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating meal plan:', insertError);
        throw new ServerError('Failed to create meal plan', 500);
      }

      result = newPlan;
    }

    return NextResponse.json({
      success: true,
      mealPlan: result
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    
    console.error('Unexpected error in PUT /api/meal-planner:', error);
    return createErrorResponse(new ServerError('Internal server error'));
  }
}
