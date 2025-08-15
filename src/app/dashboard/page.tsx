'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { canAccessFeature } from "@/lib/planFeatures";
import { ProBadge } from '@/components/ProBadge';
import TestSyncButton from '@/components/TestSyncButton';
import { FeatureCard } from '@/components/ui/FeatureCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorDisplay } from '@/components/ui/ErrorDisplay';
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

  // Show loading spinner while auth is loading or data is being fetched
  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
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
                        Explore your meal planner, organize tasks, and manage your household effortlessly.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => router.push('/meal-planner')}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          📋 View Meal Planner
                        </button>
                        <button
                          onClick={() => router.push('/planner')}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          📝 View Planner
                        </button>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => setShowWelcomeBanner(false)}
                        className="inline-flex text-green-400 hover:text-green-600 focus:outline-none focus:text-green-600"
                        aria-label="Dismiss banner"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div> : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">User Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-sm text-gray-900 truncate">{userData?.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <div className="mt-1 flex items-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      userData?.role === 'owner' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {userData?.role === 'owner' ? '👑 Owner' : '👤 Member'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Plan</label>
                  <div className="mt-1 flex items-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      userData?.plan === 'premium' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {userData?.plan === 'premium' ? '⭐ Premium' : '🆓 Free'}
                    </span>
                  </div>
                </div>
                
                {/* XP and Coins in a row on mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">XP</label>
                    <div className="mt-1 flex flex-col space-y-1">
                      <span className="text-sm text-gray-900">{userData?.xp || 0}</span>
                      {powerUps.some(p => p.type === 'xp_boost') && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200 w-fit">
                          🔥 +50% XP
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Coins</label>
                    <div className="mt-1 flex flex-col space-y-1">
                      <span className="text-sm text-gray-900">🪙 {userData?.coins || 0}</span>
                      {powerUps.some(p => p.type === 'double_coin') && (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-200 w-fit">
                          🪙 2x Coins
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {userData?.role === 'owner' ? (
                  <>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors">
                      🛠️ Manage Users
                    </button>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors">
                      ⚙️ System Settings
                    </button>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors">
                      📊 View Analytics
                    </button>
                  </>
                ) : (
                  <>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors">
                      📝 Create Content
                    </button>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors">
                      📋 View Tasks
                    </button>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors">
                      👥 Team Directory
                    </button>
                  </>
                )}
                
                {/* Debug section */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Debug Tools</h3>
                  <TestSyncButton />
                </div>
              </div>
            </div>

            {/* Power-Ups Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ Active Power-Ups</h2>
              
              {powerUps.length > 0 ? (
                <div className="space-y-3">
                  {powerUps.some(p => p.type === 'xp_boost') && (
                    <div className="bg-yellow-100 border border-yellow-200 rounded-md px-3 py-2 flex items-center space-x-2">
                      <span className="text-yellow-800 text-lg">🔥</span>
                      <div>
                        <span className="text-yellow-800 font-medium">XP Boost Active</span>
                        <span className="text-yellow-700 text-sm block">+50% XP</span>
                      </div>
                    </div>
                  )}
                  
                  {powerUps.some(p => p.type === 'double_coin') && (
                    <div className="bg-green-100 border border-green-200 rounded-md px-3 py-2 flex items-center space-x-2">
                      <span className="text-green-800 text-lg">🪙</span>
                      <div>
                        <span className="text-green-800 font-medium">Double Coins Active</span>
                        <span className="text-green-700 text-sm block">2x Coin Rewards</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Show other power-ups as generic badges */}
                  {powerUps
                    .filter(powerUp => !['xp_boost', 'double_coin'].includes(powerUp.type))
                    .map((powerUp) => (
                    <div key={powerUp.id} className="bg-blue-100 border border-blue-200 rounded-md px-3 py-2 flex items-center space-x-2">
                      <span className="text-blue-800 text-lg">⚡</span>
                      <div>
                        <span className="text-blue-800 font-medium">
                          {powerUp.type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} Active
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="text-gray-400 text-3xl mb-2">⚡</div>
                  <p className="text-gray-600 text-sm">
                    No active power-ups. Complete tasks to earn boosts!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Feature Cards */}
          <div className="mt-6 sm:mt-8">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Available Features</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {/* Meal Planner Card */}
              {userData && canAccessFeature(userData.plan, "meal_planner") ? <FeatureCard
                  title="Meal Planner"
                  description="Plan weekly meals and sync with grocery lists"
                  icon="🍽️"
                  href="/meal-planner"
                  gradient="bg-gradient-to-br from-orange-500 to-red-500"
                /> : null}

              {/* Collaborative Planner Card */}
              {userData && canAccessFeature(userData.plan, "collaborative_planner") ? <FeatureCard
                  title="Collaborative Planner"
                  description="Plan trips, renovations, dreams, and goals"
                  icon="📋"
                  href="/planner"
                  gradient="bg-gradient-to-br from-purple-500 to-indigo-500"
                /> : null}

              {/* Shopping List Card */}
              {userData && canAccessFeature(userData.plan, "shopping_list") ? <FeatureCard
                  title="Shopping List"
                  description="Manage your shopping lists"
                  icon="🛒"
                  href="/shopping-lists"
                  gradient="bg-gradient-to-br from-blue-500 to-indigo-500"
                /> : null}

              {/* Chores Card */}
              {userData && canAccessFeature(userData.plan, "chores") ? <FeatureCard
                  title="Chores"
                  description="Manage household chores and tasks"
                  icon="🧹"
                  href="/chores"
                  gradient="bg-gradient-to-br from-green-500 to-emerald-500"
                /> : null}

              {/* Rewards Card */}
              {userData && canAccessFeature(userData.plan, "xp_rewards") ? <FeatureCard
                  title="Rewards"
                  description="Redeem XP for rewards"
                  icon="🏆"
                  href="/rewards"
                  gradient="bg-gradient-to-br from-purple-500 to-pink-500"
                /> : null}

              {/* Leaderboard Card */}
              {userData && canAccessFeature(userData.plan, "leaderboard") ? <FeatureCard
                  title="Leaderboard"
                  description="View XP rankings"
                  icon="📊"
                  href="/leaderboard"
                  gradient="bg-gradient-to-br from-indigo-500 to-purple-500"
                /> : null}

              {/* Calendar Card */}
              {userData && canAccessFeature(userData.plan, "calendar") ? <FeatureCard
                  title="Calendar"
                  description="Manage events"
                  icon="📅"
                  href="/calendar"
                  gradient="bg-gradient-to-br from-green-500 to-teal-500"
                  badge={<ProBadge size="sm" />}
                /> : null}

              {/* Reminders Card */}
              {userData && canAccessFeature(userData.plan, "reminders") ? <FeatureCard
                  title="Reminders"
                  description="Set notifications"
                  icon="⏰"
                  href="/reminders"
                  gradient="bg-gradient-to-br from-orange-500 to-red-500"
                /> : null}
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-600">
              {userData?.role === 'owner' 
                ? "As an owner, you have full control over this workspace and can manage all users and settings."
                : "As a member, you can access workspace features and collaborate with your team."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 