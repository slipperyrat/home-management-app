import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createRewardSchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 GET: Fetching rewards for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
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
        console.error('Error fetching rewards:', error);
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
      console.log('🚀 POST: Creating reward for user:', user.id);

      // Parse and validate request body using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        validatedData = createRewardSchema.parse(body);
      } catch (validationError: any) {
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
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

      console.log('Creating reward:', rewardData);

      const supabase = getDatabaseClient();
      const { data, error } = await supabase
        .from('rewards')
        .insert(rewardData)
        .select()
        .single();

      if (error) {
        console.error('Error creating reward:', error);
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

      console.log('Successfully created reward:', data);
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