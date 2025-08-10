import { supabase } from '@/lib/supabaseClient'

/**
 * Fetches all rewards from the rewards table ordered by created_at descending
 */
export async function getAllRewards() {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error fetching rewards: ${error.message}`);
  }

  return data;
}

/**
 * Fetches all claimed reward IDs for a specific user
 */
export async function getClaimedRewards(userId: string) {
  const { data, error } = await supabase
    .from('reward_claims')
    .select('reward_id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Error fetching claimed rewards: ${error.message}`);
  }

  return data.map(claim => claim.reward_id);
}

/**
 * Claims a reward for a specific user and handles power-ups
 */
export async function claimReward(rewardId: string, userId: string) {
  try {
    console.log(`🎯 Claiming reward ${rewardId} for user ${userId}`);
    
    // Call the API route to handle reward claiming and power-ups
    const response = await fetch('/api/rewards/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rewardId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to claim reward');
    }

    const result = await response.json();
    console.log('✅ Reward claimed successfully with power-ups');
    return result;
  } catch (error) {
    console.error('❌ Error in claimReward:', error);
    throw error;
  }
}

/**
 * Unclaims a reward for a specific user
 */
export async function unclaimReward(rewardId: string, userId: string) {
  const { error } = await supabase
    .from('reward_claims')
    .delete()
    .eq('reward_id', rewardId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Error unclaiming reward: ${error.message}`);
  }

  return { success: true };
}

/**
 * Gets active power-ups for a user and automatically cleans up expired ones
 */
export async function getUserPowerUps(userId: string): Promise<string[]> {
  try {
    console.log(`🔍 Fetching power-ups for user ${userId}`);
    
    // Fetch remaining (active) power-ups
    const { data, error } = await supabase
      .from('power_ups')
      .select('type')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (error) {
      console.error('❌ Error fetching user power-ups:', error);
      throw new Error(`Error fetching user power-ups: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.log(`ℹ️ No active power-ups found for user ${userId}`);
      return [];
    }

    const activePowerUps = data.map(powerUp => powerUp.type);
    
    console.log(`✅ Found ${activePowerUps.length} active power-ups for user ${userId}: ${activePowerUps.join(', ')}`);
    
    return activePowerUps;
  } catch (error) {
    console.error('❌ Error in getUserPowerUps:', error);
    throw error;
  }
}

/**
 * Gets active power-up details for a user (for UI display)
 */
export async function getUserPowerUpDetails(userId: string) {
  try {
    const { data, error } = await supabase
      .from('power_ups')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error fetching user power-up details:', error);
      throw new Error(`Error fetching user power-up details: ${error.message}`);
    }

    if (!data || data.length === 0) {
      console.log(`ℹ️ No power-ups found for user ${userId}`);
      return [];
    }

    const now = new Date();
    const activePowerUps: any[] = [];
    const expiredPowerUps: any[] = [];

    // Filter power-ups based on expiration
    data.forEach(powerUp => {
      if (powerUp.expires_at === null) {
        // Permanent power-up
        activePowerUps.push(powerUp);
        console.log(`✅ Active permanent power-up: ${powerUp.type}`);
      } else {
        // Temporary power-up - check if expired
        const expiresAt = new Date(powerUp.expires_at);
        if (now < expiresAt) {
          activePowerUps.push(powerUp);
          console.log(`✅ Active temporary power-up: ${powerUp.type} (expires: ${powerUp.expires_at})`);
        } else {
          expiredPowerUps.push(powerUp);
          console.log(`❌ Expired power-up: ${powerUp.type} (expired: ${powerUp.expires_at})`);
        }
      }
    });

    // Log summary
    console.log(`📊 Power-up details summary for user ${userId}:`);
    console.log(`   Active: ${activePowerUps.length} (${activePowerUps.map(p => p.type).join(', ')})`);
    console.log(`   Expired: ${expiredPowerUps.length} (${expiredPowerUps.map(p => p.type).join(', ')})`);

    return activePowerUps;
  } catch (error) {
    console.error('❌ Error in getUserPowerUpDetails:', error);
    throw error;
  }
} 