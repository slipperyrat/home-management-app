import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { DEFAULT_DIGEST_PREFERENCES } from '@/hooks/useDigestPreferences';
import type { Database } from '@/types/supabase.generated';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      const { data: preferences, error } = await supabase
        .from('digest_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('household_id', household.id)
        .maybeSingle<Database['public']['Tables']['digest_preferences']['Row']>();

      if (error && error.code !== 'PGRST116') {
        return createErrorResponse('Failed to fetch digest preferences', 500, error.message);
      }

      if (!preferences) {
        const defaultPreferences = {
          ...DEFAULT_DIGEST_PREFERENCES,
          user_id: user.id,
          household_id: household.id,
          email_address: userData?.email ?? '',
        } satisfies Database['public']['Tables']['digest_preferences']['Insert'];

        return createSuccessResponse(defaultPreferences, 'Default digest preferences');
      }

      return createSuccessResponse(preferences, 'Digest preferences fetched successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/digest/preferences', method: 'GET', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
  });
}

export async function PUT(request: NextRequest) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const body = await _req.json();
      const supabase = getDatabaseClient();

      if (body.email_address && !isValidEmail(body.email_address)) {
        return createErrorResponse('Invalid email address', 400);
      }

      if (body.daily_digest_time && !isValidTime(body.daily_digest_time)) {
        return createErrorResponse('Invalid daily digest time format (use HH:MM)', 400);
      }

      if (body.weekly_digest_time && !isValidTime(body.weekly_digest_time)) {
        return createErrorResponse('Invalid weekly digest time format (use HH:MM)', 400);
      }

      const { data: existingPreferences, error: fetchError } = await supabase
        .from('digest_preferences')
        .select('id')
        .eq('user_id', user.id)
        .eq('household_id', household.id)
        .maybeSingle<{ id: string }>();

      const updateData: Database['public']['Tables']['digest_preferences']['Insert'] = {
        ...body,
        user_id: user.id,
        household_id: household.id,
        updated_at: new Date().toISOString(),
      };

      let result: Database['public']['Tables']['digest_preferences']['Row'];

      if (existingPreferences && !fetchError) {
        const { data, error } = await supabase
          .from('digest_preferences')
          .update(updateData)
          .eq('id', existingPreferences.id)
          .select('*')
          .maybeSingle<Database['public']['Tables']['digest_preferences']['Row']>();

        if (error || !data) {
          return createErrorResponse('Failed to update digest preferences', 500, error?.message ?? 'Update failed');
        }

        result = data;
      } else {
        const { data, error } = await supabase
          .from('digest_preferences')
          .insert({
            ...updateData,
            created_at: new Date().toISOString(),
          })
          .select('*')
          .maybeSingle<Database['public']['Tables']['digest_preferences']['Row']>();

        if (error || !data) {
          return createErrorResponse('Failed to create digest preferences', 500, error?.message ?? 'Insert failed');
        }

        result = data;
      }

      return createSuccessResponse(result, 'Digest preferences updated successfully');
    } catch (error) {
      return handleApiError(error, { route: '/api/digest/preferences', method: 'PUT', userId: user?.id ?? '' });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
  });
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidTime(time: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}
