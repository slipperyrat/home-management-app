'use client';

import { useQuery } from '@tanstack/react-query';

interface RecipeIngredient {
  name: string;
  quantity: string | number;
  unit?: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  prep_time: number;
  cook_time: number;
  servings: number;
  image_url?: string;
  tags: string[];
}

interface MealPlanDay {
  breakfast?: Recipe | string | null;
  lunch?: Recipe | string | null;
  dinner?: Recipe | string | null;
}

interface MealPlan {
  id: string;
  household_id: string;
  week_start_date: string;
  meals: Record<string, MealPlanDay>;
}

const fetchMealPlan = async (weekStart: string): Promise<MealPlan | null> => {
  const response = await fetch(`/api/meal-planner?week_start_date=${weekStart}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch meal plan: ${response.status}`);
  }

  const data = await response.json();

  if (data.success && data.mealPlan) {
    return data.mealPlan as MealPlan;
  }

  return null;
};

export const useMealPlan = (weekStart?: Date) => {
  const weekStartString = weekStart?.toISOString().split('T')[0];

  return useQuery({
    queryKey: ['mealPlan', weekStartString],
    queryFn: () => fetchMealPlan(weekStartString!),
    enabled: Boolean(weekStartString),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};
