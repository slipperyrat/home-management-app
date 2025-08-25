import { NextResponse } from 'next/server';
import { sb, getUserAndHousehold } from '@/lib/server/supabaseAdmin';
import { ClearWeekSchema, validateRequest, createValidationErrorResponse } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const { userId, householdId } = await getUserAndHousehold();
    const body = await req.json();

    // Validate request body with Zod
    const validation = validateRequest(ClearWeekSchema, body);
    if (!validation.success) {
      return createValidationErrorResponse(validation.error);
    }

    const { week } = validation.data;

    const supabase = sb();

    // Check if meal plan exists for this week
    const { data: existingPlan, error: checkError } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('household_id', householdId)
      .eq('week_start_date', week)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking meal plan:', checkError);
      return NextResponse.json({ error: 'Failed to check meal plan' }, { status: 500 });
    }

    if (!existingPlan) {
      return NextResponse.json({ error: 'No meal plan found for this week' }, { status: 404 });
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
      console.error('Error clearing meal plan:', updateError);
      return NextResponse.json({ error: 'Failed to clear meal plan' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Meal plan for week ${week} has been cleared`,
      plan: updatedPlan
    });
  } catch (e: any) {
    console.error('Error in clear week API:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
