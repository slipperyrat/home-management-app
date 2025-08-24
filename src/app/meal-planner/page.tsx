'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUserData } from '@/hooks/useUserData';
import { useRecipes, Recipe, RecipeIngredient, RecipeInstruction } from '@/hooks/useRecipes';
import { useMealPlan } from '@/hooks/useMealPlan';
import { useMutation, useQueryClient } from '@tanstack/react-query';
// import { FeatureErrorBoundary } from '@/components/ErrorBoundary'; // This component was removed



export default function MealPlannerPage() {
  const { isSignedIn, isLoaded } = useAuth();

  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Use React Query hooks for data fetching
  const { userData, isLoading: userDataLoading, error: userDataError } = useUserData();
  const { data: recipes, isLoading: recipesLoading, error: recipesError } = useRecipes();
  const recipesData = recipes as { success: boolean; recipes: Recipe[] } | undefined;
  
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const weekStartDate = getWeekStart(currentWeek);
  const { data: mealPlan, isLoading: mealPlanLoading, error: mealPlanError } = useMealPlan(weekStartDate);
  


  // Data loading states
  const loading = userDataLoading || recipesLoading || mealPlanLoading;
  const error = userDataError || recipesError || mealPlanError;
  
  // Check if user has completed onboarding
  const hasCompletedOnboarding = userData?.has_onboarded && userData?.household_id;
  
  const [selectedRecipe] = useState<Recipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showCreateRecipeModal, setShowCreateRecipeModal] = useState(false);
  const [activeTab, setActiveTab] = useState('planner');
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // React Query mutations
  const assignRecipeMutation = useMutation({
    mutationFn: async ({ date, mealType, recipe }: { date: string; mealType: 'breakfast' | 'lunch' | 'dinner'; recipe: Recipe }) => {
      const dateObj = new Date(date);
      const weekStart = getWeekStart(dateObj);
      const weekStartDate = weekStart.toISOString().split('T')[0];
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dateObj.getDay()];

      const response = await fetch('/api/meal-planner/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week: weekStartDate,
          day: dayName,
          slot: mealType,
          recipe_id: recipe.id,
          alsoAddToList: true
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to assign recipe: ${response.status}`);
      }

      return response.json();
    },
          onSuccess: (result, _variables) => {
        // Invalidate the specific meal plan query to refetch data
        const weekStartString = weekStartDate.toISOString().split('T')[0];

        // Invalidate both the specific query and refetch immediately
        queryClient.invalidateQueries({
          queryKey: ['mealPlan', weekStartString]
        });

        // Also invalidate all meal plan queries to ensure consistency
        queryClient.invalidateQueries({
          queryKey: ['mealPlan']
        });

      // Show toast notification for ingredient sync
      if (result.ingredients) {
        const { added = 0, updated = 0 } = result.ingredients;
        
        if (added > 0 || updated > 0) {
          let message = '';
          if (added > 0 && updated > 0) {
            message = `Added ${added} items • Merged ${updated} items`;
          } else if (added > 0) {
            message = `Added ${added} items`;
          } else if (updated > 0) {
            message = `Merged ${updated} items`;
          }
          
          toast.success(message, {
            action: {
              label: 'View List',
              onClick: () => router.push('/shopping-lists')
            },
            duration: 5000
          });
        }
      }
    },
    onError: (error) => {
      toast.error(`Failed to assign recipe: ${error.message}`);
    },
  });



  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    
    // Check if user needs to complete onboarding
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

  function getMealForDay(date: string, mealType: 'breakfast' | 'lunch' | 'dinner'): Recipe | undefined {
    if (!mealPlan?.meals) return undefined;
    
    // Convert date to day name
    const dateObj = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dateObj.getDay()];
    
    if (!dayName) return undefined;
    
    const dayMeals = mealPlan.meals[dayName];
    if (!dayMeals) return undefined;
    
    const meal = dayMeals[mealType];
    
    // If meal is a string (recipe ID), we need to find the recipe object
    if (typeof meal === 'string') {
      return recipesData?.recipes?.find(r => r.id === meal);
    }
    
    return meal as Recipe | undefined;
  }

  function assignRecipe(date: string, mealType: 'breakfast' | 'lunch' | 'dinner', recipe: Recipe) {
    console.log('🔍 Assigning recipe:', { date, mealType, recipe, userData });
    
    if (!userData?.household_id) {
      console.error('❌ No household_id available:', userData);
      toast.error('Please complete onboarding first');
      return;
    }
    
    assignRecipeMutation.mutate({ date, mealType, recipe });
  }

  async function addToGroceryList(recipe: Recipe) {
    if (!userData?.household?.id) return;

    try {
      const response = await fetch('/api/shopping-lists/add-recipe-ingredients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipe_id: recipe.id
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const { added = 0, updated = 0 } = result;
        
        let message = '';
        if (added > 0 && updated > 0) {
          message = `Added ${added} items • Merged ${updated} items`;
        } else if (added > 0) {
          message = `Added ${added} items`;
        } else if (updated > 0) {
          message = `Merged ${updated} items`;
        } else {
          message = 'No changes';
        }
        
        // Only show toast with action if there were changes
        if (added > 0 || updated > 0) {
          toast.success(message, {
            action: {
              label: 'View List',
              onClick: () => router.push('/shopping-lists')
            },
            duration: 5000
          });
        } else {
          toast.info(message);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(`Failed to add ingredients: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error adding ingredients to grocery list:', err);
      toast.error('Failed to add ingredients. Please try again.');
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

  // Copy last week mutation
  const copyLastWeekMutation = useMutation({
    mutationFn: async () => {
      // Calculate from (last Monday) and to (current Monday) dates
      const currentMonday = getWeekStart(currentWeek);
      const lastMonday = new Date(currentMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);

      const from = lastMonday.toISOString().split('T')[0]; // YYYY-MM-DD
      const to = currentMonday.toISOString().split('T')[0]; // YYYY-MM-DD

      const response = await fetch('/api/meal-planner/copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          overwrite: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 404) {
          throw new Error('NO_PLAN_FOUND');
        }
        throw new Error(errorData.error || 'Failed to copy meal plan');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate and refetch the meal plan using the correct query key format
      const weekStartString = weekStartDate.toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: ['mealPlan', weekStartString] });
      
      // Also invalidate all meal plan queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
      
      if (data.plan) {
        toast.success("Copied last week's plan");
      } else {
        toast.info("No plan found last week to copy");
      }
    },
    onError: (error: Error) => {
      if (error.message === 'NO_PLAN_FOUND') {
        toast.info("No plan found last week to copy");
      } else {
        toast.error(error.message || 'Failed to copy meal plan');
      }
    },
  });

  function copyLastWeek() {
    copyLastWeekMutation.mutate();
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

  // Show loading spinner while auth is loading or data is being fetched
  if (!isLoaded || loading) {
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
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white shadow rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <button 
              onClick={() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has completed onboarding
  if (!hasCompletedOnboarding) {
    console.log('🔍 Onboarding check failed:', { 
      hasOnboarded: userData?.has_onboarded, 
      householdId: userData?.household_id,
      userData 
    });
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white shadow rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-blue-500 text-6xl mb-4">🏠</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Complete Onboarding First</h1>
            <p className="text-gray-600 mb-4">
              You need to complete the onboarding process to access the meal planner.
            </p>
            <button 
              onClick={() => router.push('/onboarding')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Go to Onboarding
            </button>
          </div>
        </div>
      </div>
    );
  }

  const weekDays = getWeekDays();

  // Final safety check - ensure user data is loaded
  if (!userData || !userData.household_id) {
    console.log('🔍 Final safety check failed:', { userData });
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            {/* Tab Navigation */}
            <div className="flex space-x-8 mb-4">
              <button
                onClick={() => setActiveTab('planner')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'planner'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Meal Planner
              </button>
              <button
                onClick={() => setActiveTab('ai-insights')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'ai-insights'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                AI Insights
              </button>
                              <button
                  onClick={() => setActiveTab('ai-suggestions')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'ai-suggestions'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  AI Suggestions
                </button>
            </div>
            {/* Conditional Header Content */}
            {activeTab === 'planner' && (
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Smart Meal Planner</h1>
                  <p className="text-sm sm:text-base text-gray-600">AI-powered meal planning with intelligent suggestions</p>
                </div>
                
                {/* Mobile-first button layout */}
                <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
                                     <button
                     onClick={() => {
                       console.log('🔍 New Recipe button clicked');
                       console.log('🔍 Current user data:', userData);
                       console.log('🔍 Current modal state:', showCreateRecipeModal);
                       
                       if (!userData?.household_id) {
                         console.error('❌ Cannot create recipe: No household_id available');
                         toast.error('Please complete onboarding first');
                         return;
                       }
                       
                       console.log('🔍 Setting modal to true...');
                       setShowCreateRecipeModal(true);
                       console.log('🔍 Modal state after setState:', true);
                       
                       // Force a re-render check
                       setTimeout(() => {
                         console.log('🔍 Modal state after timeout:', showCreateRecipeModal);
                       }, 100);
                     }}
                     className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium"
                   >
                     + New Recipe
                   </button>
                  
                  {/* Week Navigation */}
                  <div className="flex items-center justify-between sm:justify-start space-x-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigateWeek('prev')}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                        aria-label="Previous week"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="text-xs sm:text-sm font-medium text-gray-900 min-w-0">
                        <span className="hidden sm:inline">{weekDays[0] && formatDate(weekDays[0])} - {weekDays[6] && formatDate(weekDays[6])}</span>
                        <span className="sm:hidden">{weekDays[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </span>
                      <button
                        onClick={() => navigateWeek('next')}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                        aria-label="Next week"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    
                    <button
                      onClick={copyLastWeek}
                      disabled={copyLastWeekMutation.isPending}
                      className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {copyLastWeekMutation.isPending ? 'Copying...' : 'Copy Last Week'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai-insights' && (
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">AI Meal Insights</h1>
                  <p className="text-sm sm:text-base text-gray-600">Intelligent analysis of your meal planning patterns</p>
                </div>
              </div>
            )}

            {activeTab === 'ai-suggestions' && (
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">AI Meal Suggestions</h1>
                  <p className="text-sm sm:text-base text-gray-600">Smart recipe recommendations based on your preferences</p>
                </div>
              </div>
            )}
          </div>

          {/* Conditional Content Based on Active Tab */}
          {activeTab === 'planner' && (
            <>
              {/* Weekly Grid */}
              {/* <FeatureErrorBoundary featureName="Meal Planner Grid"> */}
                {/* Desktop Grid - Hidden on mobile */}
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
                      {(() => {
                        const breakfastRecipe = getMealForDay(date.toISOString().split('T')[0] || '', 'breakfast');
                        return (
                                                     <MealSlot
                             date={date.toISOString().split('T')[0] || ''}
                             mealType="breakfast"
                             recipe={breakfastRecipe || undefined}
                             onAssign={(recipe) => assignRecipe(date.toISOString().split('T')[0] || '', 'breakfast', recipe)}
                             onCreateRecipe={() => setShowCreateRecipeModal(true)}
                             recipes={recipesData?.recipes || []}
                           />
                        );
                      })()}
                    </div>

                    {/* Lunch */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-700">Lunch</div>
                      {(() => {
                        const lunchRecipe = getMealForDay(date.toISOString().split('T')[0] || '', 'lunch');
                        return (
                                                     <MealSlot
                             date={date.toISOString().split('T')[0] || ''}
                             mealType="lunch"
                             recipe={lunchRecipe || undefined}
                             onAssign={(recipe) => assignRecipe(date.toISOString().split('T')[0] || '', 'lunch', recipe)}
                             onCreateRecipe={() => setShowCreateRecipeModal(true)}
                             recipes={recipesData?.recipes || []}
                           />
                        );
                      })()}
                    </div>

                    {/* Dinner */}
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-gray-700">Dinner</div>
                      {(() => {
                        const dinnerRecipe = getMealForDay(date.toISOString().split('T')[0] || '', 'dinner');
                        return (
                                                     <MealSlot
                             date={date.toISOString().split('T')[0] || ''}
                             mealType="dinner"
                             recipe={dinnerRecipe || undefined}
                             onAssign={(recipe) => assignRecipe(date.toISOString().split('T')[0] || '', 'dinner', recipe)}
                             onCreateRecipe={() => setShowCreateRecipeModal(true)}
                             recipes={recipesData?.recipes || []}
                           />
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile/Tablet Layout - Stacked cards */}
            <div className="lg:hidden">
              <div className="space-y-4 p-4">
                {weekDays.map((date, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-center mb-4">
                      <div className="text-lg font-semibold text-gray-900">
                        {date.toLocaleDateString('en-US', { weekday: 'long' })}
                      </div>
                      <div className="text-sm text-gray-500">
                        {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </div>
                    </div>

                    {/* Mobile Meals Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Breakfast */}
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700 text-center">🌅 Breakfast</div>
                                                 <MealSlot
                           date={date.toISOString().split('T')[0] || ''}
                           mealType="breakfast"
                           recipe={getMealForDay(date.toISOString().split('T')[0] || '', 'breakfast') || undefined}
                           onAssign={(recipe) => assignRecipe(date.toISOString().split('T')[0] || '', 'breakfast', recipe)}
                           onCreateRecipe={() => setShowCreateRecipeModal(true)}
                           recipes={recipesData?.recipes || []}
                           isMobile={true}
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
                           onCreateRecipe={() => setShowCreateRecipeModal(true)}
                           recipes={recipesData?.recipes || []}
                           isMobile={true}
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
                           onCreateRecipe={() => setShowCreateRecipeModal(true)}
                           recipes={recipesData?.recipes || []}
                           isMobile={true}
                         />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          {/* </FeatureErrorBoundary> */}
            </>
          )}

          {/* AI Insights Tab */}
          {activeTab === 'ai-insights' && (
            <div className="p-6">
              {loadingAI ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  <span className="ml-2 text-gray-600">Loading AI insights...</span>
                </div>
              ) : aiInsights ? (
                <div className="space-y-6">
                  {/* AI Insights Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-500">Weeks Planned</h3>
                        <span className="text-2xl font-bold text-green-600">{aiInsights.total_weeks_planned}</span>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-500">Planning Consistency</h3>
                        <span className="text-2xl font-bold text-blue-600">{aiInsights.planning_consistency}%</span>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-500">AI Learning</h3>
                        <span className="text-2xl font-bold text-purple-600">{aiInsights.ai_learning_progress}%</span>
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-500">Avg Meals/Week</h3>
                        <span className="text-2xl font-bold text-orange-600">{aiInsights.household_preferences.average_meals_per_week}</span>
                      </div>
                    </div>
                  </div>

                  {/* Popular Recipes */}
                  {aiInsights.popular_recipes && aiInsights.popular_recipes.length > 0 && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Popular Recipes</h3>
                      <div className="space-y-3">
                        {aiInsights.popular_recipes.map((recipe: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <h4 className="font-medium text-gray-900">{recipe.name}</h4>
                              <p className="text-sm text-gray-500">Used {recipe.usage_count} times</p>
                            </div>
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              {recipe.category}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Seasonal Recommendations */}
                  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Seasonal Recommendations</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Current Season:</span>
                        <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full capitalize">
                          {aiInsights.seasonal_recommendations.current_season}
                        </span>
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
                  </div>

                  {/* Improvement Suggestions */}
                  {aiInsights.suggested_improvements && aiInsights.suggested_improvements.length > 0 && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Suggestions for Improvement</h3>
                      <div className="space-y-3">
                        {aiInsights.suggested_improvements.map((suggestion: string, index: number) => (
                          <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                            <span className="text-blue-500 mt-1">💡</span>
                            <p className="text-sm text-blue-800">{suggestion}</p>
                          </div>
                        ))}
                      </div>
                    </div>
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
          )}

          {/* AI Suggestions Tab */}
          {activeTab === 'ai-suggestions' && (
            <div className="p-6">
              {loadingAI ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  <span className="ml-2 text-gray-600">Loading AI suggestions...</span>
                </div>
              ) : aiSuggestions ? (
                <div className="space-y-6">
                  {/* Meal Type Filter */}
                  <div className="flex space-x-4 mb-6">
                    {['breakfast', 'lunch', 'dinner'].map((mealType) => (
                      <button
                        key={mealType}
                        onClick={() => fetchAISuggestions(mealType)}
                        className={`px-4 py-2 rounded-md font-medium capitalize ${
                          aiSuggestions.suggestions?.[0]?.mealType === mealType
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {mealType}
                      </button>
                    ))}
                  </div>

                  {/* AI Confidence */}
                  <div className="bg-blue-50 p-4 rounded-lg">
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
                  </div>

                  {/* Recipe Suggestions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {aiSuggestions.suggestions?.map((recipe: any, index: number) => (
                      <div key={index} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">{recipe.name}</h3>
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            Score: {recipe.ai_score}
                          </span>
                        </div>
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
                            <span key={tagIndex} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            // Add logic to assign this recipe to a meal slot
                            console.log('Assigning recipe:', recipe);
                          }}
                          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                        >
                          Use This Recipe
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* AI Insights */}
                  {aiSuggestions.insights && (
                    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Insights</h3>
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
                    </div>
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
          )}

          {/* Recipe Modal */}
          {showRecipeModal && selectedRecipe ? <RecipeModal
              recipe={selectedRecipe}
              onClose={() => setShowRecipeModal(false)}
              onAddToGroceryList={() => {
                addToGroceryList(selectedRecipe);
                setShowRecipeModal(false);
              }}
            /> : null}

          {/* Create Recipe Modal */}
          {showCreateRecipeModal ? (
            <>
              {console.log('🔍 RENDERING MODAL - showCreateRecipeModal is TRUE')}
              <CreateRecipeModal
                onClose={() => {
                  console.log('🔍 Closing create recipe modal');
                  setShowCreateRecipeModal(false);
                }}
                onCreated={(newRecipe) => {
                  console.log('🔍 Recipe created:', newRecipe);
                  // React Query will automatically refetch recipes due to our mutation
                  setShowCreateRecipeModal(false);
                }}
              />
            </>
          ) : (
            console.log('🔍 NOT RENDERING MODAL - showCreateRecipeModal is FALSE')
          )}
        </div>
      </div>
    </div>
  );
}

interface MealSlotProps {
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  recipe: Recipe | undefined;
  onAssign: (recipe: Recipe) => void;
  onCreateRecipe: () => void;
  recipes: Recipe[];
  isMobile?: boolean;
}

function MealSlot({ date: _date, mealType: _mealType, recipe, onAssign, onCreateRecipe, recipes, isMobile = false }: MealSlotProps) {
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
        </div>
      ) : (
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`w-full bg-gray-50 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-100 text-left ${isMobile ? 'p-3 text-sm' : 'p-2 text-xs'}`}
        >
          + Add Recipe
        </button>
      )}

      {showDropdown ? <div className={`absolute z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg ${isMobile ? 'w-72 left-0 right-0' : 'w-64'}`}>
          <div className="p-3">
            <div className={`font-medium text-gray-700 mb-3 ${isMobile ? 'text-sm' : 'text-xs'}`}>
              Select Recipe
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {recipes.length === 0 ? (
                <div className={`p-3 text-gray-500 text-center ${isMobile ? 'text-sm' : 'text-xs'}`}>
                  <div>No recipes yet!</div>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      onCreateRecipe();
                    }}
                    className="mt-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    Create your first recipe
                  </button>
                </div>
              ) : (
                recipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => {
                      console.log('🔍 Recipe clicked:', recipe.name, recipe.id);
                      console.log('🔍 About to call onAssign with:', recipe);
                      onAssign(recipe);
                      console.log('🔍 onAssign called, closing dropdown');
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left hover:bg-gray-50 rounded ${isMobile ? 'p-3' : 'p-2'}`}
                  >
                    <div className={`font-medium text-gray-900 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                      {recipe.name}
                    </div>
                    <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                      {recipe.prep_time + recipe.cook_time}min
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div> : null}
    </div>
  );
}

interface RecipeModalProps {
  recipe: Recipe;
  onClose: () => void;
  onAddToGroceryList: () => void;
}

function RecipeModal({ recipe, onClose, onAddToGroceryList }: RecipeModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900">{recipe.name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Ingredients</h3>
              <ul className="space-y-1">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={ingredient.id || index} className="text-sm text-gray-700">
                    {ingredient.amount} {ingredient.unit} {ingredient.name}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Instructions</h3>
              <ol className="space-y-2">
                {recipe.instructions.map((instruction, index) => (
                  <li key={instruction.id || index} className="text-sm text-gray-700">
                    {instruction.step_number || index + 1}. {instruction.instruction}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onAddToGroceryList}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add to Grocery List
            </button>
            <button
              onClick={onClose}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CreateRecipeModalProps {
  onClose: () => void;
  onCreated: (recipe: Recipe) => void;
}

function CreateRecipeModal({ onClose, onCreated }: CreateRecipeModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Omit<RecipeIngredient, 'id' | 'recipe_id'>[]>([{ name: '', amount: 1, unit: 'cup', notes: '' }]);
  const [instructions, setInstructions] = useState<Omit<RecipeInstruction, 'id' | 'recipe_id'>[]>([{ step_number: 1, instruction: '' }]);
  const [prepTime, setPrepTime] = useState(0);
  const [cookTime, setCookTime] = useState(0);
  const [servings, setServings] = useState(4);
  const [creating, setCreating] = useState(false);

  function addIngredient() {
    setIngredients([...ingredients, { name: '', amount: 1, unit: 'cup', notes: '' }]);
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateIngredient(index: number, field: keyof Omit<RecipeIngredient, 'id' | 'recipe_id'>, value: string | number) {
    const updated = [...ingredients];
    const currentIngredient = updated[index];
    if (!currentIngredient) return;
    
    updated[index] = {
      name: currentIngredient.name || '',
      amount: currentIngredient.amount || 0,
      unit: currentIngredient.unit || '',
      notes: currentIngredient.notes || '',
      [field]: value
    };
    setIngredients(updated);
  }

  function addInstruction() {
    setInstructions([...instructions, { step_number: instructions.length + 1, instruction: '' }]);
  }

  function removeInstruction(index: number) {
    const updated = instructions.filter((_, i) => i !== index);
    // Update step numbers
    updated.forEach((instruction, i) => {
      instruction.step_number = i + 1;
    });
    setInstructions(updated);
  }

  function updateInstruction(index: number, value: string) {
    const updated = [...instructions];
    const currentInstruction = updated[index];
    if (currentInstruction) {
      updated[index] = { step_number: currentInstruction.step_number, instruction: value };
    }
    setInstructions(updated);
  }

  async function handleCreate() {
    if (!title.trim()) return;

    const validIngredients = ingredients.filter(ing => ing.name.trim());
    const validInstructions = instructions.filter(inst => inst.instruction.trim());

    if (validIngredients.length === 0 || validInstructions.length === 0) {
      toast.error('Please add at least one ingredient and one instruction.');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          ingredients: validIngredients,
          instructions: validInstructions,
          prep_time: prepTime,
          cook_time: cookTime,
          servings,
          tags: []
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Recipe created successfully:', result);
        onCreated(result.recipe);
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to create recipe:', errorData);
        toast.error(`Failed to create recipe: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error creating recipe:', err);
      toast.error('Failed to create recipe. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Create New Recipe</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column - Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipe Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter recipe name..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Brief description..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    value={prepTime}
                    onChange={(e) => setPrepTime(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cook Time (min)
                  </label>
                  <input
                    type="number"
                    value={cookTime}
                    onChange={(e) => setCookTime(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Servings
                  </label>
                  <input
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Ingredients *
                  </label>
                  <button
                    onClick={addIngredient}
                    className="text-green-600 hover:text-green-800 text-sm"
                  >
                    + Add Ingredient
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {ingredients.map((ingredient, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={ingredient.amount}
                        onChange={(e) => updateIngredient(index, 'amount', parseFloat(e.target.value) || 1)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                        step="0.1"
                      />
                      <select
                        value={ingredient.unit}
                        onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="cup">cup</option>
                        <option value="tbsp">tbsp</option>
                        <option value="tsp">tsp</option>
                        <option value="lb">lb</option>
                        <option value="oz">oz</option>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="piece">piece</option>
                      </select>
                      <input
                        type="text"
                        value={ingredient.name}
                        onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Ingredient name..."
                      />
                      {ingredients.length > 1 && (
                        <button
                          onClick={() => removeIngredient(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Instructions */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Instructions *
                  </label>
                  <button
                    onClick={addInstruction}
                    className="text-green-600 hover:text-green-800 text-sm"
                  >
                    + Add Step
                  </button>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {instructions.map((instruction, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <span className="text-sm font-medium text-gray-500 mt-2 w-6">
                        {index + 1}.
                      </span>
                      <textarea
                        value={instruction.instruction}
                        onChange={(e) => updateInstruction(index, e.target.value)}
                        rows={2}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Enter instruction step..."
                      />
                      {instructions.length > 1 && (
                        <button
                          onClick={() => removeInstruction(index)}
                          className="text-red-500 hover:text-red-700 mt-2"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || creating}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Recipe'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
