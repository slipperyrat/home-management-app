// @/lib/supabase/rewardHistory.ts

import { supabase } from '@/lib/supabaseClient'

/**
 * Get all rewards claimed by a specific user, with reward info
 */
export async function getRewardHistory(userId: string) {
  try {
    console.log('🔍 Fetching reward history for user:', userId)
    
    if (!userId) {
      console.error('❌ No user ID provided')
      return []
    }
    
    const { data, error } = await supabase
      .from('reward_claims')
      .select('created_at, reward_id, rewards(name, xp_cost, coin_cost, pro_only)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching reward history:', error)
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return []
    }

    console.log('✅ Reward history data:', data)
    return data || []
  } catch (error) {
    console.error('❌ Unexpected error in getRewardHistory:', error)
    return []
  }
} 