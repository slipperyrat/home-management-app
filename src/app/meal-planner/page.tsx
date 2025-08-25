'use client';

import { useAuth } from '@clerk/nextjs';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUserData } from '@/hooks/useUserData';
import { useRecipes, Recipe } from '@/hooks/useRecipes';
import { useMealPlan, useAssignMeal, useCopyWeek, useClearWeek } from '@/hooks/useMealPlans';

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
  const { userData, isLoading: userDataLoading, error: userDataError } = useUserData();
  const { data: recipes, isLoading: recipesLoading, error: recipesError } = useRecipes();
  const recipesData = recipes as { success: boolean; recipes: Recipe[] } | undefined;
  
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const weekStartDate = getWeekStart(currentWeek);
  const { data: mealPlan, isLoading: mealPlanLoading, error: mealPlanError } = useMealPlan(weekStartDate);
  
  // Debug logging
  console.log('🔍 Meal Planner Debug Info:', {
    userDataLoading,
    recipesLoading,
    mealPlanLoading,
    userData: userData ? { household_id: userData.household_id, has_onboarded: userData.has_onboarded } : null,
    recipesData: recipesData ? { success: recipesData.success, count: recipesData.recipes?.length || 0 } : null,
    mealPlan: mealPlan ? { weekStart: weekStartDate, mealsCount: Object.keys(mealPlan.meals || {}).length } : null,
    weekStartDate: weekStartDate?.toISOString().split('T')[0], // Add this line
    currentWeek: currentWeek.toISOString().split('T')[0] // Add this line
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

  // React Query mutations
  const assignMeal = useAssignMeal();
  const copyWeek = useCopyWeek();
  const clearWeek = useClearWeek();

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
      return recipesData?.recipes?.find(r => r.id === meal);
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

      assignMeal.mutate({
        week: weekStartDate,
        day: dayName,
        slot: mealType,
        recipe_id: recipe.id,
        alsoAddToList: true
      });
    } catch (error) {
      toast.error('Invalid date format');
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="planner">Meal Planner</TabsTrigger>
                <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
                <TabsTrigger value="ai-suggestions">AI Suggestions</TabsTrigger>
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
                           clearWeek.mutate({ week: currentWeekStart });
                         }
                       }}
                      disabled={clearWeek.isPending}
                    >
                      {clearWeek.isPending ? 'Clearing...' : 'Clear Week'}
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
          </CardHeader>

          <CardContent className="p-0">
            {/* Conditional Content Based on Active Tab */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsContent value="planner" className="m-0">
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
                            recipes={recipesData?.recipes || []}
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
                            recipes={recipesData?.recipes || []}
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
                            recipes={recipesData?.recipes || []}
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
                                recipes={recipesData?.recipes || []}
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
                                recipes={recipesData?.recipes || []}
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
                                recipes={recipesData?.recipes || []}
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
                                  console.log('Assigning recipe:', recipe);
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
                    className="w-full justify-start hover:bg-gray-50"
                  >
                    <div className={`font-medium text-gray-900 ${isMobile ? 'text-sm' : 'text-xs'}`}>
                      {recipe.name}
                    </div>
                    <div className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-xs'}`}>
                      {recipe.prep_time + recipe.cook_time}min
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
