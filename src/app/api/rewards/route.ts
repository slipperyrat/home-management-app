import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createRewardSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      logger.info('Fetching rewards', { userId: user.id });

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .or(`household_id.eq.${household.id},household_id.is.null`)
        .order('cost_xp', { ascending: true });

      if (error) {
        logger.error('Error fetching rewards', error, { householdId: household.id });
        return createErrorResponse('Failed to fetch rewards', 500, error.message);
      }

      return createSuccessResponse({ rewards: data || [] }, 'Rewards fetched successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/rewards', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      logger.info('Creating reward', { userId: user.id });

      // Parse and validate request body using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        validatedData = createRewardSchema.parse(body);
      } catch (validationError: unknown) {
        if (validationError instanceof Error && 'errors' in validationError) {
          return createErrorResponse('Invalid input', 400, (validationError as { errors: unknown }).errors);
        }
        return createErrorResponse('Invalid input', 400);
      }

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { title, points_cost: cost_xp } = validatedData;

      const rewardData = {
        title,
        cost_xp,
        household_id: household.id,
        created_by: user.id
      };

      const supabase = getDatabaseClient();
      const { data, error } = await supabase
        .from('rewards')
        .insert(rewardData)
        .select()
        .single();

      if (error) {
        logger.error('Error creating reward', error, { householdId: household.id, userId: user.id });
        return createErrorResponse('Failed to create reward', 500, error.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'reward.created',
        targetTable: 'rewards',
        targetId: data.id,
        userId: user.id,
        metadata: { 
          reward_title: title,
          cost_xp,
          household_id: household.id
        }
      });

      logger.info('Reward created', { rewardId: data.id, householdId: household.id, userId: user.id });
      return createSuccessResponse({ reward: data }, 'Reward created successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/rewards', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
} 