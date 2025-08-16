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

    // Call the Supabase automation worker function
    const { data, error } = await sb().functions.invoke('automation-worker', {
      body: {},
      query: {
        household_id: householdId
      }
    });

    if (error) {
      console.error('Automation worker error:', error);
      throw new ServerError('Failed to run automation worker', 500);
    }

    console.log('✅ Automation worker executed successfully:', data);

    return NextResponse.json({
      success: true,
      message: 'Automation worker executed successfully',
      result: data
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
