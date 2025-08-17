import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's household
    const { data: userHousehold, error: householdError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();

    if (householdError || !userHousehold) {
      return NextResponse.json({ error: 'User not found in household' }, { status: 404 });
    }

    const householdId = userHousehold.household_id;

    // Get email queue for the household
    const { data: emailQueue, error } = await supabase
      .from('ai_email_queue')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching email queue:', error);
      return NextResponse.json({ error: 'Failed to fetch email queue' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: emailQueue || []
    });

  } catch (error) {
    console.error('Error in email queue API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
