'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { canAccessFeature } from "@/lib/planFeatures";
import { ProBadge } from '@/components/ProBadge';
import TestSyncButton from '@/components/TestSyncButton';
import { FeatureCard } from '@/components/ui/FeatureCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { useUserData } from '@/hooks/useUserData';
import { performanceMonitor } from '@/lib/performance';

export default function DashboardPage() {
  const router = useRouter();
  const { userData, powerUps, isLoading, isError, error, refetch, isLoaded, isSignedIn, user } = useUserData();
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);

  useEffect(() => {
    // Start performance monitoring for dashboard
    performanceMonitor.start('dashboard-render');
    
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    // Check if user was recently onboarded (within last hour)
    if (userData?.has_onboarded && userData?.updated_at) {
      const updatedAt = new Date(userData.updated_at);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      setShowWelcomeBanner(updatedAt > oneHourAgo);
    }

    // End performance monitoring
    performanceMonitor.end('dashboard-render');
  }, [isLoaded, isSignedIn, userData, router]);

  // Show skeleton loading while auth is loading or data is being fetched
  if (!isLoaded || isLoading) {
    return <DashboardSkeleton />;
  }

  // This should not be reached if redirect is working, but just in case
  if (!isSignedIn) {
    return null;
  }

  // Show error state
  if (isError && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorDisplay 
          error={error.message || 'An unexpected error occurred'} 
          onRetry={refetch}
        />
      </div>
    );
  }

  // Show dashboard content
  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow rounded-lg p-4 sm:p-6">
          
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Welcome to Your Dashboard
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              {userData?.role === 'owner' 
                ? "👑 You have owner privileges" 
                : "👋 You're a member of this workspace"
              }
            </p>
          </div>

          {/* Welcome back banner for recently onboarded users */}
          {showWelcomeBanner ? <div className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100">
                    <span className="text-green-600 text-lg">🎉</span>
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-green-800">
                        Welcome back, {user?.firstName || 'there'}!
                      </h3>
                      <p className="mt-1 text-sm text-green-700">
                        Your home management system is all set up and ready to use. 
                        Start exploring the features below!
                      </p>
                    </div>
                    <button
                      onClick={() => setShowWelcomeBanner(false)}
                      className="text-green-600 hover:text-green-800"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div> : null}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100">
                    <span className="text-blue-600 text-lg">📊</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-blue-600">XP Points</p>
                  <p className="text-lg font-semibold text-blue-900">{userData?.xp || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-100">
                    <span className="text-green-600 text-lg">🪙</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-600">Coins</p>
                  <p className="text-lg font-semibold text-green-900">{userData?.coins || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-100">
                    <span className="text-purple-600 text-lg">🏆</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-purple-600">Level</p>
                  <p className="text-lg font-semibold text-purple-900">{userData?.level || 1}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-orange-100">
                    <span className="text-orange-600 text-lg">⭐</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-orange-600">Streak</p>
                  <p className="text-lg font-semibold text-orange-900">{userData?.streak || 0} days</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => router.push('/chores')}
                className="flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <span className="text-2xl mb-2">✅</span>
                <span className="text-sm font-medium text-gray-700">Add Chore</span>
              </button>

              <button
                onClick={() => router.push('/meal-planner')}
                className="flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
              >
                <span className="text-2xl mb-2">🍽️</span>
                <span className="text-sm font-medium text-gray-700">Plan Meal</span>
              </button>

              <button
                onClick={() => router.push('/shopping-lists')}
                className="flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors"
              >
                <span className="text-2xl mb-2">🛒</span>
                <span className="text-sm font-medium text-gray-700">Shopping</span>
              </button>

              <button
                onClick={() => router.push('/calendar')}
                className="flex flex-col items-center p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors"
              >
                <span className="text-2xl mb-2">📅</span>
                <span className="text-sm font-medium text-gray-700">Calendar</span>
              </button>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <FeatureCard
              title="AI-Powered Insights"
              description="Get intelligent suggestions for meals, chores, and household management"
              icon="🤖"
              href="/ai-email-dashboard"
              canAccess={canAccessFeature('ai_insights', userData?.plan)}
            />

            <FeatureCard
              title="Smart Automation"
              description="Set up rules to automatically manage recurring tasks and notifications"
              icon="⚡"
              href="/test-automation"
              canAccess={canAccessFeature('automation', userData?.plan)}
            />

            <FeatureCard
              title="Advanced Analytics"
              description="Track your household's progress with detailed statistics and insights"
              icon="📈"
              href="/leaderboard"
              canAccess={canAccessFeature('analytics', userData?.plan)}
            />

            <FeatureCard
              title="Power-ups"
              description="Unlock special abilities and bonuses to enhance your experience"
              icon="🚀"
              href="/power-ups"
              canAccess={true}
            />

            <FeatureCard
              title="Rewards Center"
              description="Redeem your hard-earned XP and coins for exclusive rewards"
              icon="🎁"
              href="/rewards"
              canAccess={true}
            />

            <FeatureCard
              title="Settings & Preferences"
              description="Customize your experience and manage your account settings"
              icon="⚙️"
              href="/settings"
              canAccess={true}
            />
          </div>

          {/* Pro Features Promotion */}
          {userData?.plan !== 'pro' && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">
                  Unlock Premium Features
                </h3>
                <p className="text-sm text-purple-700 mb-4">
                  Upgrade to Pro for advanced AI insights, unlimited automation rules, and priority support
                </p>
                <button
                  onClick={() => router.push('/upgrade')}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          )}

          {/* Debug Section - Only show in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Debug Tools</h3>
              <div className="space-y-3">
                <TestSyncButton />
                <button
                  onClick={() => router.push('/debug')}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  Debug Dashboard
                </button>
                <button
                  onClick={() => router.push('/debug/set-role')}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors ml-2"
                >
                  Set Role
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 