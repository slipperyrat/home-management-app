import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';
import { logger } from '@/lib/logging/logger';
import { jobSuccessCounter, jobFailureCounter, jobDurationHistogram } from '@/app/metrics/router';

export async function GET(request: NextRequest) {
  const start = performance.now();
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
      logger.warn('Automation worker access denied', {
        userId,
        householdId,
        error: membershipError?.message,
      });
      throw new ServerError('Access denied to household', 403);
    }

    // Call the Supabase automation worker function
    const { data, error } = await sb().functions.invoke('automation-worker', {
      body: {
        household_id: householdId
      }
    });

    if (error) {
      logger.error('Automation worker execution failed', error, {
        userId,
        householdId,
      });
      throw new ServerError('Failed to run automation worker', 500);
    }

    const duration = performance.now() - start;
    logger.performance('automation.worker.invoke', duration, {
      userId,
      householdId,
    });

    logger.info('Automation worker executed', {
      userId,
      householdId,
      duration,
    });

    jobSuccessCounter.inc({ job: 'automation-worker' });
    jobDurationHistogram.observe({ job: 'automation-worker' }, duration);

    return NextResponse.json({
      success: true,
      message: 'Automation worker executed successfully',
      result: data
    });

  } catch (error) {
    jobFailureCounter.inc({ job: 'automation-worker' });
    jobDurationHistogram.observe({ job: 'automation-worker' }, performance.now() - start);
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    logger.error('Unexpected automation worker error', error as Error, {
      route: '/api/automation/run-worker',
    });
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
