'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { canAccessFeature } from "@/lib/planFeatures";
import { ProBadge } from '@/components/ProBadge';
import TestSyncButton from '@/components/TestSyncButton';
import { getUserPowerUps } from '@/lib/supabase/rewards';

interface UserData {
  email: string;
  role: 'owner' | 'member';
  plan: 'free' | 'premium';
  xp: number;
  coins: number;
}

type PowerUpType = string;

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [powerUps, setPowerUps] = useState<PowerUpType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    async function fetchUserData() {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/user-data', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        const result = await response.json();

        if (!response.ok) {
          console.error('Error fetching user data:', result.error);
          setError(result.error || 'Failed to load user data');
          return;
        }

        if (result.success && result.user) {
          setUserData({
            email: result.user.email,
            role: result.user.role,
            plan: result.user.plan || 'free',
            xp: result.user.xp || 0,
            coins: result.user.coins || 0
          });

          // Fetch power-ups for the user
          try {
            const powerUpsData = await getUserPowerUps(user.id);
            setPowerUps(powerUpsData);
          } catch (powerUpError) {
            console.error('Error fetching power-ups:', powerUpError);
            // Don't set error for power-ups, just log it
          }
        } else {
          setError('User not found in database');
        }
      } catch (err) {
        console.error('Exception fetching user data:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [isLoaded, isSignedIn, user?.id, router]);

  // Helper function to format expiration countdown
  const formatExpirationCountdown = (expiresAt: string) => {
    const now = new Date();
    const expiration = new Date(expiresAt);
    const diffMs = expiration.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ${diffHours % 24}h left`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m left`;
    } else {
      return `${diffMinutes}m left`;
    }
  };

  // Show loading spinner while auth is loading or data is being fetched
  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // This should not be reached if redirect is working, but just in case
  if (!isSignedIn) {
    return null;
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white shadow rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show dashboard content
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome to Your Dashboard
            </h1>
            <p className="text-gray-600">
              {userData?.role === 'owner' 
                ? "👑 You have owner privileges" 
                : "👋 You're a member of this workspace"
              }
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">User Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{userData?.email}</p>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700">XP</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <span className="text-sm text-gray-900">XP: {userData?.xp || 0}</span>
                    {powerUps.includes('xp_boost') && (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                        🔥 +50% XP
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Coins</label>
                  <div className="mt-1 flex items-center space-x-2">
                    <span className="text-sm text-gray-900">Coins: 🪙 {userData?.coins || 0}</span>
                    {powerUps.includes('double_coin') && (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        🪙 2x Coins
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                {userData?.role === 'owner' ? (
                  <>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50">
                      🛠️ Manage Users
                    </button>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50">
                      ⚙️ System Settings
                    </button>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50">
                      📊 View Analytics
                    </button>
                  </>
                ) : (
                  <>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50">
                      📝 Create Content
                    </button>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50">
                      📋 View Tasks
                    </button>
                    <button className="w-full text-left p-3 bg-white rounded-md border hover:bg-gray-50">
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ Active Power-Ups</h2>
              
              {powerUps.length > 0 ? (
                <div className="space-y-3">
                  {powerUps.includes('xp_boost') && (
                    <div className="bg-yellow-100 border border-yellow-200 rounded-md px-3 py-2 flex items-center space-x-2">
                      <span className="text-yellow-800 text-lg">🔥</span>
                      <div>
                        <span className="text-yellow-800 font-medium">XP Boost Active</span>
                        <span className="text-yellow-700 text-sm block">+50% XP</span>
                      </div>
                    </div>
                  )}
                  
                  {powerUps.includes('double_coin') && (
                    <div className="bg-green-100 border border-green-200 rounded-md px-3 py-2 flex items-center space-x-2">
                      <span className="text-green-800 text-lg">🪙</span>
                      <div>
                        <span className="text-green-800 font-medium">Double Coins Active</span>
                        <span className="text-green-700 text-sm block">2x Coin Rewards</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Show other power-ups as generic badges */}
                  {powerUps.filter(powerUp => !['xp_boost', 'double_coin'].includes(powerUp)).map((powerUp) => (
                    <div key={powerUp} className="bg-blue-100 border border-blue-200 rounded-md px-3 py-2 flex items-center space-x-2">
                      <span className="text-blue-800 text-lg">⚡</span>
                      <div>
                        <span className="text-blue-800 font-medium">{powerUp.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} Active</span>
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
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Available Features</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Games Card */}
              {userData && (() => {
                const showGames = canAccessFeature(userData.plan, "games");
                return showGames && (
                  <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-6 text-white">
                    <div className="text-2xl mb-2">🎮</div>
                    <h3 className="font-semibold mb-2">Games</h3>
                    <p className="text-sm opacity-90">Fun games for the whole family</p>
                  </div>
                );
              })()}

              {/* Finance Card */}
              {userData && (() => {
                const showFinance = canAccessFeature(userData.plan, "finance");
                return showFinance && (
                  <div className="bg-gradient-to-br from-green-500 to-teal-500 rounded-lg p-6 text-white">
                    <div className="text-2xl mb-2">💰</div>
                    <h3 className="font-semibold mb-2">Finance</h3>
                    <p className="text-sm opacity-90">Track household expenses</p>
                  </div>
                );
              })()}

              {/* Shopping List Card */}
              {userData && (() => {
                const showShoppingList = canAccessFeature(userData.plan, "shopping_list");
                return showShoppingList && (
                  <div 
                    onClick={() => router.push('/shopping-lists')}
                    className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg p-6 text-white cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <div className="text-2xl mb-2">🛒</div>
                    <h3 className="font-semibold mb-2">Shopping List</h3>
                    <p className="text-sm opacity-90">Manage your shopping lists</p>
                  </div>
                );
              })()}

              {/* Chores Card */}
              {userData && (() => {
                const showChores = canAccessFeature(userData.plan, "chores");
                return showChores && (
                  <div 
                    onClick={() => router.push('/chores')}
                    className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg p-6 text-white cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <div className="text-2xl mb-2">🧹</div>
                    <h3 className="font-semibold mb-2">Chores</h3>
                    <p className="text-sm opacity-90">Manage household chores and tasks</p>
                  </div>
                );
              })()}

              {/* Rewards Card */}
              {userData && (() => {
                const showRewards = canAccessFeature(userData.plan, "xp_rewards");
                return showRewards && (
                  <div 
                    onClick={() => router.push('/rewards')}
                    className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-6 text-white cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <div className="text-2xl mb-2">🏆</div>
                    <h3 className="font-semibold mb-2">Rewards</h3>
                    <p className="text-sm opacity-90">Redeem XP for rewards</p>
                  </div>
                );
              })()}

              {/* Leaderboard Card */}
              {userData && (() => {
                const showLeaderboard = canAccessFeature(userData.plan, "leaderboard");
                return showLeaderboard && (
                  <div 
                    onClick={() => router.push('/leaderboard')}
                    className="bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg p-6 text-white cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <div className="text-2xl mb-2">📊</div>
                    <h3 className="font-semibold mb-2">Leaderboard</h3>
                    <p className="text-sm opacity-90">View XP rankings</p>
                  </div>
                );
              })()}

              {/* Calendar Card */}
              {userData && (() => {
                const showCalendar = canAccessFeature(userData.plan, "calendar");
                return showCalendar && (
                  <div 
                    onClick={() => router.push('/calendar')}
                    className="bg-gradient-to-br from-green-500 to-teal-500 rounded-lg p-6 text-white cursor-pointer hover:shadow-lg transition-shadow relative"
                  >
                    <div className="absolute top-2 right-2">
                      <ProBadge size="sm" />
                    </div>
                    <div className="text-2xl mb-2">📅</div>
                    <h3 className="font-semibold mb-2">Calendar</h3>
                    <p className="text-sm opacity-90">Manage events</p>
                  </div>
                );
              })()}

              {/* Reminders Card */}
              {userData && (() => {
                const showReminders = canAccessFeature(userData.plan, "reminders");
                return showReminders && (
                  <div 
                    onClick={() => router.push('/reminders')}
                    className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg p-6 text-white cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <div className="text-2xl mb-2">⏰</div>
                    <h3 className="font-semibold mb-2">Reminders</h3>
                    <p className="text-sm opacity-90">Set notifications</p>
                  </div>
                );
              })()}

              {/* Calendar Card */}
              {userData && (() => {
                const showCalendar = canAccessFeature(userData.plan, "calendar");
                return showCalendar && (
                  <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg p-6 text-white">
                    <div className="text-2xl mb-2">📅</div>
                    <h3 className="font-semibold mb-2">Calendar</h3>
                    <p className="text-sm opacity-90">Family calendar and events</p>
                  </div>
                );
              })()}
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