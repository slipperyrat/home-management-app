'use client';

import { useAuth } from '@clerk/nextjs';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUserData } from '@/hooks/useUserData';
import { useRecipes, Recipe } from '@/hooks/useRecipes';
import { useMealPlan, useAssignMeal, useCopyWeek, useClearWeek, useAddWeekIngredients } from '@/hooks/useMealPlans';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';

export default function MealPlannerPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  
  // Data fetching hooks
  const { userData, isLoading: userDataLoading, error: userDataError, user } = useUserData();
  const { data: recipes, isLoading: recipesLoading, error: recipesError } = useRecipes();
  const recipesData = recipes as { success: boolean; data: { recipes: Recipe[] }; message: string; timestamp: string } | undefined;
  
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const weekStartDate = getWeekStart(currentWeek);
  const { data: mealPlan, isLoading: mealPlanLoading, error: mealPlanError } = useMealPlan(weekStartDate);
  
  // Debug logging
  console.log('🔍 Meal Planner Debug Info:', {
    userDataLoading,
    recipesLoading,
    mealPlanLoading,
    userData: userData ? { household_id: userData.household_id, has_onboarded: userData.has_onboarded } : null,
    recipesData: recipesData ? { success: recipesData.success, count: recipesData.data?.recipes?.length || 0 } : null,
    mealPlan: mealPlan ? { weekStart: weekStartDate, mealsCount: Object.keys(mealPlan.meals || {}).length } : null,
    weekStartDate: weekStartDate?.toISOString().split('T')[0], // Add this line
    currentWeek: currentWeek.toISOString().split('T')[0] // Add this line
  });
  
  // Additional debug logging for recipes
  console.log('🔍 Recipes Debug:', {
    recipesRaw: recipes,
    recipesData,
    recipesArray: recipesData?.data?.recipes,
    firstRecipe: recipesData?.data?.recipes?.[0],
    recipesDataKeys: recipesData ? Object.keys(recipesData) : null,
    recipesDataStructure: recipesData
  });
  
  // Loading and error states
  const loading = userDataLoading || recipesLoading || mealPlanLoading;
  const error = userDataError || recipesError || mealPlanError;
  
  // Check if user has completed onboarding
  const hasCompletedOnboarding = userData?.has_onboarded && userData?.household_id;
  
  // Local state
  const [activeTab, setActiveTab] = useState('planner');
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeFormData, setRecipeFormData] = useState({
    name: '',
    description: '',
    ingredients: '',
    instructions: '',
    prep_time: 0,
    cook_time: 0,
    servings: 1,
    tags: [] as string[]
  });
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);
  const [newTag, setNewTag] = useState('');

  // React Query mutations
  const assignMeal = useAssignMeal();
  const copyWeek = useCopyWeek();
  const clearWeek = useClearWeek();
  const addWeekIngredients = useAddWeekIngredients();

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

  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  function getWeekDays(): Date[] {
    const days: Date[] = [];
    const weekStart = getWeekStart(currentWeek);
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  }

  function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  function getDayName(date: Date): string {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dayIndex = date.getDay();
    const dayName = dayNames[dayIndex];
    
    if (!dayName) {
      throw new Error('Invalid day index');
    }
    
    return dayName;
  }

  function getMealForDay(date: string, mealType: 'breakfast' | 'lunch' | 'dinner'): Recipe | undefined {
    if (!mealPlan?.meals) return undefined;
    
    const dateObj = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const dayName = dayNames[dateObj.getDay()];
    
    if (!dayName) return undefined;
    
    const dayMeals = mealPlan.meals[dayName];
    if (!dayMeals) return undefined;
    
    const meal = dayMeals[mealType];
    
    if (typeof meal === 'string') {
      // If meal is a recipe ID, find the recipe in the recipes list
      return recipesData?.data?.recipes?.find(r => r.id === meal);
    }
    
    return meal as Recipe | undefined;
  }

  function assignRecipe(date: string, mealType: 'breakfast' | 'lunch' | 'dinner', recipe: Recipe) {
    if (!userData?.household_id) {
      toast.error('Please complete onboarding first');
      return;
    }
    
    try {
      const dateObj = new Date(date);
      const weekStart = getWeekStart(dateObj);
      const weekStartDate = weekStart.toISOString().split('T')[0];
      const dayName = getDayName(dateObj);

      if (!weekStartDate || !dayName) {
        toast.error('Invalid date format');
        return;
      }

      const assignmentData = {
        week: weekStartDate,
        day: dayName,
        slot: mealType,
        recipe_id: recipe.id,
        alsoAddToList: true,
        autoConfirm: false // Don't auto-confirm, let user review in shopping list
      };
      
      console.log('🔍 Sending meal assignment data:', assignmentData);
      assignMeal.mutate(assignmentData);
    } catch (error) {
      console.error('Error assigning recipe:', error);
      toast.error('Failed to assign recipe');
    }
  }

  async function createRecipe() {
    if (!userData?.household_id) {
      toast.error('Please complete onboarding first');
      return;
    }

    if (!recipeFormData.name.trim()) {
      toast.error('Recipe name is required');
      return;
    }

    setIsCreatingRecipe(true);
    try {
      // Import the CSRF utility
      const { fetchWithCSRF } = await import('@/lib/csrf-client');
      
      const response = await fetchWithCSRF('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...recipeFormData,
          title: recipeFormData.name, // Map name to title for API
          household_id: userData.household_id,
          created_by: user?.id || 'unknown'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('Recipe created successfully!');
          setShowRecipeForm(false);
          setRecipeFormData({
            name: '',
            description: '',
            ingredients: '',
            instructions: '',
            prep_time: 0,
            cook_time: 0,
            servings: 1,
            tags: []
          });
          // Refresh recipes data
          window.location.reload();
        } else {
          toast.error(result.error || 'Failed to create recipe');
        }
      } else {
        toast.error('Failed to create recipe');
      }
    } catch (error) {
      console.error('Error creating recipe:', error);
      toast.error('Failed to create recipe');
    } finally {
      setIsCreatingRecipe(false);
    }
  }

  function navigateWeek(direction: 'prev' | 'next') {
    const newWeek = new Date(currentWeek);
    if (direction === 'prev') {
      newWeek.setDate(newWeek.getDate() - 7);
    } else {
      newWeek.setDate(newWeek.getDate() + 7);
    }
    setCurrentWeek(newWeek);
  }

  // AI Functions
  const fetchAIInsights = async () => {
    try {
      setLoadingAI(true);
      const response = await fetch('/api/ai/meal-insights');
      if (response.ok) {
        const data = await response.json();
        setAiInsights(data.insights);
      }
    } catch (error) {
      console.error('Error fetching AI insights:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const fetchAISuggestions = async (mealType = 'dinner') => {
    try {
      setLoadingAI(true);
      const response = await fetch(`/api/ai/meal-suggestions?mealType=${mealType}`);
      if (response.ok) {
        const data = await response.json();
        setAiSuggestions(data);
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai-insights') {
      fetchAIInsights();
    } else if (activeTab === 'ai-suggestions') {
      fetchAISuggestions();
    }
  }, [activeTab]);

  function addTag() {
    if (newTag.trim() && !recipeFormData.tags.includes(newTag.trim())) {
      setRecipeFormData({
        ...recipeFormData,
        tags: [...recipeFormData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  }

  function removeTag(tagToRemove: string) {
    setRecipeFormData({
      ...recipeFormData,
      tags: recipeFormData.tags.filter(tag => tag !== tagToRemove)
    });
  }

  // Show loading spinner while auth is loading or data is being fetched
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading meal planner..." />
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
          error={error.message || 'Failed to load meal planner'} 
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
              You need to complete the onboarding process to access the meal planner.
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

  const weekDays = getWeekDays();

  // Final safety check - ensure user data is loaded
  if (!userData || !userData.household_id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading user data..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardHeader className="border-b border-gray-200">
            {/* Tab Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="planner">Meal Planner</TabsTrigger>
                <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
                <TabsTrigger value="ai-suggestions">AI Suggestions</TabsTrigger>
                <TabsTrigger value="recipes">Recipes</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Conditional Header Content */}
            {activeTab === 'planner' && (
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mt-4">
                <div>
                  <CardTitle className="text-xl sm:text-2xl">Smart Meal Planner</CardTitle>
                  <p className="text-sm sm:text-base text-gray-600">AI-powered meal planning with intelligent suggestions</p>
                </div>
                
                <div className="flex items-center space-x-4">
                  {/* Recipe Management Buttons */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setShowRecipeForm(!showRecipeForm)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      {showRecipeForm ? 'Hide Form' : 'Create Recipe'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/recipes')}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Manage Recipes
                    </Button>
                  </div>
                  
                  {/* Week Actions */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextWeek = new Date(currentWeek);
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        const nextWeekStart = getWeekStart(nextWeek).toISOString().split('T')[0];
                        const currentWeekStart = weekStartDate.toISOString().split('T')[0];
                        
                        const fromWeek = currentWeekStart;
                        const toWeek = nextWeekStart;
                        
                        if (fromWeek && toWeek) {
                          copyWeek.mutate({
                            fromWeek,
                            toWeek
                          });
                        }
                      }}
                      disabled={copyWeek.isPending}
                    >
                      {copyWeek.isPending ? 'Copying...' : 'Copy to Next Week'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentWeekStart = weekStartDate.toISOString().split('T')[0];
                        if (currentWeekStart) {
                          addWeekIngredients.mutate({ week_start_date: currentWeekStart });
                        }
                      }}
                      disabled={addWeekIngredients.isPending}
                      className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                    >
                      {addWeekIngredients.isPending ? 'Adding...' : '🛒 Add All to Shopping'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentWeekStart = weekStartDate.toISOString().split('T')[0];
                        if (currentWeekStart) {
                          clearWeek.mutate({ week: currentWeekStart });
                        }
                      }}
                      disabled={clearWeek.isPending}
                    >
                      {clearWeek.isPending ? 'Clearing...' : 'Clear Week'}
                    </Button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateWeek('prev')}
                      aria-label="Previous week"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </Button>
                    <span className="text-sm font-medium text-gray-900">
                      {weekDays[0] && formatDate(weekDays[0])} - {weekDays[6] && formatDate(weekDays[6])}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateWeek('next')}
                      aria-label="Next week"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai-insights' && (
              <div className="mt-4">
                <CardTitle className="text-xl sm:text-2xl">AI Meal Insights</CardTitle>
                <p className="text-sm sm:text-base text-gray-600">Intelligent analysis of your meal planning patterns</p>
              </div>
            )}

            {activeTab === 'ai-suggestions' && (
              <div className="mt-4">
                <CardTitle className="text-xl sm:text-2xl">AI Meal Suggestions</CardTitle>
                <p className="text-sm sm:text-base text-gray-600">Smart recipe recommendations based on your preferences</p>
              </div>
            )}

            {activeTab === 'recipes' && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl sm:text-2xl">Recipe Collection</CardTitle>
                    <p className="text-sm sm:text-base text-gray-600">Manage and organize your household recipes</p>
                  </div>
                  <Button
                    onClick={() => setShowRecipeForm(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    New Recipe
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {/* Conditional Content Based on Active Tab */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsContent value="planner" className="m-0">
                {/* Inline Recipe Creation Form */}
                {showRecipeForm && (
                  <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <div className="max-w-2xl mx-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Create New Recipe</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowRecipeForm(false)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Recipe Name *
                          </label>
                          <input
                            type="text"
                            value={recipeFormData.name}
                            onChange={(e) => setRecipeFormData({...recipeFormData, name: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Spaghetti Carbonara"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={recipeFormData.description}
                            onChange={(e) => setRecipeFormData({...recipeFormData, description: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Brief description of the recipe"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Prep Time (minutes)
                          </label>
                          <input
                            type="number"
                            value={recipeFormData.prep_time}
                            onChange={(e) => setRecipeFormData({...recipeFormData, prep_time: parseInt(e.target.value) || 0})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Cook Time (minutes)
                          </label>
                          <input
                            type="number"
                            value={recipeFormData.cook_time}
                            onChange={(e) => setRecipeFormData({...recipeFormData, cook_time: parseInt(e.target.value) || 0})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="0"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Servings
                          </label>
                          <input
                            type="number"
                            value={recipeFormData.servings}
                            onChange={(e) => setRecipeFormData({...recipeFormData, servings: parseInt(e.target.value) || 1})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            min="1"
                          />
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ingredients (one per line)
                        </label>
                        <textarea
                          value={recipeFormData.ingredients}
                          onChange={(e) => setRecipeFormData({...recipeFormData, ingredients: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          placeholder="2 cups flour&#10;1 cup sugar&#10;3 eggs&#10;1 tsp vanilla"
                        />
                      </div>
                      
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Instructions (one per line)
                        </label>
                        <textarea
                          value={recipeFormData.instructions}
                          onChange={(e) => setRecipeFormData({...recipeFormData, instructions: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          placeholder="Preheat oven to 350°F&#10;Mix dry ingredients&#10;Add wet ingredients&#10;Bake for 25 minutes"
                        />
                      </div>
                      
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tags
                        </label>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addTag()}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Add a tag (e.g., vegetarian, quick, dessert)"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addTag}
                            disabled={!newTag.trim()}
                          >
                            Add
                          </Button>
                        </div>
                        {recipeFormData.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {recipeFormData.tags.map((tag, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="px-2 py-1 text-sm"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeTag(tag)}
                                  className="ml-2 text-gray-500 hover:text-gray-700"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-6 flex justify-end space-x-3">
                        <Button
                          variant="outline"
                          onClick={() => setShowRecipeForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={createRecipe}
                          disabled={isCreatingRecipe || !recipeFormData.name.trim()}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isCreatingRecipe ? 'Creating...' : 'Create Recipe'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Weekly Grid */}
                <div className="hidden lg:block">
                  <div className="grid grid-cols-7 gap-4 p-6">
                    {weekDays.map((date, index) => (
                      <div key={index} className="space-y-2">
                        <div className="text-center">
                          <div className="text-sm font-medium text-gray-900">
                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>

                        {/* Breakfast */}
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-700">Breakfast</div>
                          <MealSlot
                            date={date.toISOString().split('T')[0] || ''}
                            mealType="breakfast"
                            recipe={getMealForDay(date.toISOString().split('T')[0] || '', 'breakfast') || undefined}
                            onAssign={(recipe) => assignRecipe(date.toISOString().split('T')[0] || '', 'breakfast', recipe)}
                            recipes={recipesData?.data?.recipes || []}
                            onCreateRecipe={() => router.push('/recipes/create')}
                          />
                        </div>

                        {/* Lunch */}
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-700">Lunch</div>
                          <MealSlot
                            date={date.toISOString().split('T')[0] || ''}
                            mealType="lunch"
                            recipe={getMealForDay(date.toISOString().split('T')[0] || '', 'lunch') || undefined}
                            onAssign={(recipe) => assignRecipe(date.toISOString().split('T')[0] || '', 'lunch', recipe)}
                            recipes={recipesData?.data?.recipes || []}
                            onCreateRecipe={() => router.push('/recipes/create')}
                          />
                        </div>

                        {/* Dinner */}
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-700">Dinner</div>
                          <MealSlot
                            date={date.toISOString().split('T')[0] || ''}
                            mealType="dinner"
                            recipe={getMealForDay(date.toISOString().split('T')[0] || '', 'dinner') || undefined}
                            onAssign={(recipe) => assignRecipe(date.toISOString().split('T')[0] || '', 'dinner', recipe)}
                            recipes={recipesData?.data?.recipes || []}
                            onCreateRecipe={() => router.push('/recipes/create')}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile/Tablet Layout - Stacked cards */}
                <div className="lg:hidden">
                  <div className="space-y-4 p-4">
                    {weekDays.map((date, index) => (
                      <Card key={index} className="bg-gray-50">
                        <CardContent className="p-4">
                          <div className="text-center mb-4">
                            <div className="text-lg font-semibold text-gray-900">
                              {date.toLocaleDateString('en-US', { weekday: 'long' })}
                            </div>
                            <div className="text-sm text-gray-500">
                              {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Breakfast */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-gray-700 text-center">🌅 Breakfast</div>
                              <MealSlot
                                date={date.toISOString().split('T')[0] || ''}
                                mealType="breakfast"
                                recipe={getMealForDay(date.toISOString().split('T')[0] || '', 'breakfast') || undefined}
                                onAssign={(recipe) => assignRecipe(date.toISOString().split('T')[0] || '', 'breakfast', recipe)}
                                recipes={recipesData?.data?.recipes || []}
                                isMobile={true}
                                onCreateRecipe={() => router.push('/recipes/create')}
                              />
                            </div>

                            {/* Lunch */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-gray-700 text-center">☀️ Lunch</div>
                              <MealSlot
                                date={date.toISOString().split('T')[0] || ''}
                                mealType="lunch"
                                recipe={getMealForDay(date.toISOString().split('T')[0] || '', 'lunch') || undefined}
                                onAssign={(recipe) => assignRecipe(date.toISOString().split('T')[0] || '', 'lunch', recipe)}
                                recipes={recipesData?.data?.recipes || []}
                                isMobile={true}
                                onCreateRecipe={() => router.push('/recipes/create')}
                              />
                            </div>

                            {/* Dinner */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-gray-700 text-center">🌙 Dinner</div>
                              <MealSlot
                                date={date.toISOString().split('T')[0] || ''}
                                mealType="dinner"
                                recipe={getMealForDay(date.toISOString().split('T')[0] || '', 'dinner') || undefined}
                                onAssign={(recipe) => assignRecipe(date.toISOString().split('T')[0] || '', 'dinner', recipe)}
                                recipes={recipesData?.data?.recipes || []}
                                isMobile={true}
                                onCreateRecipe={() => router.push('/recipes/create')}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* AI Insights Tab */}
              <TabsContent value="ai-insights" className="m-0">
                <div className="p-6">
                  {loadingAI ? (
                    <div className="flex items-center justify-center py-12">
                      <LoadingSpinner size="md" text="Loading AI insights..." />
                    </div>
                  ) : aiInsights ? (
                    <div className="space-y-6">
                      {/* AI Insights Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-gray-500">Weeks Planned</h3>
                              <span className="text-2xl font-bold text-green-600">{aiInsights.total_weeks_planned}</span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-gray-500">Planning Consistency</h3>
                              <span className="text-2xl font-bold text-blue-600">{aiInsights.planning_consistency}%</span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-gray-500">AI Learning</h3>
                              <span className="text-2xl font-bold text-purple-600">{aiInsights.ai_learning_progress}%</span>
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-gray-500">Avg Meals/Week</h3>
                              <span className="text-2xl font-bold text-orange-600">{aiInsights.household_preferences.average_meals_per_week}</span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Popular Recipes */}
                      {aiInsights.popular_recipes && aiInsights.popular_recipes.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Most Popular Recipes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {aiInsights.popular_recipes.map((recipe: any, index: number) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div>
                                    <h4 className="font-medium text-gray-900">{recipe.name}</h4>
                                    <p className="text-sm text-gray-500">Used {recipe.usage_count} times</p>
                                  </div>
                                  <Badge variant="secondary">{recipe.category}</Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Seasonal Recommendations */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Seasonal Recommendations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">Current Season:</span>
                              <Badge variant="outline" className="capitalize">
                                {aiInsights.seasonal_recommendations.current_season}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-gray-700">Focus on:</h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                                {aiInsights.seasonal_recommendations.recommendations.map((rec: string, index: number) => (
                                  <li key={index}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Improvement Suggestions */}
                      {aiInsights.suggested_improvements && aiInsights.suggested_improvements.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle>AI Suggestions for Improvement</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {aiInsights.suggested_improvements.map((suggestion: string, index: number) => (
                                <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                                  <span className="text-blue-500 mt-1">💡</span>
                                  <p className="text-sm text-blue-800">{suggestion}</p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-6xl mb-4">🤖</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Insights Available</h3>
                      <p className="text-gray-500">Start planning meals to generate AI insights and recommendations.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* AI Suggestions Tab */}
              <TabsContent value="ai-suggestions" className="m-0">
                <div className="p-6">
                  {loadingAI ? (
                    <div className="flex items-center justify-center py-12">
                      <LoadingSpinner size="md" text="Loading AI suggestions..." />
                    </div>
                  ) : aiSuggestions ? (
                    <div className="space-y-6">
                      {/* Meal Type Filter */}
                      <div className="flex space-x-4 mb-6">
                        {['breakfast', 'lunch', 'dinner'].map((mealType) => (
                          <Button
                            key={mealType}
                            variant={aiSuggestions.suggestions?.[0]?.mealType === mealType ? "default" : "outline"}
                            onClick={() => fetchAISuggestions(mealType)}
                            className="capitalize"
                          >
                            {mealType}
                          </Button>
                        ))}
                      </div>

                      {/* AI Confidence */}
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-800">AI Confidence</span>
                            <span className="text-sm font-medium text-blue-600">{aiSuggestions.ai_confidence}%</span>
                          </div>
                          <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                              style={{ width: `${aiSuggestions.ai_confidence}%` }}
                            ></div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Recipe Suggestions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {aiSuggestions.suggestions?.map((recipe: any, index: number) => (
                          <Card key={index} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                              <div className="flex items-start justify-between">
                                <CardTitle className="text-lg">{recipe.name}</CardTitle>
                                <Badge variant="secondary">Score: {recipe.ai_score}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm text-gray-600 mb-4">{recipe.description}</p>
                              <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Prep Time:</span>
                                  <span className="text-gray-700">{recipe.prep_time} min</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Cook Time:</span>
                                  <span className="text-gray-700">{recipe.cook_time} min</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Servings:</span>
                                  <span className="text-gray-700">{recipe.servings}</span>
                                </div>
                              </div>
                              <div className="mb-4">
                                <p className="text-xs text-green-600 font-medium mb-1">AI Reasoning:</p>
                                <p className="text-xs text-gray-600">{recipe.ai_reasoning}</p>
                              </div>
                              <div className="flex flex-wrap gap-2 mb-4">
                                {recipe.tags.map((tag: string, tagIndex: number) => (
                                  <Badge key={tagIndex} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              <Button
                                onClick={() => {
                                  // Create a recipe object that matches the Recipe interface
                                  const recipeToAssign: Recipe = {
                                    id: recipe.id || `ai-${Date.now()}`,
                                    name: recipe.name,
                                    description: recipe.description,
                                    prep_time: recipe.prep_time || 0,
                                    cook_time: recipe.cook_time || 0,
                                    servings: recipe.servings || 1,
                                    ingredients: recipe.ingredients || [],
                                    instructions: recipe.instructions || [],
                                    tags: recipe.tags || [],
                                    difficulty: recipe.difficulty || 'medium',
                                    is_favorite: false,
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                    household_id: userData?.household_id || '',
                                    created_by: user?.id || ''
                                  };
                                  
                                  // Assign to today's dinner by default
                                  const today = new Date();
                                  const todayString = today.toISOString().split('T')[0] as string;
                                  assignRecipe(todayString, 'dinner', recipeToAssign);
                                  toast.success(`Assigned "${recipe.name}" to today's dinner!`);
                                }}
                                className="w-full"
                              >
                                Use This Recipe
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* AI Insights */}
                      {aiSuggestions.insights && (
                        <Card>
                          <CardHeader>
                            <CardTitle>AI Insights</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium text-gray-700 mb-2">Meal Type Optimization</h4>
                                <p className="text-sm text-gray-600">{aiSuggestions.insights.meal_type_optimization}</p>
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-700 mb-2">Seasonal Tips</h4>
                                <p className="text-sm text-gray-600">{aiSuggestions.insights.seasonal_tips}</p>
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-700 mb-2">Nutritional Balance</h4>
                                <p className="text-sm text-gray-600">{aiSuggestions.insights.nutritional_balance}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-6xl mb-4">🤖</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Suggestions Available</h3>
                      <p className="text-gray-500">Start planning meals to receive AI-powered recipe recommendations.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Recipes Tab */}
              <TabsContent value="recipes" className="m-0">
                <div className="p-6">
                  {recipesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <LoadingSpinner size="md" text="Loading recipes..." />
                    </div>
                  ) : recipesError ? (
                    <ErrorDisplay error={recipesError} />
                  ) : recipesData?.data?.recipes && recipesData.data.recipes.length > 0 ? (
                    <div className="space-y-6">
                      {/* Recipe Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-blue-600">{recipesData.data.recipes.length}</div>
                            <div className="text-sm text-gray-600">Total Recipes</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {recipesData.data.recipes.filter(r => r.tags?.includes('quick')).length}
                            </div>
                            <div className="text-sm text-gray-600">Quick Meals</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {recipesData.data.recipes.filter(r => r.tags?.includes('vegetarian')).length}
                            </div>
                            <div className="text-sm text-gray-600">Vegetarian</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-orange-600">
                              {Math.round(recipesData.data.recipes.reduce((acc, r) => acc + (r.prep_time + r.cook_time), 0) / recipesData.data.recipes.length)}
                            </div>
                            <div className="text-sm text-gray-600">Avg Time (min)</div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Recipes Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recipesData.data.recipes.map((recipe) => (
                          <Card key={recipe.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <CardTitle className="text-lg line-clamp-2">{recipe.name}</CardTitle>
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
                                    onClick={() => router.push(`/recipes/${recipe.id}/edit`)}
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
                                    onClick={async () => {
                                      if (!confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
                                        return;
                                      }

                                      try {
                                        const response = await fetch(`/api/recipes/${recipe.id}`, {
                                          method: 'DELETE',
                                        });

                                        if (response.ok) {
                                          toast.success('Recipe deleted successfully!');
                                          // Refresh the page to update the recipes list
                                          window.location.reload();
                                        } else {
                                          toast.error('Failed to delete recipe');
                                        }
                                      } catch (error) {
                                        console.error('Error deleting recipe:', error);
                                        toast.error('Failed to delete recipe');
                                      }
                                    }}
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
                        <Button
                          onClick={() => setShowRecipeForm(true)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Create Your First Recipe
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// MealSlot Component
interface MealSlotProps {
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  recipe: Recipe | undefined;
  onAssign: (recipe: Recipe) => void;
  recipes: Recipe[];
  isMobile?: boolean;
  onCreateRecipe: () => void;
}

function MealSlot({ date: _date, mealType: _mealType, recipe, onAssign, recipes, isMobile = false, onCreateRecipe }: MealSlotProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="relative">
      {recipe ? (
        <div className={`bg-green-50 border border-green-200 rounded-md cursor-pointer hover:bg-green-100 ${isMobile ? 'p-3' : 'p-2'}`}>
          <div className={`font-medium text-green-800 truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>
            {recipe.name}
          </div>
          <div className={`text-green-600 ${isMobile ? 'text-xs' : 'text-xs'}`}>
            {recipe.prep_time + recipe.cook_time}min
          </div>
          {/* Show tags if available */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {recipe.tags.slice(0, 2).map((tag, index) => (
                <span key={index} className="text-xs bg-green-200 text-green-700 px-1 py-0.5 rounded">
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 2 && (
                <span className="text-xs bg-green-200 text-green-700 px-1 py-0.5 rounded">
                  +{recipe.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <Button
          variant="outline"
          size={isMobile ? "default" : "sm"}
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full justify-start text-gray-500 hover:text-gray-700"
        >
          + Add Recipe
        </Button>
      )}

      {showDropdown && (
        <div className={`absolute z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg ${isMobile ? 'w-72 left-0 right-0' : 'w-64'}`}>
          <div className="p-3">
            <div className={`font-medium text-gray-700 mb-3 ${isMobile ? 'text-sm' : 'text-xs'}`}>
              Select Recipe
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {recipes.length === 0 ? (
                <div className={`p-3 text-gray-500 text-center ${isMobile ? 'text-sm' : 'text-xs'}`}>
                  <div>No recipes yet!</div>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setShowDropdown(false);
                      onCreateRecipe();
                    }}
                    className="mt-2 p-0 h-auto text-blue-600 hover:text-blue-800"
                  >
                    Create your first recipe
                  </Button>
                </div>
              ) : (
                recipes.map((recipe) => (
                  <Button
                    key={recipe.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onAssign(recipe);
                      setShowDropdown(false);
                    }}
                    className="w-full justify-start hover:bg-gray-50 text-left"
                  >
                    <div className="w-full">
                      <div className={`font-medium text-gray-900 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                        {recipe.name}
                      </div>
                      <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                        {recipe.prep_time + recipe.cook_time}min • {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}
                      </div>
                      {/* Show tags in dropdown */}
                      {recipe.tags && recipe.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {recipe.tags.slice(0, 3).map((tag, index) => (
                            <span key={index} className="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                          {recipe.tags.length > 3 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1 py-0.5 rounded">
                              +{recipe.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
