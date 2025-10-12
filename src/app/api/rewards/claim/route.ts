import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logging/logger';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      logger.info('Claiming reward', { userId: user.id });

      // Parse and validate request body using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        const { claimRewardSchema } = await import('@/lib/validation/schemas');
        const tempSchema = claimRewardSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
      } catch (validationError: unknown) {
        if (validationError instanceof Error && 'errors' in validationError) {
          return createErrorResponse('Invalid input', 400, (validationError as { errors: unknown }).errors);
        }
        return createErrorResponse('Invalid input', 400);
      }

      const { reward_id: rewardId } = validatedData;
      logger.info('Processing reward claim', { rewardId, userId: user.id });

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // 1. Insert into reward_claims
      const supabase = getDatabaseClient();
      const { error: claimError } = await supabase
        .from('reward_claims')
        .insert({
          reward_id: rewardId,
          user_id: user.id
        });

      if (claimError) {
        logger.error('Error claiming reward', claimError, { rewardId, userId: user.id });
        return createErrorResponse('Failed to claim reward', 500, claimError.message);
      }

      // 2. Fetch the full reward row by ID
      const { data: reward, error: rewardError } = await supabase
        .from('rewards')
        .select('*')
        .eq('id', rewardId)
        .single();

      if (rewardError) {
        logger.error('Error fetching reward details', rewardError, { rewardId });
        return createErrorResponse('Failed to fetch reward details', 500, rewardError.message);
      }

      if (!reward) {
        logger.warn('Reward not found', { rewardId });
        return createErrorResponse('Reward not found', 404);
      }

      // 3. Check if reward has a recognized type and handle power-ups
      if (reward.type) {
        logger.info('Processing configured power-up type', { rewardType: reward.type });
        let expiresAt = null;
        
        // Set expiration based on type
        switch (reward.type) {
          case 'xp_boost':
          case 'double_coin':
            expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days
            break;
          case 'custom_theme':
          case 'pro_badge':
          case 'priority_support':
          case 'analytics':
            expiresAt = null; // Permanent
            break;
          default:
          logger.warn('Unknown reward type', { rewardType: reward.type });
            return createSuccessResponse({ success: true }, 'Reward claimed successfully');
        }

        // 4. Insert into power_ups table
        const { error: powerUpError } = await supabase
          .from('power_ups')
          .upsert({
            user_id: user.id,
            type: reward.type,
            expires_at: expiresAt
          }, {
            onConflict: 'user_id,type'
          });

        if (powerUpError) {
        logger.error('Error creating power-up', powerUpError, { rewardType: reward.type, userId: user.id });
          return createErrorResponse('Failed to create power-up', 500, powerUpError.message);
        }

      logger.info('Power-up created', {
        rewardType: reward.type,
        expiresAt,
        userId: user.id,
      });
      } else {
        logger.info('Reward has no power-up type; skipping power-up', { rewardId });
      }

      // Add audit log entry
      await createAuditLog({
        action: 'reward.claimed',
        targetTable: 'rewards',
        targetId: rewardId,
        userId: user.id,
        metadata: { 
          reward_name: reward.name,
          reward_type: reward.type,
          household_id: household.id
        }
      });

      return createSuccessResponse({ success: true }, 'Reward claimed successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/rewards/claim', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
} 