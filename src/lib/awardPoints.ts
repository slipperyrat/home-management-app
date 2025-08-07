import { createClient } from '@supabase/supabase-js';
import { getUserPowerUps } from '@/lib/supabase/rewards';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface AwardPointsParams {
  userId: string;
  amount: number;
  type: 'xp' | 'coins';
  reason?: string;
}

interface AwardPointsResult {
  success: boolean;
  error?: string;
  newTotal?: number;
}

export async function awardPoints({
  userId,
  amount,
  type,
  reason
}: AwardPointsParams): Promise<AwardPointsResult> {
  try {
    console.log(`🎯 Awarding ${amount} ${type} to user ${userId}${reason ? ` (${reason})` : ''}`);

    // Validate inputs
    if (!userId) {
      return { success: false, error: 'User ID is required' };
    }

    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    if (!['xp', 'coins'].includes(type)) {
      return { success: false, error: 'Type must be either "xp" or "coins"' };
    }

    // Update the user's points/coins
    const { data, error } = await supabase
      .from('users')
      .update({ [type]: supabase.sql`${type} + ${amount}` })
      .eq('id', userId)
      .select(`${type}`)
      .single();

    if (error) {
      console.error(`❌ Error awarding ${type} to user ${userId}:`, error);
      return { 
        success: false, 
        error: `Failed to award ${type}: ${error.message}` 
      };
    }

    if (!data) {
      return { 
        success: false, 
        error: 'User not found' 
      };
    }

    const newTotal = data[type];
    console.log(`✅ Successfully awarded ${amount} ${type} to user ${userId}. New total: ${newTotal}`);

    return {
      success: true,
      newTotal
    };

  } catch (error) {
    console.error(`❌ Exception awarding ${type} to user ${userId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Convenience functions for common use cases
export async function awardXP(userId: string, amount: number, reason?: string): Promise<AwardPointsResult> {
  return awardPoints({ userId, amount, type: 'xp', reason });
}

export async function awardCoins(userId: string, amount: number, reason?: string): Promise<AwardPointsResult> {
  try {
    // Check for double_coin power-up
    const activePowerUps = await getUserPowerUps(userId);
    const hasDoubleCoin = activePowerUps.includes('double_coin');

    let coinReward = 1;
    if (hasDoubleCoin) {
      coinReward = 2;
      console.log(`🎯 User ${userId} has active double_coin power-up - doubling coin reward`);
    } else {
      console.log(`🎯 User ${userId} has no active double_coin power-up - using default coin reward`);
    }

    // Apply the coin reward multiplier
    const adjustedAmount = amount * coinReward;
    
    return awardPoints({ 
      userId, 
      amount: adjustedAmount, 
      type: 'coins', 
      reason: reason ? `${reason}${hasDoubleCoin ? ' (doubled by power-up)' : ''}` : undefined 
    });
  } catch (error) {
    console.error(`❌ Error checking power-ups for user ${userId}:`, error);
    // Fall back to default behavior if power-up check fails
    return awardPoints({ userId, amount, type: 'coins', reason });
  }
} 