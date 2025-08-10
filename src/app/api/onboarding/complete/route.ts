import { NextRequest, NextResponse } from 'next/server';
import { sb, ServerError, createErrorResponse, getUserAndHousehold } from '@/lib/server/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getUserAndHousehold();

    // Sets users.has_onboarded = true for current user
    const { error: userError } = await sb()
      .from('users')
      .update({ 
        has_onboarded: true,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_id', userId);

    if (userError) {
      console.error('Error updating user onboarding status:', userError);
      throw new ServerError('Failed to complete onboarding', 500);
    }

    console.log(`User ${userId} completed onboarding`);

    return NextResponse.json({ 
      ok: true
    });

  } catch (error) {
    if (error instanceof ServerError) {
      return createErrorResponse(error);
    }
    console.error('Unexpected error:', error);
    return createErrorResponse(new ServerError('Internal server error', 500));
  }
}
