import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/config';

// Types
export interface MealPlan {
  id: string;
  name: string;
  description?: string;
  household_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  total_meals: number;
  planned_meals: number;
}

export interface MealPlanRecipe {
  id: string;
  meal_plan_id: string;
  recipe_id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  day_of_week: number; // 0-6 (Sunday-Saturday)
  servings: number;
  notes?: string;
  recipe: {
    id: string;
    name: string;
    description?: string;
    prep_time: number;
    cook_time: number;
    difficulty: 'easy' | 'medium' | 'hard';
    image_url?: string;
  };
}

export interface CreateMealPlanData {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  household_id: string;
}

export interface AddRecipeToMealPlanData {
  meal_plan_id: string;
  recipe_id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  day_of_week: number;
  servings: number;
  notes?: string;
}

// API functions
async function fetchMealPlans(): Promise<{ success: boolean; mealPlans: MealPlan[] }> {
  const response = await fetch('/api/meal-planner');
  if (!response.ok) {
    throw new Error('Failed to fetch meal plans');
  }
  return response.json();
}

async function fetchMealPlan(mealPlanId: string): Promise<{ success: boolean; mealPlan: MealPlan; recipes: MealPlanRecipe[] }> {
  const response = await fetch(`/api/meal-planner/${mealPlanId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch meal plan');
  }
  return response.json();
}

async function createMealPlan(data: CreateMealPlanData): Promise<{ success: boolean; mealPlan: MealPlan }> {
  const response = await fetch('/api/meal-planner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create meal plan');
  }
  return response.json();
}

async function updateMealPlan(mealPlanId: string, data: Partial<MealPlan>): Promise<{ success: boolean; mealPlan: MealPlan }> {
  const response = await fetch(`/api/meal-planner/${mealPlanId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update meal plan');
  }
  return response.json();
}

async function deleteMealPlan(mealPlanId: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/meal-planner/${mealPlanId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete meal plan');
  }
  return response.json();
}

async function addRecipeToMealPlan(data: AddRecipeToMealPlanData): Promise<{ success: boolean; mealPlanRecipe: MealPlanRecipe }> {
  const response = await fetch('/api/meal-planner/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to add recipe to meal plan');
  }
  return response.json();
}

async function removeRecipeFromMealPlan(mealPlanRecipeId: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/meal-planner/assign/${mealPlanRecipeId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to remove recipe from meal plan');
  }
  return response.json();
}

// Custom hooks
export function useMealPlans() {
  return useQuery({
    queryKey: queryKeys.mealPlans.all,
    queryFn: fetchMealPlans,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useMealPlan(mealPlanId: string) {
  return useQuery({
    queryKey: queryKeys.mealPlans.byId(mealPlanId),
    queryFn: () => fetchMealPlan(mealPlanId),
    enabled: !!mealPlanId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createMealPlan,
    onSuccess: (data) => {
      // Invalidate and refetch meal plans
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
      
      // Add the new meal plan to cache
      queryClient.setQueryData(
        queryKeys.mealPlans.byId(data.mealPlan.id),
        { success: true, mealPlan: data.mealPlan, recipes: [] }
      );
    },
    onError: (error) => {
      console.error('Failed to create meal plan:', error);
    },
  });
}

export function useUpdateMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ mealPlanId, data }: { mealPlanId: string; data: Partial<MealPlan> }) =>
      updateMealPlan(mealPlanId, data),
    onSuccess: (data, variables) => {
      // Update the specific meal plan in cache
      queryClient.setQueryData(
        queryKeys.mealPlans.byId(variables.mealPlanId),
        (oldData: any) => ({
          ...oldData,
          mealPlan: { ...oldData.mealPlan, ...data.mealPlan },
        })
      );
      
      // Invalidate the list to reflect changes
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
    },
    onError: (error) => {
      console.error('Failed to update meal plan:', error);
    },
  });
}

export function useDeleteMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteMealPlan,
    onSuccess: (_, mealPlanId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.mealPlans.byId(mealPlanId) });
      
      // Invalidate and refetch meal plans list
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
    },
    onError: (error) => {
      console.error('Failed to delete meal plan:', error);
    },
  });
}

export function useAddRecipeToMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addRecipeToMealPlan,
    onSuccess: (data, variables) => {
      // Update the meal plan's recipes in cache
      queryClient.setQueryData(
        queryKeys.mealPlans.byId(variables.meal_plan_id),
        (oldData: any) => ({
          ...oldData,
          recipes: [...(oldData.recipes || []), data.mealPlanRecipe],
        })
      );
      
      // Invalidate the list to reflect changes
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
    },
    onError: (error) => {
      console.error('Failed to add recipe to meal plan:', error);
    },
  });
}

export function useRemoveRecipeFromMealPlan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: removeRecipeFromMealPlan,
    onSuccess: (_, mealPlanRecipeId) => {
      // Find and remove the recipe from all meal plans in cache
      queryClient.setQueriesData(
        { queryKey: queryKeys.mealPlans.all },
        (oldData: any) => {
          if (!oldData?.mealPlans) return oldData;
          
          return {
            ...oldData,
            mealPlans: oldData.mealPlans.map((mealPlan: MealPlan) => ({
              ...mealPlan,
              // Note: This is a simplified update - in practice, you might need to
              // update the specific meal plan's recipes cache as well
            })),
          };
        }
      );
      
      // Invalidate all meal plan queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
    },
    onError: (error) => {
      console.error('Failed to remove recipe from meal plan:', error);
    },
  });
}

// Optimistic updates hook
export function useOptimisticMealPlans() {
  const queryClient = useQueryClient();
  
  const addOptimisticMealPlan = (mealPlan: Omit<MealPlan, 'id' | 'created_at' | 'updated_at'>) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticMealPlan: MealPlan = {
      ...mealPlan,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    queryClient.setQueryData(
      queryKeys.mealPlans.all,
      (oldData: any) => ({
        ...oldData,
        mealPlans: [optimisticMealPlan, ...(oldData?.mealPlans || [])],
      })
    );
    
    return tempId;
  };
  
  const removeOptimisticMealPlan = (tempId: string) => {
    queryClient.setQueryData(
      queryKeys.mealPlans.all,
      (oldData: any) => ({
        ...oldData,
        mealPlans: (oldData?.mealPlans || []).filter((mp: MealPlan) => mp.id !== tempId),
      })
    );
  };
  
  return { addOptimisticMealPlan, removeOptimisticMealPlan };
}
