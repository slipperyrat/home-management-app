import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logging/logger';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      const { rewardId, quantity = 1 } = await req.json();

      if (!rewardId) {
        return createErrorResponse('Reward ID is required', 400);
      }
      if (quantity <= 0) {
        return createErrorResponse('Quantity must be greater than 0', 400);
      }

      const { household, error: householdError } = await getUserAndHouseholdData(user.id);

      if (householdError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      const { data: reward, error: rewardError } = await supabase
        .from('rewards')
        .select('*')
        .eq('id', rewardId)
        .eq('household_id', household.id)
        .single();

      if (rewardError || !reward) {
        return createErrorResponse('Reward not found or access denied', 404);
      }

      const totalCost = reward.points_cost * quantity;

      const { data: userStats, error: statsError } = await supabase
        .from('household_user_stats')
        .select('*')
        .eq('user_id', user.id)
        .eq('household_id', household.id)
        .single();

      if (statsError || !userStats) {
        return createErrorResponse('User stats not found', 404);
      }

      if (userStats.coins < totalCost) {
        logger.warn('Reward redemption blocked: insufficient coins', {
          userId: user.id,
          rewardId,
          available: userStats.coins,
          cost: totalCost,
        });
        return createErrorResponse('Insufficient reward coins', 400);
      }

      const { error: redemptionError } = await supabase
        .from('reward_redemptions')
        .insert({
          user_id: user.id,
          household_id: household.id,
          reward_id: rewardId,
          quantity,
          total_points_cost: totalCost,
        });

      if (redemptionError) {
        return createErrorResponse('Failed to create reward redemption', 500, redemptionError.message);
      }

      const { error: updateStatsError } = await supabase
        .from('household_user_stats')
        .update({ coins: userStats.coins - totalCost })
        .eq('user_id', user.id)
        .eq('household_id', household.id);

      if (updateStatsError) {
        return createErrorResponse('Failed to update user stats', 500, updateStatsError.message);
      }

      await createAuditLog({
        action: 'reward.redeemed',
        targetTable: 'rewards',
        targetId: rewardId,
        userId: user.id,
        metadata: {
          quantity,
          totalCost,
        },
      });

      logger.info('Reward redeemed successfully', {
        userId: user.id,
        rewardId,
        quantity,
        totalCost,
      });

      return createSuccessResponse({
        message: 'Reward redeemed successfully',
        remainingCoins: userStats.coins - totalCost,
      });
    } catch (error) {
      return handleApiError(error, { route: '/api/claim-reward', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
} 