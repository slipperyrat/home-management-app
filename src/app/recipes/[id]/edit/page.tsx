'use client';

import { useAuth } from '@clerk/nextjs';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useRecipes, Recipe } from '@/hooks/useRecipes';

export default function EditRecipePage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const params = useParams();
  const recipeId = params.id as string;
  
  const { data: recipes, isLoading: recipesLoading, error: recipesError } = useRecipes();
  const recipesData = recipes as { success: boolean; recipes: Recipe[] } | undefined;
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prep_time: 0,
    cook_time: 0,
    servings: 1,
    ingredients: '',
    instructions: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Find the recipe to edit
  const recipe = recipesData?.recipes?.find(r => r.id === recipeId);

  useEffect(() => {
    if (recipe) {
      setFormData({
        title: recipe.name || '',
        description: recipe.description || '',
        prep_time: recipe.prep_time || 0,
        cook_time: recipe.cook_time || 0,
        servings: recipe.servings || 1,
        ingredients: Array.isArray(recipe.ingredients) 
          ? recipe.ingredients.map((ing: any) => 
              `${ing.amount || ''} ${ing.unit || ''} ${ing.name || ''}`.trim()
            ).join('\n')
          : '',
        instructions: Array.isArray(recipe.instructions) 
          ? recipe.instructions.join('\n')
          : ''
      });
      setIsLoading(false);
    } else if (recipesData && !recipesLoading) {
      // Recipe not found
      toast.error('Recipe not found');
      router.push('/recipes');
    }
  }, [recipe, recipesData, recipesLoading, router]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    router.push('/sign-in');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Recipe Not Found</h1>
          <p className="text-gray-600 mb-6">The recipe you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => router.push('/recipes')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Recipes
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Format ingredients and instructions properly
      const formattedData = {
        ...formData,
        ingredients: formData.ingredients.trim(),
        instructions: formData.instructions.trim()
      };

      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('Recipe updated successfully!');
          router.push('/recipes');
        } else {
          toast.error(`Failed to update recipe: ${result.error || 'Unknown error'}`);
        }
      } else {
        const error = await response.json();
        toast.error(`Failed to update recipe: ${error.error || error.message || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Failed to update recipe. Please try again.');
      console.error('Error updating recipe:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'prep_time' || name === 'cook_time' || name === 'servings' 
        ? parseInt(value) || 0 
        : value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Edit Recipe</h1>
                <p className="text-gray-600">Update your recipe details</p>
              </div>
              <button
                onClick={() => router.back()}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Recipe Name */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Recipe Name *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter recipe name"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief description of the recipe"
              />
            </div>

            {/* Time and Servings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="prep_time" className="block text-sm font-medium text-gray-700 mb-2">
                  Prep Time (min)
                </label>
                <input
                  type="number"
                  id="prep_time"
                  name="prep_time"
                  min="0"
                  value={formData.prep_time}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="cook_time" className="block text-sm font-medium text-gray-700 mb-2">
                  Cook Time (min)
                </label>
                <input
                  type="number"
                  id="cook_time"
                  name="cook_time"
                  min="0"
                  value={formData.cook_time}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="servings" className="block text-sm font-medium text-gray-700 mb-2">
                  Servings
                </label>
                <input
                  type="number"
                  id="servings"
                  name="servings"
                  min="1"
                  value={formData.servings}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <label htmlFor="ingredients" className="block text-sm font-medium text-gray-700 mb-2">
                Ingredients *
              </label>
              <textarea
                id="ingredients"
                name="ingredients"
                rows={4}
                required
                value={formData.ingredients}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="List ingredients, one per line or separated by commas"
              />
            </div>

            {/* Instructions */}
            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-2">
                Instructions *
              </label>
              <textarea
                id="instructions"
                name="instructions"
                rows={6}
                required
                value={formData.instructions}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Step-by-step cooking instructions"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating...' : 'Update Recipe'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
