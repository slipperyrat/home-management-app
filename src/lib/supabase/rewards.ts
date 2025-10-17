import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logging/logger';

interface Reward {
  id: string;
  title: string;
  cost_xp: number;
  cost_coins: number;
  created_at: string;
  [key: string]: unknown;
}

interface RewardClaim {
  reward_id: string;
}

export interface PowerUp {
  type: string;
  expires_at: string | null;
}

export async function getAllRewards(): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error fetching rewards: ${error.message}`);
  }

  return (data || []).map(reward => ({
    ...reward,
    created_at: reward.created_at ?? '',
  }));
}

export async function getClaimedRewards(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('reward_claims')
    .select('reward_id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Error fetching claimed rewards: ${error.message}`);
  }

  return (data ?? []).map((claim: RewardClaim) => claim.reward_id);
}

export async function claimReward(rewardId: string, userId: string): Promise<Response> {
  logger.info('Claiming reward', { rewardId, userId });

  const response = await fetch('/api/rewards/claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rewardId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    logger.warn('Failed to claim reward', { rewardId, userId, error: errorData });
    throw new Error(errorData.error || 'Failed to claim reward');
  }

  logger.info('Reward claimed successfully', { rewardId, userId });
  return response;
}

export async function unclaimReward(rewardId: string, userId: string): Promise<{ success: true }>
{
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

export async function getUserPowerUps(userId: string): Promise<string[]>
{
  logger.info('Fetching active power-ups', { userId });

  const { data, error } = await supabase
    .from('power_ups')
    .select('type, expires_at')
    .eq('user_id', userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) {
    logger.error('Error fetching user power-ups', error, { userId });
    throw new Error(`Error fetching user power-ups: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const activePowerUps = data.map((powerUp: PowerUp) => powerUp.type);
  logger.info('Active power-ups retrieved', { userId, count: activePowerUps.length });

  return activePowerUps;
}

export async function getUserPowerUpDetails(userId: string): Promise<PowerUp[]>
{
  const { data, error } = await supabase
    .from('power_ups')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    logger.error('Error fetching user power-up details', error, { userId });
    throw new Error(`Error fetching user power-up details: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const now = new Date();
  const activePowerUps: PowerUp[] = [];

  data.forEach((powerUp: PowerUp) => {
    if (powerUp.expires_at === null) {
      activePowerUps.push(powerUp);
      return;
    }

    const expiresAt = new Date(powerUp.expires_at);
    if (now < expiresAt) {
      activePowerUps.push(powerUp);
    }
  });

  logger.info('Power-up detail summary', {
    userId,
    activeCount: activePowerUps.length,
  });

  return activePowerUps;
} 