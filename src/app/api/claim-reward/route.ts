import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/supabase.generated';

type RewardRow = Database['public']['Tables']['rewards']['Row'];

type UserStats = Pick<Database['public']['Tables']['users']['Row'], 'coins'>;

type RewardRedemptionInsert = Database['public']['Tables']['reward_redemptions']['Insert'];

type UsersUpdate = Database['public']['Tables']['users']['Update'];

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { rewardId, quantity = 1 } = await request.json();

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
        .maybeSingle<RewardRow>();

      if (rewardError || !reward) {
        return createErrorResponse('Reward not found or access denied', 404);
      }

      const totalCost = (reward.cost_coins ?? 0) * quantity;

      const { data: userStatsRow, error: statsError } = await supabase
        .from('users')
        .select('coins')
        .eq('id', user.id)
        .maybeSingle<UserStats>();

      if (statsError || !userStatsRow) {
        return createErrorResponse('User stats not found', 404);
      }

      const currentCoins = userStatsRow.coins ?? 0;

      if (currentCoins < totalCost) {
        logger.warn('Reward redemption blocked: insufficient coins', {
          userId: user.id,
          rewardId,
          available: currentCoins,
          cost: totalCost,
        });
        return createErrorResponse('Insufficient reward coins', 400);
      }

      const redemptionPayload: RewardRedemptionInsert = {
        user_id: user.id,
        reward_id: rewardId,
        xp_spent: totalCost,
        redeemed_at: new Date().toISOString(),
      };

      const { error: redemptionError } = await supabase
        .from('reward_redemptions')
        .insert(redemptionPayload);

      if (redemptionError) {
        return createErrorResponse('Failed to create reward redemption', 500, redemptionError.message);
      }

      const updatedUser: UsersUpdate = {
        coins: currentCoins - totalCost,
      };

      const { error: updateStatsError } = await supabase
        .from('users')
        .update(updatedUser)
        .eq('id', user.id);

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
        remainingCoins: currentCoins - totalCost,
      });
    } catch (error) {
      return handleApiError(error, { route: '/api/claim-reward', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
} 