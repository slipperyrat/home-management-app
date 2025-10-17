import { NextRequest } from 'next/server';

import { sb, ServerError, createErrorResponse, getUserAndHousehold } from '@/lib/server/supabaseAdmin';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { createSuccessResponse, handleApiError } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async () => {
    try {
      const { userId } = await getUserAndHousehold();

      const { error: userError } = await sb()
        .from('users')
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (userError) {
        throw new ServerError('Failed to complete onboarding', 500);
      }

      return createSuccessResponse({ onboardingCompleted: true }, 'Onboarding completed');
    } catch (error) {
      if (error instanceof ServerError) {
        return createErrorResponse(error);
      }

      return handleApiError(error, { route: '/api/onboarding/complete', method: 'POST', userId: '' });
    }
  }, {
    requireCSRF: true,
    rateLimitConfig: 'api',
  });
}
