import { logger } from '@/lib/logging/logger';

interface RewardPayload {
  id: string;
  title: string;
  cost_xp: number;
  household_id: string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

interface RewardResponse {
  data?: RewardPayload[] | { rewards?: RewardPayload[] };
  error?: string;
}

interface RedeemRewardPayload {
  rewardId: string;
  userId: string;
  cost: number;
}

interface RedemptionResponse {
  data?: unknown;
  error?: string;
}

export async function getRewards(householdId: string): Promise<RewardPayload[]> {
  try {
    const response = await fetch(`/api/rewards?householdId=${householdId}`);
    const result = (await response.json()) as RewardResponse;

    if (!response.ok) {
      const errorMessage = result.error || 'Failed to fetch rewards';
      logger.error('Error fetching rewards', new Error(errorMessage), { householdId });
      throw new Error(errorMessage);
    }

    if (Array.isArray(result.data)) {
      return result.data;
    }

    if (Array.isArray(result.data?.rewards)) {
      return result.data.rewards;
    }

    logger.warn('Unexpected rewards response shape', { householdId, data: result.data });
    return [];
  } catch (err) {
    logger.error('Exception in getRewards', err as Error, { householdId });
    throw err;
  }
}

export async function addReward(reward: {
  title: string
  cost_xp: number
  household_id: string
  created_by: string
}): Promise<RewardPayload> {
  try {
    logger.info('Adding reward', { householdId: reward.household_id, createdBy: reward.created_by });

    const response = await fetch('/api/rewards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reward),
    });

    const result = (await response.json()) as RewardResponse;

    if (!response.ok) {
      const errorMessage = result.error || 'Failed to add reward';
      logger.error('Error adding reward', new Error(errorMessage), {
        householdId: reward.household_id,
        createdBy: reward.created_by,
      });
      throw new Error(errorMessage);
    }

    logger.info('Successfully added reward', {
      householdId: reward.household_id,
      createdBy: reward.created_by,
    });

    if (!result.data) {
      throw new Error('No reward returned');
    }

    if (Array.isArray(result.data)) {
      if (!result.data[0]) {
        throw new Error('Reward response was empty');
      }
      return result.data[0];
    }

    if ('rewards' in result.data && Array.isArray(result.data.rewards) && result.data.rewards[0]) {
      return result.data.rewards[0];
    }

    throw new Error('Unexpected reward response shape');
  } catch (err) {
    logger.error('Exception in addReward', err as Error, {
      householdId: reward.household_id,
      createdBy: reward.created_by,
    });
    throw err;
  }
}

export async function redeemReward({
  rewardId,
  userId,
  cost
}: RedeemRewardPayload): Promise<unknown> {
  try {
    logger.info('Redeeming reward', { rewardId, userId, cost });

    const response = await fetch('/api/rewards/redemptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rewardId, userId, cost }),
    });

    const result = (await response.json()) as RedemptionResponse;

    if (!response.ok) {
      const errorMessage = result.error || 'Failed to redeem reward';
      logger.error('Error redeeming reward', new Error(errorMessage), {
        rewardId,
        userId,
        cost,
      });
      throw new Error(errorMessage);
    }

    logger.info('Successfully redeemed reward', { rewardId, userId });
    return result.data;
  } catch (err) {
    logger.error('Exception in redeemReward', err as Error, {
      rewardId,
      userId,
      cost,
    });
    throw err;
  }
}

export async function getRedemptions(householdId: string): Promise<unknown> {
  try {
    const response = await fetch(`/api/rewards/redemptions?householdId=${householdId}`);
    const result = (await response.json()) as RedemptionResponse;

    if (!response.ok) {
      const errorMessage = result.error || 'Failed to fetch redemptions';
      logger.error('Error fetching redemptions', new Error(errorMessage), { householdId });
      throw new Error(errorMessage);
    }

    logger.info('Fetched redemptions', { householdId });
    return result.data;
  } catch (err) {
    logger.error('Exception in getRedemptions', err as Error, { householdId });
    throw err;
  }
} 