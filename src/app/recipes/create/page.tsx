'use client';

import { useAuth } from '@clerk/nextjs';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function CreateRecipePage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prep_time: 0,
    cook_time: 0,
    servings: 1,
    ingredients: '',
    instructions: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Recipe created successfully!');
        router.push('/meal-planner');
      } else {
        const error = await response.json();
        toast.error(`Failed to create recipe: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Failed to create recipe. Please try again.');
      console.error('Error creating recipe:', error);
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
                <h1 className="text-2xl font-bold text-gray-900">Create New Recipe</h1>
                <p className="text-gray-600">Add a new recipe to your collection</p>
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
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Recipe Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
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
                {isSubmitting ? 'Creating...' : 'Create Recipe'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
