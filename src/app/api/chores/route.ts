import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { createChoreSchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 GET: Fetching chores for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Query chores for the household
      const supabase = getDatabaseClient();
      const { data: chores, error } = await supabase
        .from('chores')
        .select('*')
        .eq('household_id', household.id)
        .order('due_at', { ascending: true });

      if (error) {
        console.error('Error fetching chores:', error);
        return createErrorResponse('Failed to fetch chores', 500, error.message);
      }

      return createSuccessResponse({ chores: chores || [] }, 'Chores fetched successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/chores', method: 'GET', userId: user.id });
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
      console.log('🚀 POST: Creating chore for user:', user.id);

      // Validate input using Zod schema
      let validatedData;
      try {
        const body = await req.json();
        console.log('🔍 Request body:', JSON.stringify(body, null, 2));
        validatedData = createChoreSchema.parse(body);
        console.log('✅ Validation passed:', JSON.stringify(validatedData, null, 2));
      } catch (validationError: any) {
        console.error('❌ Validation failed:', validationError.errors);
        return createErrorResponse('Invalid input', 400, validationError.errors);
      }

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Extract validated data
      const { 
        title, 
        description, 
        assigned_to, 
        due_at, 
        rrule, 
        dtstart,
        category = 'general',
        priority = 'medium',
        ai_difficulty_rating,
        ai_estimated_duration,
        ai_preferred_time,
        ai_energy_level,
        ai_skill_requirements,
        assignment_strategy
      } = validatedData;

      // Convert datetime strings to proper ISO format
      const formatDateTime = (dateStr: string | null | undefined) => {
        if (!dateStr) return null;
        try {
          // If it's already in ISO format, return as is
          if (dateStr.includes('T') && dateStr.includes('Z')) {
            return dateStr;
          }
          // If it's in local datetime format, convert to ISO
          return new Date(dateStr).toISOString();
        } catch {
          return null;
        }
      };

      const choreData = {
        title,
        description: description || null,
        assigned_to: assigned_to || null,
        due_at: formatDateTime(due_at),
        rrule: rrule || null,
        dtstart: formatDateTime(dtstart),
        category,
        priority,
        ai_difficulty_rating: ai_difficulty_rating || 50,
        ai_estimated_duration: ai_estimated_duration || 30,
        ai_preferred_time: ai_preferred_time || 'anytime',
        ai_energy_level: ai_energy_level || 'medium',
        ai_skill_requirements: ai_skill_requirements || [],
        assignment_strategy: assignment_strategy || 'auto',
        ai_confidence: 75,
        ai_suggested: false,
        status: 'pending',
        created_by: user.id,
        household_id: household.id
      };

      console.log('Creating chore:', choreData);

      const supabase = getDatabaseClient();
      const { data, error } = await supabase
        .from('chores')
        .insert(choreData)
        .select()
        .single();

      if (error) {
        console.error('Error creating chore:', error);
        return createErrorResponse('Failed to create chore', 500, error.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'chore.created',
        targetTable: 'chores',
        targetId: data.id,
        userId: user.id,
        metadata: { 
          chore_title: title,
          household_id: household.id,
          assigned_to: assigned_to || 'unassigned'
        }
      });

      console.log('Successfully created chore:', data);
      return createSuccessResponse({ chore: data }, 'Chore created successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/chores', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
} 