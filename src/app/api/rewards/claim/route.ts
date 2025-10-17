import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logging/logger';
import { claimRewardSchema } from '@/lib/validation/schemas';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      logger.info('Claiming reward', { userId: user.id });

      type ClaimRewardPayload = z.infer<typeof claimRewardSchema>;
      let validatedData: ClaimRewardPayload;
      try {
        const body = await req.json();
        const tempSchema = claimRewardSchema.omit({ household_id: true });
        const parsed = tempSchema.parse(body);
        validatedData = {
          ...parsed,
          household_id: '',
        };
      } catch (validationError: unknown) {
        if (validationError instanceof z.ZodError) {
          return createErrorResponse('Invalid input', 400, validationError.errors);
        }
        return createErrorResponse('Invalid input', 400);
      }

      const { reward_id: rewardId } = validatedData;
      logger.info('Processing reward claim', { rewardId, userId: user.id });

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      validatedData.household_id = household.id;

      const supabase = getDatabaseClient();
      const { error: claimError } = await supabase
        .from('reward_claims')
        .insert({
          reward_id: rewardId,
          user_id: user.id,
          household_id: validatedData.household_id,
          quantity: validatedData.quantity ?? 1,
        });

      if (claimError) {
        logger.error('Error claiming reward', claimError, { rewardId, userId: user.id });
        return createErrorResponse('Failed to claim reward', 500, claimError.message);
      }

      const { data: reward, error: rewardError } = await supabase
        .from('rewards')
        .select('*')
        .eq('id', rewardId)
        .maybeSingle();

      if (rewardError) {
        logger.error('Error fetching reward details', rewardError, { rewardId });
        return createErrorResponse('Failed to fetch reward details', 500, rewardError.message);
      }

      if (!reward) {
        logger.warn('Reward not found', { rewardId });
        return createErrorResponse('Reward not found', 404);
      }

      if (reward.pro_only) {
        logger.info('Reward is pro-only', { rewardId });
      }

      const rewardType = (reward as { type?: string | null }).type ?? null;
      if (rewardType) {
        logger.info('Processing configured power-up type', { rewardType });
        let expiresAt: string | null = null;

        switch (rewardType) {
          case 'xp_boost':
          case 'double_coin':
            expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
            break;
          case 'custom_theme':
          case 'pro_badge':
          case 'priority_support':
          case 'analytics':
            expiresAt = null;
            break;
          default:
            logger.warn('Unknown reward type', { rewardType });
            return createSuccessResponse({ success: true }, 'Reward claimed successfully');
        }

        const { error: powerUpError } = await supabase
          .from('power_ups')
          .upsert({
            user_id: user.id,
            type: rewardType,
            expires_at: expiresAt,
          }, {
            onConflict: 'user_id,type',
          });

        if (powerUpError) {
          logger.error('Error creating power-up', powerUpError, { rewardType, userId: user.id });
          return createErrorResponse('Failed to create power-up', 500, powerUpError.message);
        }

        logger.info('Power-up created', {
          rewardType,
          expiresAt,
          userId: user.id,
        });
      } else {
        logger.info('Reward has no power-up type; skipping power-up', { rewardId });
      }

      await createAuditLog({
        action: 'reward.claimed',
        targetTable: 'rewards',
        targetId: rewardId,
        userId: user.id,
        metadata: {
          reward_name: reward.title,
          reward_type: rewardType,
          household_id: household.id,
        },
      });

      return createSuccessResponse({ success: true }, 'Reward claimed successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/rewards/claim', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
} 