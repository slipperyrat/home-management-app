// @/lib/supabase/rewardHistory.ts

import { supabase } from '@/lib/supabaseClient'
import { logger } from '@/lib/logging/logger'

/**
 * Get all rewards claimed by a specific user, with reward info
 */
interface RewardHistoryEntry {
  created_at: string;
  reward_id: string;
  rewards: {
    name: string;
    xp_cost: number;
    coin_cost: number;
    pro_only: boolean;
  } | null;
}

export async function getRewardHistory(userId: string): Promise<RewardHistoryEntry[]> {
  try {
    logger.info('Fetching reward history for user', { userId })
    
    if (!userId) {
      logger.warn('No user ID provided when fetching reward history')
      return []
    }
    
    const { data, error } = await supabase
      .from('reward_claims')
      .select('created_at, reward_id, rewards(name, xp_cost, coin_cost, pro_only)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching reward history', error, {
        userId,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return []
    }

    const rows = Array.isArray(data) ? data : []

    logger.info('Fetched reward history data', { userId, count: rows.length })
    return rows.map(entry => ({
      created_at: entry.created_at ?? '',
      reward_id: entry.reward_id,
      rewards:
        entry.rewards && typeof entry.rewards === 'object' && 'name' in entry.rewards
          ? (entry.rewards as RewardHistoryEntry['rewards'])
          : null,
    }));
  } catch (error) {
    logger.error('Unexpected error in getRewardHistory', error as Error, { userId })
    return []
  }
} 