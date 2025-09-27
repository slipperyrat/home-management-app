import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';
import { logger } from '@/lib/logging/logger';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      throw new ServerError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('household_id');

    if (!householdId) {
      throw new ServerError('Household ID is required', 400);
    }

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await sb()
      .from('household_members')
      .select('role')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      logger.warn('Automation job check access denied', {
        userId,
        householdId,
        error: membershipError?.message,
      });
      throw new ServerError('Access denied to household', 403);
    }

    const start = performance.now();
    // Get automation jobs using admin client (bypasses RLS)
    const { data: jobs, error: jobsError } = await sb()
      .from('automation_jobs')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (jobsError) {
      logger.error('Error fetching automation jobs', jobsError, {
        userId,
        householdId,
      });
      throw new ServerError('Failed to fetch automation jobs', 500);
    }

    const duration = performance.now() - start;
    logger.performance('automation.check-jobs.fetch', duration, {
      userId,
      householdId,
    });

    logger.info('Automation jobs retrieved', {
      userId,
      householdId,
      count: jobs?.length || 0,
      duration,
    });

    const duration = performance.now() - start;
    logger.performance('automation.check-jobs.fetch', duration, {
      userId,
      householdId,
    });

    return NextResponse.json({
      success: true,
      message: `Found ${jobs?.length || 0} automation jobs`,
      jobs: jobs || [],
      count: jobs?.length || 0
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    logger.error('Unexpected automation job check error', error as Error, {
      route: '/api/automation/check-jobs',
    });
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
