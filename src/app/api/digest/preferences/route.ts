import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { DEFAULT_DIGEST_PREFERENCES } from '@/hooks/useDigestPreferences';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 GET: Fetching digest preferences for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      // Fetch existing preferences or return defaults
      const { data: preferences, error } = await supabase
        .from('digest_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('household_id', household.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching digest preferences:', error);
        return createErrorResponse('Failed to fetch digest preferences', 500, error.message);
      }

      // If no preferences exist, return defaults with user/household info
      if (!preferences) {
        const defaultPreferences = {
          ...DEFAULT_DIGEST_PREFERENCES,
          user_id: user.id,
          household_id: household.id,
          email_address: userData?.email || '',
        };
        
        return createSuccessResponse(defaultPreferences, 'Default digest preferences');
      }

      return createSuccessResponse(preferences, 'Digest preferences fetched successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/digest/preferences', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function PUT(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 PUT: Updating digest preferences for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const body = await req.json();
      const supabase = getDatabaseClient();

      // Validate email if provided
      if (body.email_address && !isValidEmail(body.email_address)) {
        return createErrorResponse('Invalid email address', 400);
      }

      // Validate time format
      if (body.daily_digest_time && !isValidTime(body.daily_digest_time)) {
        return createErrorResponse('Invalid daily digest time format (use HH:MM)', 400);
      }

      if (body.weekly_digest_time && !isValidTime(body.weekly_digest_time)) {
        return createErrorResponse('Invalid weekly digest time format (use HH:MM)', 400);
      }

      // Check if preferences exist
      const { data: existingPreferences, error: fetchError } = await supabase
        .from('digest_preferences')
        .select('id')
        .eq('user_id', user.id)
        .eq('household_id', household.id)
        .single();

      const updateData = {
        ...body,
        user_id: user.id,
        household_id: household.id,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (existingPreferences && !fetchError) {
        // Update existing preferences
        const { data, error } = await supabase
          .from('digest_preferences')
          .update(updateData)
          .eq('id', existingPreferences.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating digest preferences:', error);
          return createErrorResponse('Failed to update digest preferences', 500, error.message);
        }

        result = data;
      } else {
        // Create new preferences
        const { data, error } = await supabase
          .from('digest_preferences')
          .insert({
            ...updateData,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating digest preferences:', error);
          return createErrorResponse('Failed to create digest preferences', 500, error.message);
        }

        result = data;
      }

      return createSuccessResponse(result, 'Digest preferences updated successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/digest/preferences', method: 'PUT', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

// Helper functions
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidTime(time: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}
