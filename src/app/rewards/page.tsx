'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClaimedRewards } from '@/lib/supabase/rewards';
import { getRewards } from '@/lib/rewards';
import { canAccessFeature } from '@/lib/planFeatures';
import { ProBadge } from '@/components/ProBadge';

interface UserData {
  email: string;
  role: 'owner' | 'member';
  plan: 'free' | 'pro' | 'pro_plus';
  xp: number;
  coins: number;
  household: {
    id: string;
    plan: string;
    game_mode: string;
    created_at: string;
  };
}

interface Reward {
  id: string;
  title: string;
  cost_xp: number;
  cost_coins: number;
  pro_only: boolean;
  created_at: string;
}

export default function RewardsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingReward, setClaimingReward] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    async function fetchData() {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch user data with cache busting
        const userResponse = await fetch('/api/user-data', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        const userResult = await userResponse.json();

        if (!userResponse.ok) {
          console.error('Error fetching user data:', userResult.error);
          setError(userResult.error || 'Failed to load user data');
          return;
        }

        if (userResult.success && userResult.data) {
          const userDataObj = {
            email: userResult.data.email,
            role: userResult.data.role,
            plan: userResult.data.plan || 'free',
            xp: userResult.data.xp || 0,
            coins: userResult.data.coins || 0,
            household: userResult.data.household
          };
          
          setUserData(userDataObj);

          // Debug: Log user ID and household ID
          console.log("Your user ID:", user?.id);
          console.log("Your household ID:", userDataObj.household?.id);

          // Check if user can access rewards feature
          if (!canAccessFeature(userDataObj.plan, 'xp_rewards')) {
            router.push('/upgrade');
            return;
          }

          // Fetch rewards and claimed rewards in parallel
          const [rewardsData, claimedRewardsData] = await Promise.all([
            getRewards(userDataObj.household.id),
            getClaimedRewards(user.id)
          ]);

          setRewards(rewardsData);
          setClaimedRewards(claimedRewardsData);
        } else {
          setError('User not found in database');
        }
      } catch (err) {
        console.error('Exception fetching data:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isLoaded, isSignedIn, user?.id, router]);

  const handleClaimReward = async (rewardId: string) => {
    if (!user?.id) return;

    try {
      setClaimingReward(rewardId);
      
      // Send POST request to /api/claim-reward
      const response = await fetch('/api/claim-reward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rewardId }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error claiming reward:', result.error);
        setError(result.error || 'Failed to claim reward');
        return;
      }

      // Success - refresh claimed rewards
      const updatedClaimedRewards = await getClaimedRewards(user.id);
      setClaimedRewards(updatedClaimedRewards);
      
      console.log('✅ Reward claimed successfully:', result);
    } catch (err) {
      console.error('Error claiming reward:', err);
      setError('Failed to claim reward');
    } finally {
      setClaimingReward(null);
    }
  };

  const isRewardClaimed = (rewardId: string) => {
    return claimedRewards.includes(rewardId);
  };

  const canAffordReward = (reward: Reward) => {
    if (!userData) return false;
    return userData.xp >= reward.cost_xp && userData.coins >= reward.cost_coins;
  };

  const handleSyncUser = async () => {
    try {
      const response = await fetch('/api/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      console.log('Sync user response:', result);
    } catch (error) {
      console.error('Error syncing user:', error);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                 <div className="mb-8">
           <h1 className="text-3xl font-bold text-gray-900 mb-2">🎁 Reward Store</h1>
           {userData ? <div className="flex items-center space-x-4 text-sm text-gray-600">
               <span>XP: {userData.xp}</span>
               <span>Coins: {userData.coins}</span>
             </div> : null}
           
           {/* Temporary debug button */}
           <div className="mt-4">
             <button
               onClick={handleSyncUser}
               className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
             >
               🔄 Sync User (Debug)
             </button>
           </div>
         </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {rewards.map((reward) => {
            const isClaimed = isRewardClaimed(reward.id);
            const canAfford = canAffordReward(reward);
            const isClaiming = claimingReward === reward.id;

            return (
              <div key={reward.id} className="bg-white rounded-lg shadow-md overflow-hidden relative">
                {reward.pro_only ? <div className="absolute top-2 right-2 z-10">
                    <ProBadge size="sm" />
                  </div> : null}
                
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {reward.title}
                  </h3>
                  
                  <div className="space-y-2 mb-4">
                    {reward.cost_xp > 0 && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="mr-2">🟡</span>
                        <span>{reward.cost_xp} XP</span>
                      </div>
                    )}
                    {reward.cost_coins > 0 && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="mr-2">🪙</span>
                        <span>{reward.cost_coins} Coins</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleClaimReward(reward.id)}
                    disabled={isClaimed || !canAfford || isClaiming}
                    className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                      isClaimed
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : !canAfford
                        ? 'bg-red-100 text-red-600 cursor-not-allowed'
                        : isClaiming
                        ? 'bg-blue-100 text-blue-600 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isClaiming ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                        Claiming...
                      </div>
                    ) : isClaimed ? (
                      'Claimed'
                    ) : !canAfford ? (
                      'Insufficient Resources'
                    ) : (
                      'Claim Reward'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {rewards.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🎁</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No rewards available</h3>
            <p className="text-gray-600">Check back later for new rewards!</p>
          </div>
        )}
      </div>
    </div>
  );
} 