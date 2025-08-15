'use client';

import { useQuery } from '@tanstack/react-query';

interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: any[];
  instructions: string[];
  prep_time: number;
  cook_time: number;
  servings: number;
  image_url?: string;
  tags: string[];
}

interface MealPlan {
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
}

const fetchMealPlan = async (weekStart: string): Promise<MealPlan | null> => {
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
};

export const useMealPlan = (weekStart?: Date) => {
  const weekStartString = weekStart?.toISOString().split('T')[0];
  
  return useQuery({
    queryKey: ['mealPlan', weekStartString],
    queryFn: () => fetchMealPlan(weekStartString!),
    enabled: !!weekStartString, // Only run if weekStart exists
    staleTime: 5 * 60 * 1000, // 5 minutes - meal plans change more frequently
    gcTime: 15 * 60 * 1000, // 15 minutes in cache
  });
};
