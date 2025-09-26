'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/config';

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

export interface CreateRecipeData {
  name: string;
  description?: string;
  prep_time: number;
  cook_time: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  image_url?: string;
  tags: string[];
  ingredients: Omit<RecipeIngredient, 'id' | 'recipe_id'>[];
  instructions: Omit<RecipeInstruction, 'id' | 'recipe_id'>[];
  household_id: string;
}

export interface UpdateRecipeData extends Partial<CreateRecipeData> {
  id: string;
}

// API functions
async function fetchRecipes(): Promise<{ success: boolean; data: { recipes: Recipe[] } }> {
  const response = await fetch('/api/recipes');
  if (!response.ok) {
    throw new Error('Failed to fetch recipes');
  }
  return response.json();
}

async function fetchRecipe(recipeId: string): Promise<{ success: boolean; recipe: Recipe }> {
  const response = await fetch(`/api/recipes/${recipeId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch recipe');
  }
  return response.json();
}

async function fetchRecipesByTag(tag: string): Promise<{ success: boolean; data: { recipes: Recipe[] } }> {
  const response = await fetch(`/api/recipes?tag=${encodeURIComponent(tag)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch recipes by tag');
  }
  return response.json();
}

async function fetchFavoriteRecipes(): Promise<{ success: boolean; data: { recipes: Recipe[] } }> {
  const response = await fetch('/api/recipes?favorites=true');
  if (!response.ok) {
    throw new Error('Failed to fetch favorite recipes');
  }
  return response.json();
}

async function createRecipe(data: CreateRecipeData): Promise<{ success: boolean; recipe: Recipe }> {
  const response = await fetch('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create recipe');
  }
  return response.json();
}

async function updateRecipe(data: UpdateRecipeData): Promise<{ success: boolean; recipe: Recipe }> {
  const response = await fetch(`/api/recipes/${data.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update recipe');
  }
  return response.json();
}

async function deleteRecipe(recipeId: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/recipes/${recipeId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete recipe');
  }
  return response.json();
}

async function toggleFavorite(recipeId: string): Promise<{ success: boolean; is_favorite: boolean }> {
  const response = await fetch(`/api/recipes/${recipeId}/favorite`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error('Failed to toggle favorite');
  }
  return response.json();
}

// Custom hooks
export function useRecipes() {
  return useQuery({
    queryKey: queryKeys.recipes.all,
    queryFn: fetchRecipes,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useRecipe(recipeId: string) {
  return useQuery({
    queryKey: queryKeys.recipes.byId(recipeId),
    queryFn: () => fetchRecipe(recipeId),
    enabled: !!recipeId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRecipesByTag(tag: string) {
  return useQuery({
    queryKey: queryKeys.recipes.byTag(tag),
    queryFn: () => fetchRecipesByTag(tag),
    enabled: !!tag,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useFavoriteRecipes() {
  return useQuery({
    queryKey: queryKeys.recipes.favorites,
    queryFn: fetchFavoriteRecipes,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createRecipe,
    onSuccess: (data) => {
      // Invalidate and refetch recipes
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
      
      // Add the new recipe to cache
      queryClient.setQueryData(
        queryKeys.recipes.byId(data.data.recipe.id),
        { success: true, recipe: data.data.recipe }
      );
    },
    onError: (error) => {
      console.error('Failed to create recipe:', error);
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateRecipe,
    onSuccess: (data) => {
      // Update the specific recipe in cache
      queryClient.setQueryData(
        queryKeys.recipes.byId(data.data.recipe.id),
        { success: true, recipe: data.data.recipe }
      );
      
      // Invalidate the list to reflect changes
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
      
      // Invalidate tag-based queries that might include this recipe
      queryClient.invalidateQueries({ queryKey: ['recipes', 'tag'] });
    },
    onError: (error) => {
      console.error('Failed to update recipe:', error);
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteRecipe,
    onSuccess: (_, recipeId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.recipes.byId(recipeId) });
      
      // Invalidate and refetch recipes list
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
      
      // Invalidate tag-based queries
      queryClient.invalidateQueries({ queryKey: ['recipes', 'tag'] });
      
      // Invalidate favorites if it was a favorite
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.favorites });
    },
    onError: (error) => {
      console.error('Failed to delete recipe:', error);
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: toggleFavorite,
    onSuccess: (data, recipeId) => {
      // Update the recipe in cache
      queryClient.setQueryData(
        queryKeys.recipes.byId(recipeId),
        (oldData: any) => ({
          ...oldData,
          recipe: { ...oldData.recipe, is_favorite: data.is_favorite },
        })
      );
      
      // Invalidate favorites list
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.favorites });
      
      // Invalidate the main recipes list
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
    },
    onError: (error) => {
      console.error('Failed to toggle favorite:', error);
    },
  });
}

// Optimistic updates hook
export function useOptimisticRecipes() {
  const queryClient = useQueryClient();
  
  const addOptimisticRecipe = (recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticRecipe: Recipe = {
      ...recipe,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    queryClient.setQueryData(
      queryKeys.recipes.all,
      (oldData: any) => ({
        ...oldData,
        data: {
          ...oldData?.data,
          recipes: [optimisticRecipe, ...(oldData?.data?.recipes || [])],
        },
      })
    );
    
    return tempId;
  };
  
  const removeOptimisticRecipe = (tempId: string) => {
    queryClient.setQueryData(
      queryKeys.recipes.all,
      (oldData: any) => ({
        ...oldData,
        data: {
          ...oldData?.data,
          recipes: (oldData?.data?.recipes || []).filter((r: Recipe) => r.id !== tempId),
        },
      })
    );
  };
  
  return { addOptimisticRecipe, removeOptimisticRecipe };
}
