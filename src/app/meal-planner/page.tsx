'use client';

import { useAuth } from '@clerk/nextjs';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserData } from '@/hooks/useUserData';
import { useRecipes } from '@/hooks/useRecipes';
import { useMealPlan } from '@/hooks/useMealPlan';

export default function MealPlannerPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  
  // Data fetching hooks
  const { userData, isLoading: userDataLoading, error: userDataError } = useUserData();
  const { isLoading: recipesLoading, error: recipesError } = useRecipes();
  
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());
  const weekStartDate = getWeekStart(currentWeek);
  const { isLoading: mealPlanLoading, error: mealPlanError } = useMealPlan(weekStartDate);
  
  // Loading and error states
  const loading = userDataLoading || recipesLoading || mealPlanLoading;
  const error = userDataError || recipesError || mealPlanError;
  
  // Check if user has completed onboarding
  const hasCompletedOnboarding = userData?.has_onboarded && userData?.household_id;
  
  // Local state
  const [activeTab, setActiveTab] = useState('planner');



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



  function navigateWeek(direction: 'prev' | 'next') {
    const newWeek = new Date(currentWeek);
    if (direction === 'prev') {
      newWeek.setDate(newWeek.getDate() - 7);
    } else {
      newWeek.setDate(newWeek.getDate() + 7);
    }
    setCurrentWeek(newWeek);
  }

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
                
                <div className="flex items-center space-x-4">
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
                    <span className="text-sm font-medium text-gray-900">
                      {weekDays[0] && formatDate(weekDays[0])} - {weekDays[6] && formatDate(weekDays[6])}
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
            <div className="p-6">
              <div className="text-center text-gray-500">
                <p>Meal planner content will go here</p>
                <p>This is a simplified version to avoid TypeScript issues</p>
              </div>
            </div>
          )}

          {activeTab === 'ai-insights' && (
            <div className="p-6">
              <div className="text-center text-gray-500">
                <p>AI Insights content will go here</p>
                <p>This is a simplified version to avoid TypeScript issues</p>
              </div>
            </div>
          )}

          {activeTab === 'ai-suggestions' && (
            <div className="p-6">
              <div className="text-center text-gray-500">
                <p>AI Suggestions content will go here</p>
                <p>This is a simplified version to avoid TypeScript issues</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
