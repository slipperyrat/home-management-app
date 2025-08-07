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
  const [history, setHistory] = useState<any[]>([])
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
        setHistory(data)
      } catch (error) {
        console.error('❌ Error fetching reward history:', error)
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
        {history.map((entry, i) => (
          <div key={i} className="p-4 rounded shadow bg-white">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold text-lg">
                  {entry.rewards.name}{' '}
                  {entry.rewards.pro_only && <ProBadge size="sm" />}
                </div>
                <div className="text-sm text-gray-600">
                  Claimed on {formatDate(entry.created_at)}
                </div>
              </div>
              <div className="text-right text-sm">
                <div>🟡 {entry.rewards.xp_cost} XP</div>
                <div>🪙 {entry.rewards.coin_cost} Coins</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 