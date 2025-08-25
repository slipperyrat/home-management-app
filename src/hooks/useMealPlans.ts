'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Types
export interface Recipe {
  id: string;
  name: string;
  description?: string;
  household_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
    prep_time: number;
    cook_time: number;
    difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
    image_url?: string;
  is_favorite: boolean;
  tags: string[];
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  amount: number;
  unit: string;
  notes?: string;
}

export interface RecipeInstruction {
  id: string;
  recipe_id: string;
  step_number: number;
  instruction: string;
  time_minutes?: number;
}

export interface MealPlan {
  id: string;
  household_id: string;
  week_start_date: string;
  meals: {
    [day: string]: {
      breakfast?: Recipe | string | null;
      lunch?: Recipe | string | null;
      dinner?: Recipe | string | null;
    };
  };
  created_at: string;
  updated_at: string;
}

export interface AssignMealData {
  week: string;
  day: string;
  slot: 'breakfast' | 'lunch' | 'dinner';
  recipe_id: string | null;
  alsoAddToList?: boolean;
}

export interface CopyWeekData {
  fromWeek: string;
  toWeek: string;
}

export interface ClearWeekData {
  week: string;
}

// API functions
async function fetchMealPlan(weekStart: string): Promise<MealPlan | null> {
  const response = await fetch(`/api/meal-planner?week_start_date=${weekStart}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // No meal plan exists for this week
    }
    throw new Error(`Failed to fetch meal plan: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Handle the API response structure
  if (data.success && data.mealPlan) {
    return data.mealPlan;
  }
  
  // Return null if no meal plan exists
  return null;
}

async function assignMeal(data: AssignMealData): Promise<{ plan: MealPlan; ingredients?: any }> {
  const response = await fetch('/api/meal-planner/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to assign meal: ${response.status}`);
  }

  return response.json();
}

async function copyWeek(data: CopyWeekData): Promise<{ success: boolean; message: string }> {
  const response = await fetch('/api/meal-planner/copy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to copy week: ${response.status}`);
  }

  return response.json();
}

async function clearWeek(data: ClearWeekData): Promise<{ success: boolean; message: string }> {
  const response = await fetch('/api/meal-planner/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to clear week: ${response.status}`);
  }

  return response.json();
}

// Custom hooks
export function useMealPlan(weekStart?: Date) {
  const weekStartString = weekStart ? weekStart.toISOString().split('T')[0] : undefined;
  
  return useQuery({
    queryKey: ['mealPlan', weekStartString],
    queryFn: () => fetchMealPlan(weekStartString!),
    enabled: !!weekStartString,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes in cache
  });
}

export function useAssignMeal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: assignMeal,
    onMutate: async (data) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['mealPlan', data.week] });
      
      // Snapshot the previous value
      const previousMealPlan = queryClient.getQueryData(['mealPlan', data.week]);
      
      // Optimistically update to the new value
      queryClient.setQueryData(['mealPlan', data.week], (old: MealPlan | null) => {
        if (!old) {
          // Create new meal plan if none exists
          return {
            id: `temp-${Date.now()}`,
            household_id: '', // Will be filled by API
            week_start_date: data.week,
            meals: {
              [data.day]: {
                breakfast: data.slot === 'breakfast' ? data.recipe_id : null,
                lunch: data.slot === 'lunch' ? data.recipe_id : null,
                dinner: data.slot === 'dinner' ? data.recipe_id : null,
              }
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
        
        // Update existing meal plan
        return {
          ...old,
          meals: {
            ...old.meals,
            [data.day]: {
              ...old.meals[data.day],
              [data.slot]: data.recipe_id,
            }
          },
          updated_at: new Date().toISOString(),
        };
      });
      
      // Return a context object with the snapshotted value
      return { previousMealPlan };
    },
    onError: (err, data, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousMealPlan) {
        queryClient.setQueryData(['mealPlan', data.week], context.previousMealPlan);
      }
      toast.error(`Failed to assign meal: ${err.message}`);
    },
    onSettled: (data) => {
      // Always refetch after error or success
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['mealPlan', data.plan.week_start_date] });
      }
    },
  });
}

export function useCopyWeek() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: copyWeek,
    onSuccess: (data, variables) => {
      // Invalidate both weeks to refresh data
      queryClient.invalidateQueries({ queryKey: ['mealPlan', variables.fromWeek] });
      queryClient.invalidateQueries({ queryKey: ['mealPlan', variables.toWeek] });
      toast.success(data.message || 'Week copied successfully');
    },
    onError: (error) => {
      toast.error(`Failed to copy week: ${error.message}`);
    },
  });
}

export function useClearWeek() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: clearWeek,
    onSuccess: (data, variables) => {
      // Invalidate the week to refresh data
      queryClient.invalidateQueries({ queryKey: ['mealPlan', variables.week] });
      toast.success(data.message || 'Week cleared successfully');
    },
    onError: (error) => {
      toast.error(`Failed to clear week: ${error.message}`);
    },
  });
}

// Optimistic updates hook
export function useOptimisticMealPlans() {
  const queryClient = useQueryClient();
  
  const addOptimisticMeal = (weekStart: string, day: string, slot: string, recipe: Recipe | null) => {
    queryClient.setQueryData(['mealPlan', weekStart], (old: MealPlan | null) => {
      if (!old) {
        return {
          id: `temp-${Date.now()}`,
          household_id: '', // Will be filled by API
          week_start_date: weekStart,
          meals: {
            [day]: {
              breakfast: slot === 'breakfast' ? recipe : null,
              lunch: slot === 'lunch' ? recipe : null,
              dinner: slot === 'dinner' ? recipe : null,
            }
          },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
      }
      
      return {
        ...old,
        meals: {
          ...old.meals,
          [day]: {
            ...old.meals[day],
            [slot]: recipe,
          }
        },
        updated_at: new Date().toISOString(),
      };
    });
  };
  
  const removeOptimisticMeal = (weekStart: string, day: string, slot: string) => {
    queryClient.setQueryData(['mealPlan', weekStart], (old: MealPlan | null) => {
      if (!old) return old;
      
      return {
        ...old,
        meals: {
          ...old.meals,
          [day]: {
            ...old.meals[day],
            [slot]: null,
          }
        },
        updated_at: new Date().toISOString(),
      };
    });
  };
  
  return { addOptimisticMeal, removeOptimisticMeal };
}
