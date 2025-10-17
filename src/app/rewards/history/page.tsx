// @/app/rewards/history/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { getRewardHistory } from '@/lib/supabase/rewardHistory'
import { ProBadge } from '@/components/ProBadge'

// Simple date formatter as fallback
function formatDate(dateString: string) {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    return dateString
  }
}

export default function RewardHistoryPage() {
  const [history, setHistory] = useState<Array<{
    rewards: Array<{
      name: string;
      pro_only: boolean;
      xp_cost: number;
      coin_cost: number;
    }>;
    created_at: string;
    reward_id: string;
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        console.log('🔄 Fetching user data...')
        const res = await fetch('/api/user-data')
        if (!res.ok) {
          throw new Error(`Failed to fetch user data: ${res.status}`)
        }
        const user = await res.json()
        console.log('👤 User data:', user)
        
        if (!user?.id) {
          console.error('❌ No user ID found')
          setHistory([])
          return
        }
        
        console.log('🎯 Fetching reward history for user:', user.id)
        const data = await getRewardHistory(user.id)
        console.log('📊 Reward history result:', data)
        setHistory(
          data.map(entry => ({
            reward_id: entry.reward_id,
            created_at: entry.created_at,
            rewards: entry.rewards ? [entry.rewards] : [],
          }))
        )
      } catch {
        console.error('❌ Error fetching reward history')
        setHistory([])
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  if (loading) return <div className="p-4">Loading history...</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">🎖️ Claimed Rewards</h1>
      <div className="space-y-4">
        {history.map((entry, i) => {
          const reward = entry.rewards[0]; // Get the first reward from the array
          if (!reward) return null; // Skip if no reward data
          
          return (
            <div key={i} className="p-4 rounded shadow bg-white">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold text-lg">
                    {reward.name}{' '}
                    {reward.pro_only ? <ProBadge size="sm" /> : null}
                  </div>
                  <div className="text-sm text-gray-600">
                    Claimed on {formatDate(entry.created_at)}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div>🟡 {reward.xp_cost} XP</div>
                  <div>🪙 {reward.coin_cost} Coins</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  )
} 