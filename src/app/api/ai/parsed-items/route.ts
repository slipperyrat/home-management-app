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

    // Get parsed items for the household
    const { data: parsedItems, error } = await supabase
      .from('ai_parsed_items')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching parsed items:', error);
      return NextResponse.json({ error: 'Failed to fetch parsed items' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: parsedItems || []
    });

  } catch (error) {
    console.error('Error in parsed items API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
