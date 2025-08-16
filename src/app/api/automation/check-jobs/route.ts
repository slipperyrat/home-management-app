import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sb, ServerError, createErrorResponse } from '@/lib/server/supabaseAdmin';

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
      throw new ServerError('Access denied to household', 403);
    }

    // Get automation jobs using admin client (bypasses RLS)
    const { data: jobs, error: jobsError } = await sb()
      .from('automation_jobs')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (jobsError) {
      console.error('Error fetching automation jobs:', jobsError);
      throw new ServerError('Failed to fetch automation jobs', 500);
    }

    console.log(`✅ Found ${jobs?.length || 0} automation jobs for household: ${householdId}`);

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
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
