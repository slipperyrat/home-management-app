import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(_req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update the user's onboarding status
    const { data, error } = await supabase
      .from('users')
      .update({ has_onboarded: true })
      .eq('clerk_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating onboarding status:', error);
      return NextResponse.json({ error: 'Failed to update onboarding status' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Onboarding completed successfully',
      user: data
    });

  } catch (error) {
    console.error('Error in fix-onboarding endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
