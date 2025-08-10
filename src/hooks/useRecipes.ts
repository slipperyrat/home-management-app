'use client';

import { useQuery } from '@tanstack/react-query';

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  category: string;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  prep_time: number;
  cook_time: number;
  servings: number;
  image_url?: string;
  tags: string[];
  created_at: string;
  created_by: string;
}

const fetchRecipes = async (householdId: string): Promise<Recipe[]> => {
  const response = await fetch(`/api/recipes`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch recipes: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Handle the API response structure
  if (data.success && data.recipes) {
    return data.recipes;
  }
  
  // Fallback for direct array response
  return Array.isArray(data) ? data : [];
};

export const useRecipes = (householdId?: string) => {
  return useQuery({
    queryKey: ['recipes', householdId],
    queryFn: () => fetchRecipes(householdId!),
    enabled: !!householdId, // Only run query if householdId exists
    staleTime: 10 * 60 * 1000, // 10 minutes - recipes don't change very often
    gcTime: 30 * 60 * 1000, // 30 minutes in cache
  });
};
