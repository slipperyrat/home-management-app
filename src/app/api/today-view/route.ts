import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { startOfDay, endOfDay, format } from 'date-fns';

interface TodayViewData {
  date: string;
  chores: Array<{
    id: string;
    title: string;
    description?: string;
    assigned_to?: string;
    due_date?: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'completed';
    xp_reward: number;
    estimated_duration?: number;
  }>;
  events: Array<{
    id: string;
    title: string;
    description?: string;
    startAt: string;
    endAt: string;
    isAllDay: boolean;
    location?: string;
    attendees?: Array<{
      email?: string;
      status: string;
    }>;
    reminders?: Array<{
      minutesBefore: number;
      method: string;
    }>;
  }>;
  meals: Array<{
    id: string;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    recipe_name?: string;
    planned_for: string;
    ingredients_needed: Array<{
      name: string;
      quantity: string;
      unit: string;
      is_available: boolean;
    }>;
  }>;
  shopping: {
    urgent_items: Array<{
      id: string;
      name: string;
      quantity?: string;
      notes?: string;
      is_complete: boolean;
      list_name: string;
    }>;
    missing_ingredients: Array<{
      ingredient_name: string;
      meal_name: string;
      meal_type: string;
      quantity_needed: string;
    }>;
  };
  digest: {
    total_chores: number;
    completed_chores: number;
    upcoming_events: number;
    meals_planned: number;
    shopping_items_needed: number;
    xp_earned_today: number;
    xp_available_today: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    
    const startDate = startOfDay(targetDate);
    const endDate = endOfDay(targetDate);

    const supabase = getDatabaseClient();
    
    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const householdId = userData.household_id;

    // Fetch today's chores
    const { data: chores, error: choresError } = await supabase
      .from('chores')
      .select(`
        id,
        title,
        description,
        assigned_to,
        due_date,
        priority,
        status,
        xp_reward,
        ai_estimated_duration
      `)
      .eq('household_id', householdId)
      .gte('due_date', startDate.toISOString())
      .lte('due_date', endDate.toISOString())
      .order('priority', { ascending: false });

    if (choresError) {
      console.error('Error fetching chores:', choresError);
    }

    // Fetch today's events from household_events
    const { data: events, error: eventsError } = await supabase
      .from('household_events')
      .select(`
        id,
        title,
        description,
        start_time,
        end_time,
        location
      `)
      .eq('household_id', householdId)
      .eq('type', 'calendar.event')
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .order('start_time', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
    }

    // Fetch today's meal plans
    const { data: mealPlans, error: mealPlansError } = await supabase
      .from('meal_plans')
      .select(`
        id,
        meal_type,
        recipe_name,
        planned_for
      `)
      .eq('household_id', householdId)
      .eq('planned_for', format(targetDate, 'yyyy-MM-dd'))
      .order('meal_type');

    if (mealPlansError) {
      console.error('Error fetching meal plans:', mealPlansError);
    }

    // Fetch urgent shopping items (due today or overdue)
    const { data: shoppingItems, error: shoppingError } = await supabase
      .from('shopping_items')
      .select(`
        id,
        name,
        quantity,
        notes,
        is_complete,
        shopping_lists!inner(
          title as list_name
        )
      `)
      .eq('shopping_lists.household_id', householdId)
      .eq('is_complete', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (shoppingError) {
      console.error('Error fetching shopping items:', shoppingError);
    }

    // Get ingredients needed for today's meals
    const missingIngredients = [];
    if (mealPlans && mealPlans.length > 0) {
      const mealIds = mealPlans.map(meal => meal.id);
      const { data: mealIngredients, error: ingredientsError } = await supabase
        .from('meal_plan_ingredients')
        .select(`
          ingredient_name,
          quantity,
          unit,
          meal_plans!inner(
            id,
            meal_type,
            recipe_name
          )
        `)
        .in('meal_plan_id', mealIds);

      if (!ingredientsError && mealIngredients) {
        // Check which ingredients are missing from shopping lists
        const ingredientNames = mealIngredients.map(ing => ing.ingredient_name);
        const { data: availableIngredients } = await supabase
          .from('shopping_items')
          .select('name, is_complete')
          .eq('shopping_lists.household_id', householdId)
          .in('name', ingredientNames);

        const availableSet = new Set(
          availableIngredients
            ?.filter(item => item.is_complete)
            .map(item => item.name.toLowerCase()) || []
        );

        mealIngredients.forEach(ingredient => {
          if (!availableSet.has(ingredient.ingredient_name.toLowerCase())) {
            missingIngredients.push({
              ingredient_name: ingredient.ingredient_name,
              meal_name: ingredient.meal_plans?.recipe_name || 'Unknown',
              meal_type: ingredient.meal_plans?.meal_type || 'unknown',
              quantity_needed: `${ingredient.quantity} ${ingredient.unit}`
            });
          }
        });
      }
    }

    // Calculate digest statistics
    const completedChores = chores?.filter(chore => chore.status === 'completed').length || 0;
    const totalChores = chores?.length || 0;
    const xpEarnedToday = chores
      ?.filter(chore => chore.status === 'completed')
      .reduce((sum, chore) => sum + (chore.xp_reward || 0), 0) || 0;
    const xpAvailableToday = chores
      ?.reduce((sum, chore) => sum + (chore.xp_reward || 0), 0) || 0;

    const todayData: TodayViewData = {
      date: format(targetDate, 'yyyy-MM-dd'),
      chores: chores || [],
      events: events?.map(event => ({
        ...event,
        startAt: event.start_time,
        endAt: event.end_time,
        isAllDay: false
      })) || [],
      meals: mealPlans || [],
      shopping: {
        urgent_items: shoppingItems || [],
        missing_ingredients: missingIngredients
      },
      digest: {
        total_chores: totalChores,
        completed_chores: completedChores,
        upcoming_events: events?.length || 0,
        meals_planned: mealPlans?.length || 0,
        shopping_items_needed: (shoppingItems?.length || 0) + missingIngredients.length,
        xp_earned_today: xpEarnedToday,
        xp_available_today: xpAvailableToday
      }
    };

    return NextResponse.json(todayData);

  } catch (error) {
    console.error('Error in GET /api/today-view:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}