import { NextResponse } from 'next/server';
import { sb, getUserAndHousehold } from '@/lib/server/supabaseAdmin';
import { mealPlannerCopySchema } from '@/lib/validation/schemas';

export async function POST(req: Request) {
  try {
    const { householdId } = await getUserAndHousehold();
    
    // Parse and validate request body using Zod schema
    let validatedData;
    try {
      const body = await req.json();
      // Create a temporary schema that doesn't require household_id since it comes from user context
      const tempSchema = mealPlannerCopySchema.omit({ household_id: true });
      validatedData = tempSchema.parse(body);
    } catch (validationError: any) {
      return NextResponse.json({ 
        error: 'Invalid input', 
        details: validationError.errors 
      }, { status: 400 });
    }

    const { from_week: fromWeek, to_week: toWeek } = validatedData;

    const supabase = sb();

    // Fetch the source week's meal plan
    const { data: sourcePlan, error: fetchError } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('household_id', householdId)
      .eq('week_start_date', fromWeek)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching source meal plan:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch source meal plan' }, { status: 500 });
    }

    if (!sourcePlan) {
      return NextResponse.json({ error: 'Source week has no meal plan to copy' }, { status: 404 });
    }

    // Check if target week already has a meal plan
    const { data: existingTargetPlan, error: checkError } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('household_id', householdId)
      .eq('week_start_date', toWeek)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking target meal plan:', checkError);
      return NextResponse.json({ error: 'Failed to check target meal plan' }, { status: 500 });
    }

    if (existingTargetPlan) {
      // Update existing target plan
      const { data: updatedPlan, error: updateError } = await supabase
        .from('meal_plans')
        .update({
          meals: sourcePlan.meals,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTargetPlan.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating target meal plan:', updateError);
        return NextResponse.json({ error: 'Failed to update target meal plan' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Meal plan copied from ${fromWeek} to ${toWeek}`,
        plan: updatedPlan
      });
    } else {
      // Create new target plan
      const { data: newPlan, error: insertError } = await supabase
        .from('meal_plans')
        .insert({
          household_id: householdId,
          week_start_date: toWeek,
          meals: sourcePlan.meals,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating target meal plan:', insertError);
        return NextResponse.json({ error: 'Failed to create target meal plan' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Meal plan copied from ${fromWeek} to ${toWeek}`,
        plan: newPlan
      });
    }
  } catch (e: any) {
    console.error('Error in copy week API:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
