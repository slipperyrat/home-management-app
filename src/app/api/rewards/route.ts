import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import type { Database } from '@/types/supabase.generated';
import { createRewardSchema } from '@/lib/validation/schemas';

import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      logger.info('Fetching rewards', { userId: user.id });

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

      return createSuccessResponse({ rewards: data ?? [] }, 'Rewards fetched successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/rewards', method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      logger.info('Creating reward', { userId: user.id });

      let validatedData: z.infer<typeof createRewardSchema>;
      try {
        const body = await req.json();
        validatedData = createRewardSchema.parse(body);
      } catch (validationError: unknown) {
        if (validationError instanceof z.ZodError) {
          return createErrorResponse('Invalid input', 400, validationError.errors);
        }
        return createErrorResponse('Invalid input', 400);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();
      const rewardData = {
        title: validatedData.name,
        household_id: household.id,
        pro_only: validatedData.is_active === false ? false : Boolean(validatedData.pro_only ?? false),
        created_by: user.id,
        cost_xp: validatedData.points_cost,
        cost_coins: validatedData.coins_cost ?? 0,
        description: validatedData.description ?? null,
      } satisfies Database['public']['Tables']['rewards']['Insert'];

      const { data, error } = await supabase
        .from('rewards')
        .insert(rewardData)
        .select('*')
        .maybeSingle();

      if (error || !data) {
        logger.error('Error creating reward', error ?? new Error('Insert failed'), { householdId: household.id, userId: user.id });
        return createErrorResponse('Failed to create reward', 500, error?.message ?? 'Insert failed');
      }

      await createAuditLog({
        action: 'reward.created',
        targetTable: 'rewards',
        targetId: data.id,
        userId: user.id,
        metadata: {
          reward_name: validatedData.name,
          cost_xp: validatedData.points_cost,
          household_id: household.id,
        },
      });

      logger.info('Reward created', { rewardId: data.id, householdId: household.id, userId: user.id });
      return createSuccessResponse({ reward: data }, 'Reward created successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/rewards', method: 'POST', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
} 