import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 POST: Claiming reward for user:', user.id);

      // Parse and validate request body using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        const { claimRewardSchema } = await import('@/lib/validation/schemas');
        const tempSchema = claimRewardSchema.omit({ household_id: true });
        validatedData = tempSchema.parse(body);
      } catch (validationError: any) {
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      const { reward_id: rewardId } = validatedData;
      console.log(`🎯 Claiming reward ${rewardId} for user ${user.id}`);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
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
        console.error('❌ Error claiming reward:', claimError);
        return createErrorResponse('Failed to claim reward', 500, claimError.message);
      }

      console.log('✅ Reward claimed successfully');

      // 2. Fetch the full reward row by ID
      const { data: reward, error: rewardError } = await supabase
        .from('rewards')
        .select('*')
        .eq('id', rewardId)
        .single();

      if (rewardError) {
        console.error('❌ Error fetching reward details:', rewardError);
        return createErrorResponse('Failed to fetch reward details', 500, rewardError.message);
      }

      if (!reward) {
        console.error('❌ Reward not found:', rewardId);
        return createErrorResponse('Reward not found', 404);
      }

      console.log('📦 Reward details:', { name: reward.name, type: reward.type });

      // 3. Check if reward has a recognized type and handle power-ups
      if (reward.type) {
        console.log(`🎁 Processing power-up for type: ${reward.type}`);
        
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
            console.log(`⚠️ Unknown reward type: ${reward.type}`);
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
          console.error('❌ Error creating power-up:', powerUpError);
          return createErrorResponse('Failed to create power-up', 500, powerUpError.message);
        }

        console.log(`✅ Power-up created: ${reward.type}${expiresAt ? ` (expires: ${expiresAt})` : ' (permanent)'}`);
      } else {
        console.log('ℹ️ No power-up type specified for this reward');
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