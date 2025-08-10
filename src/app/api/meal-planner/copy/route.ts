import { NextRequest, NextResponse } from 'next/server';
import { getUserAndHousehold } from '@/lib/server/supabaseAdmin';
import { sb } from '@/lib/server/supabaseAdmin';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const SLOTS = ['breakfast', 'lunch', 'dinner'] as const;

type Day = typeof DAYS[number];
type Slot = typeof SLOTS[number];

interface DayMeals {
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
}

interface MealsStructure {
  monday: DayMeals;
  tuesday: DayMeals;
  wednesday: DayMeals;
  thursday: DayMeals;
  friday: DayMeals;
  saturday: DayMeals;
  sunday: DayMeals;
}

interface CopyMealPlanRequest {
  from: string; // YYYY-MM-DD format
  to: string;   // YYYY-MM-DD format
  overwrite: boolean;
}

// Create empty meal plan template
function createEmptyMealPlan(): MealsStructure {
  return {
    monday: { breakfast: null, lunch: null, dinner: null },
    tuesday: { breakfast: null, lunch: null, dinner: null },
    wednesday: { breakfast: null, lunch: null, dinner: null },
    thursday: { breakfast: null, lunch: null, dinner: null },
    friday: { breakfast: null, lunch: null, dinner: null },
    saturday: { breakfast: null, lunch: null, dinner: null },
    sunday: { breakfast: null, lunch: null, dinner: null },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { householdId } = await getUserAndHousehold();
    const body: CopyMealPlanRequest = await request.json();

    const { from, to, overwrite } = body;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Validate that dates are different
    if (from === to) {
      return NextResponse.json(
        { error: 'Source and destination weeks must be different' },
        { status: 400 }
      );
    }

    const supabase = sb();

    // Load source meal plan
    const { data: sourcePlan, error: sourceError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('household_id', householdId)
      .eq('week_start_date', from)
      .maybeSingle();

    if (sourceError) {
      console.error('Error fetching source meal plan:', sourceError);
      return NextResponse.json(
        { error: 'Failed to fetch source meal plan' },
        { status: 500 }
      );
    }

    if (!sourcePlan) {
      return NextResponse.json(
        { error: 'Source meal plan not found' },
        { status: 404 }
      );
    }

    // Load destination meal plan (or prepare to create one)
    const { data: destPlan, error: destError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('household_id', householdId)
      .eq('week_start_date', to)
      .maybeSingle();

    if (destError) {
      console.error('Error fetching destination meal plan:', destError);
      return NextResponse.json(
        { error: 'Failed to fetch destination meal plan' },
        { status: 500 }
      );
    }

    // Prepare source and destination meals objects
    const sourceMeals = sourcePlan.meals || createEmptyMealPlan();
    const destMeals = destPlan?.meals || createEmptyMealPlan();

    // Build new meals object based on overwrite setting
    const newMeals = { ...destMeals };

    for (const day of DAYS) {
      // Ensure day exists in both source and destination
      if (!sourceMeals[day]) continue;
      if (!newMeals[day]) {
        newMeals[day] = { breakfast: null, lunch: null, dinner: null };
      }

      for (const slot of SLOTS) {
        const sourceSlot = sourceMeals[day]?.[slot];
        const destSlot = newMeals[day]?.[slot];

        if (sourceSlot !== undefined && sourceSlot !== null) {
          // Copy from source if:
          // 1. overwrite is true (copy everything)
          // 2. overwrite is false but destination slot is null/empty
          if (overwrite || destSlot === null || destSlot === undefined) {
            newMeals[day][slot] = sourceSlot;
          }
        }
      }
    }

    // Upsert the destination meal plan
    const { data: updatedPlan, error: upsertError } = await supabase
      .from('meal_plans')
      .upsert([{
        household_id: householdId,
        week_start_date: to,
        meals: newMeals
      }], {
        onConflict: 'household_id,week_start_date'
      })
      .select('*')
      .single();

    if (upsertError) {
      console.error('Error upserting destination meal plan:', upsertError);
      return NextResponse.json(
        { error: 'Failed to update destination meal plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: updatedPlan
    });

  } catch (error: any) {
    console.error('Error in meal planner copy:', error);
    
    // Handle specific error types
    if (error.message?.includes('Unauthorized') || error.status === 403) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}
