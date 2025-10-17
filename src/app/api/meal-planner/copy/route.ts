import { NextResponse } from 'next/server';
import { sb, getUserAndHousehold } from '@/lib/server/supabaseAdmin';
import { mealPlannerCopySchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

export async function POST(req: Request) {
  try {
    const { householdId } = await getUserAndHousehold();
    
    // Parse and validate request body using Zod schema
    const tempSchema = mealPlannerCopySchema.omit({ household_id: true });
    let validatedData: z.infer<typeof tempSchema>;
    try {
      const body = await req.json();
      validatedData = tempSchema.parse(body);
    } catch (validationError: unknown) {
      if (validationError instanceof z.ZodError) {
        logger.warn('Meal planner copy validation failed', { errors: validationError.errors, householdId });
        return NextResponse.json({
          error: 'Invalid input',
          details: validationError.errors,
        }, { status: 400 });
      }
      logger.error('Meal planner copy validation error', validationError instanceof Error ? validationError : new Error(String(validationError)), {
        householdId,
      });
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
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
      logger.error('Error fetching source meal plan', fetchError, { householdId, fromWeek });
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
      logger.error('Error checking target meal plan', checkError, { householdId, toWeek });
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
        logger.error('Error updating target meal plan', updateError, { householdId, toWeek });
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
        logger.error('Error creating target meal plan', insertError, { householdId, toWeek });
        return NextResponse.json({ error: 'Failed to create target meal plan' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Meal plan copied from ${fromWeek} to ${toWeek}`,
        plan: newPlan
      });
    }
  } catch (error) {
    const logError = error instanceof Error ? error : new Error(String(error));
    logger.error('Error in meal planner copy API', logError);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
