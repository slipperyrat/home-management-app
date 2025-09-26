import { useQuery } from '@tanstack/react-query';

// Types
export interface TodayChore {
  id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  due_at?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'skipped';
  category: string;
  ai_estimated_duration: number;
}

export interface TodayMeal {
  id: string;
  name: string;
  type: 'breakfast' | 'lunch' | 'dinner';
  time?: string;
  recipe_id?: string;
  ingredients?: string[];
}

export interface TodayShoppingGap {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  shopping_list_id: string;
  shopping_list_name: string;
  priority: 'low' | 'medium' | 'high';
}

export interface TodayEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  location?: string;
  type: 'appointment' | 'reminder' | 'event';
}

export interface TodayViewData {
  chores: TodayChore[];
  meals: TodayMeal[];
  shoppingGaps: TodayShoppingGap[];
  events: TodayEvent[];
  summary: {
    totalChores: number;
    completedChores: number;
    upcomingMeals: number;
    shoppingItemsNeeded: number;
    upcomingEvents: number;
  };
}

// API function
const fetchTodayView = async (): Promise<TodayViewData> => {
  const response = await fetch('/api/today-view');
  if (!response.ok) {
    throw new Error('Failed to fetch today view data');
  }
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch today view data');
  }
  
  return data.data;
};

// Custom hook
export function useTodayView() {
  return useQuery({
    queryKey: ['todayView'],
    queryFn: fetchTodayView,
    staleTime: 2 * 60 * 1000, // 2 minutes - today's data changes frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}
