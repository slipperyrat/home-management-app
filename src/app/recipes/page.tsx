'use client';

import { useAuth } from '@clerk/nextjs';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUserData } from '@/hooks/useUserData';
import { useRecipes, Recipe } from '@/hooks/useRecipes';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

export default function RecipesPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  
  // Data fetching hooks
  const { userData, isLoading: userDataLoading, error: userDataError } = useUserData();
  const { data: recipes, isLoading: recipesLoading, error: recipesError, refetch } = useRecipes();
  const recipesData = recipes as { success: boolean; recipes: Recipe[] } | undefined;
  
  // Loading and error states
  const loading = userDataLoading || recipesLoading;
  const error = userDataError || recipesError;
  
  // Check if user has completed onboarding
  const hasCompletedOnboarding = userData?.has_onboarded && userData?.household_id;

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    
    if (isSignedIn && !loading && !hasCompletedOnboarding) {
      router.push('/onboarding');
      return;
    }
  }, [isLoaded, isSignedIn, loading, hasCompletedOnboarding, router]);

  // Show loading spinner while auth is loading or data is being fetched
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading recipes..." />
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorDisplay 
          error={error.message || 'Failed to load recipes'} 
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // Check if user has completed onboarding
  if (!hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <div className="text-blue-500 text-6xl mb-4">🏠</div>
            <CardTitle>Complete Onboarding First</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              You need to complete the onboarding process to access recipes.
            </p>
            <Button 
              onClick={() => router.push('/onboarding')}
              className="w-full"
            >
              Go to Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Final safety check - ensure user data is loaded
  if (!userData || !userData.household_id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading user data..." />
      </div>
    );
  }

  const handleCreateRecipe = () => {
    router.push('/recipes/create');
  };

  const handleBackToMealPlanner = () => {
    router.push('/meal-planner');
  };

  const handleEditRecipe = (_recipeId: string) => {
    // For now, just show a toast. You can implement edit functionality later
    toast.info('Edit functionality coming soon!');
  };

  const handleDeleteRecipe = async (recipeId: string) => {
    if (!confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Recipe deleted successfully!');
        refetch(); // Refresh the recipes list
      } else {
        toast.error('Failed to delete recipe');
      }
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast.error('Failed to delete recipe');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Recipes</h1>
              <p className="text-gray-600 mt-2">Manage and organize your recipe collection</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={handleBackToMealPlanner}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Meal Planner
              </Button>
              <Button
                onClick={handleCreateRecipe}
                className="bg-green-600 hover:bg-green-700"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create New Recipe
              </Button>
            </div>
          </div>
        </div>

        {/* Recipes Grid */}
        {recipesData?.recipes && recipesData.recipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recipesData.recipes.map((recipe) => (
              <Card key={recipe.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-2">{recipe.title || recipe.name}</CardTitle>
                    <div className="flex items-center space-x-1">
                      <Badge variant="secondary" className="text-xs">
                        {recipe.difficulty || 'Easy'}
                      </Badge>
                    </div>
                  </div>
                  {recipe.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{recipe.description}</p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {/* Recipe Stats */}
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                      <div className="text-center">
                        <div className="font-medium text-gray-900">{recipe.prep_time || 0}</div>
                        <div>Prep (min)</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-900">{recipe.cook_time || 0}</div>
                        <div>Cook (min)</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-900">{recipe.servings || 1}</div>
                        <div>Servings</div>
                      </div>
                    </div>

                    {/* Tags */}
                    {recipe.tags && recipe.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {recipe.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {recipe.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{recipe.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRecipe(recipe.id)}
                        className="flex-1"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRecipe(recipe.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Empty State */
          <Card className="text-center py-12">
            <CardContent>
              <div className="text-gray-400 text-6xl mb-4">🍽️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Recipes Yet</h3>
              <p className="text-gray-500 mb-6">
                Start building your recipe collection to make meal planning easier.
              </p>
              <div className="flex items-center justify-center space-x-4">
                <Button
                  onClick={handleCreateRecipe}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Your First Recipe
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBackToMealPlanner}
                >
                  Back to Meal Planner
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
