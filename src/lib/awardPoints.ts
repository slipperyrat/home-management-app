import { createClient } from '@supabase/supabase-js';
import { getUserPowerUps } from '@/lib/supabase/rewards';
import { logger } from '@/lib/logging/logger';

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
    logger.info('Awarding points', { userId, amount, type, reason });

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

    // First get the current value
    const { data: currentData, error: fetchError } = await supabase
      .from('users')
      .select(`${type}`)
      .eq('id', userId)
      .single();

    if (fetchError) {
      logger.error(`Error fetching current ${type} for user`, fetchError, { userId });
      return {
        success: false,
        error: `Failed to fetch current ${type}: ${fetchError.message}`,
      };
    }

    if (!currentData) {
      return {
        success: false,
        error: 'User not found',
        newTotal: 0,
      };
    }

    const currentValue = (currentData?.[type as keyof typeof currentData] as number | null) ?? 0;
    const newValue = currentValue + amount;

    // Update the user's points/coins
    const { data, error } = await supabase
      .from('users')
      .update({ [type]: newValue })
      .eq('id', userId)
      .select(`${type}`)
      .single();

    if (error) {
      logger.error('Error awarding points', error, { userId, type, amount });
      return {
        success: false,
        error: `Failed to award ${type}: ${error.message}`,
      };
    }

    if (!data) {
      return {
        success: false,
        error: 'User not found',
        newTotal: currentValue,
      };
    }

    const newTotal = (data[type as keyof typeof data] as number | null) ?? null;
    logger.info('Award points operation complete', { userId, amount, type, newTotal });

    return {
      success: true,
      newTotal: newTotal ?? currentValue,
    };

  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error occurred');
    logger.error('Exception awarding points', err, { userId, amount, type });
    return {
      success: false,
      error: err.message,
    };
  }
}

// Convenience functions for common use cases
export async function awardXP(userId: string, amount: number, reason?: string): Promise<AwardPointsResult> {
  return awardPoints({ 
    userId, 
    amount, 
    type: 'xp', 
    ...(reason && { reason })
  });
}

export async function awardCoins(userId: string, amount: number, reason?: string): Promise<AwardPointsResult> {
  try {
    // Check for double_coin power-up
    const activePowerUps = await getUserPowerUps(userId);
    const hasDoubleCoin = activePowerUps.includes('double_coin');

    let coinReward = 1;
    if (hasDoubleCoin) {
      coinReward = 2;
      logger.info('Double coin power-up active; doubling reward', { userId, amount });
    } else {
      logger.info('No double coin power-up; using default reward', { userId, amount });
    }

    // Apply the coin reward multiplier
    const adjustedAmount = amount * coinReward;
    
    return awardPoints({ 
      userId, 
      amount: adjustedAmount, 
      type: 'coins', 
      ...(reason && { reason: `${reason}${hasDoubleCoin ? ' (doubled by power-up)' : ''}` })
    });
  } catch (error) {
    logger.error('Error checking user power-ups', error as Error, { userId });
    // Fall back to default behavior if power-up check fails
    return awardPoints({ 
      userId, 
      amount, 
      type: 'coins', 
      ...(reason && { reason })
    });
  }
} 