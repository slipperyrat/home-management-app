import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { startOfDay, endOfDay, format } from 'date-fns';
import type { Database } from '@/types/supabase.generated';

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

type ChoreRow = Database['public']['Tables']['chores']['Row'];
type EventRow = Database['public']['Tables']['events']['Row'];
type MealPlanRow = Database['public']['Tables']['meal_plans']['Row'];
type ShoppingItemSelect = {
  id: string;
  name: string;
  quantity: string | null;
  notes: string | null;
  is_complete: boolean | null;
  shopping_lists?: { title: string | null } | null;
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getDatabaseClient();
    const targetDate = request.nextUrl.searchParams.get('date')
      ? new Date(request.nextUrl.searchParams.get('date')!)
      : new Date();

    const dayStart = startOfDay(targetDate).toISOString();
    const dayEnd = endOfDay(targetDate).toISOString();

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'User not found or no household' }, { status: 404 });
    }

    const householdId = userData.household_id;

    const [choresResult, eventsResult, mealPlansResult, shoppingItemsResult] = await Promise.all([
      supabase
        .from('chores')
        .select('*')
        .eq('household_id', householdId)
        .gte('due_date', dayStart)
        .lte('due_date', dayEnd),
      supabase
        .from('events')
        .select('*')
        .eq('household_id', householdId)
        .gte('start_at', dayStart)
        .lte('start_at', dayEnd),
      supabase
        .from('meal_plans')
        .select('*')
        .eq('household_id', householdId)
        .gte('planned_for', dayStart)
        .lte('planned_for', dayEnd),
      supabase
        .from('shopping_items')
        .select(
          `
            id,
            name,
            quantity,
            notes,
            is_complete,
            shopping_lists ( title )
          `,
        )
        .eq('household_id', householdId)
        .eq('is_complete', false)
        .order('created_at', { ascending: true })
        .limit(10),
    ]);

    const chores = (choresResult.data ?? []) as ChoreRow[];
    const events = (eventsResult.data ?? []) as EventRow[];
    const mealPlans = (mealPlansResult.data ?? []) as MealPlanRow[];
    const shoppingItems = (shoppingItemsResult.data ?? []) as ShoppingItemSelect[];

    const missingIngredients: TodayViewData['shopping']['missing_ingredients'] = [];

    const completedChores = chores.filter((chore) => chore.status === 'completed').length;
    const xpEarnedToday = chores
      .filter((chore) => chore.status === 'completed')
      .reduce((sum, chore) => sum + (chore.xp_reward ?? 0), 0);
    const xpAvailableToday = chores.reduce((sum, chore) => sum + (chore.xp_reward ?? 0), 0);

    const mappedChores: TodayViewData['chores'] = chores.map((chore) => {
      const mapped: TodayViewData['chores'][number] = {
        id: chore.id,
        title: chore.title,
        priority: (chore.priority as TodayViewData['chores'][number]['priority']) ?? 'medium',
        status: (chore.status as TodayViewData['chores'][number]['status']) ?? 'pending',
        xp_reward: chore.xp_reward ?? 0,
      };

      if (chore.description) {
        mapped.description = chore.description;
      }
      if (chore.assigned_to) {
        mapped.assigned_to = chore.assigned_to;
      }
      if (chore.due_date) {
        mapped.due_date = chore.due_date;
      }
      if (typeof chore.ai_estimated_duration === 'number') {
        mapped.estimated_duration = chore.ai_estimated_duration;
      }

      return mapped;
    });

    const mappedEvents: TodayViewData['events'] = events
      .filter((event): event is EventRow & { start_at: string; end_at: string } => Boolean(event.start_at && event.end_at))
      .map((event) => {
        const mapped: TodayViewData['events'][number] = {
          id: event.id,
          title: event.title ?? 'Untitled event',
          startAt: event.start_at,
          endAt: event.end_at,
          isAllDay: Boolean(event.is_all_day),
        };

        if (event.description) {
          mapped.description = event.description;
        }
        if (event.location) {
          mapped.location = event.location;
        }

        return mapped;
      });

    const mappedMeals: TodayViewData['meals'] = mealPlans.map((meal) => ({
      id: meal.id,
      meal_type: (meal.meal_type as TodayViewData['meals'][number]['meal_type']) ?? 'snack',
      recipe_name: meal.recipe_name ?? '',
      planned_for: meal.planned_for ?? format(targetDate, 'yyyy-MM-dd'),
      ingredients_needed: [],
    }));

    const mappedUrgentItems: TodayViewData['shopping']['urgent_items'] = shoppingItems.map((item) => {
      const mapped: TodayViewData['shopping']['urgent_items'][number] = {
        id: item.id,
        name: item.name,
        is_complete: Boolean(item.is_complete),
        list_name: item.shopping_lists?.title ?? 'Shopping List',
      };

      if (item.quantity) {
        mapped.quantity = String(item.quantity);
      }
      if (item.notes) {
        mapped.notes = String(item.notes);
      }

      return mapped;
    });

    const todayData: TodayViewData = {
      date: format(targetDate, 'yyyy-MM-dd'),
      chores: mappedChores,
      events: mappedEvents,
      meals: mappedMeals,
      shopping: {
        urgent_items: mappedUrgentItems,
        missing_ingredients: missingIngredients,
      },
      digest: {
        total_chores: chores.length,
        completed_chores: completedChores,
        upcoming_events: mappedEvents.length,
        meals_planned: mappedMeals.length,
        shopping_items_needed: mappedUrgentItems.length + missingIngredients.length,
        xp_earned_today: xpEarnedToday,
        xp_available_today: xpAvailableToday,
      },
    };

    return NextResponse.json(todayData);
  } catch (error) {
    console.error('Error in GET /api/today-view:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}