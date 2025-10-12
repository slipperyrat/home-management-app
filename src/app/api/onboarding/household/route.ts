import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';
import { onboardingHouseholdSchema } from '@/lib/validation/schemas';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { createSuccessResponse, createValidationErrorResponse, handleApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async () => {
    try {
      const { userId } = await auth();

      if (!userId) {
        throw new ServerError('Unauthorized', 401);
      }

      const body = await request.json();
      const validation = onboardingHouseholdSchema.safeParse(body);

      if (!validation.success) {
        return createValidationErrorResponse(validation.error.errors);
      }

      const { name, game_mode } = validation.data;

      const { data: household, error: householdError } = await sb()
        .from('households')
        .insert({
          name,
          game_mode,
          created_by: userId,
        })
        .select()
        .single();

      if (householdError) {
        throw new ServerError('Failed to create household', 500);
      }

      const { error: memberError } = await sb()
        .from('household_members')
        .insert({
          household_id: household.id,
          user_id: userId,
          role: 'admin',
          joined_at: new Date().toISOString(),
        });

      if (memberError) {
        throw new ServerError('Failed to add user to household', 500);
      }

      const { error: userError } = await sb()
        .from('users')
        .update({
          household_id: household.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (userError) {
        throw new ServerError('Failed to update user', 500);
      }

      return createSuccessResponse({
        household: {
          id: household.id,
          name: household.name,
          gameMode: household.game_mode,
        }
      }, 'Household created successfully');
    } catch (error) {
      if (error instanceof ServerError) {
        return createErrorResponse(error);
      }

      return handleApiError(error, { route: '/api/onboarding/household', method: 'POST' });
    }
  }, {
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
