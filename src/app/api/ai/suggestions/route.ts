import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
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

    // Check if we want processed suggestions or pending ones
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    let query = supabase
      .from('ai_suggestions')
      .select(`
        *,
        parsed_item:ai_parsed_items(
          item_type,
          confidence_score,
          review_status,
          review_reason
        )
      `)
      .eq('household_id', householdId);

    // Filter by status
    if (status === 'pending') {
      query = query.eq('user_feedback', 'pending');
    } else if (status === 'processed') {
      query = query.neq('user_feedback', 'pending');
    }

    const { data: suggestions, error } = await query
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching AI suggestions:', error);
      return NextResponse.json({ error: 'Failed to fetch AI suggestions' }, { status: 500 });
    }

    console.log(`🔍 API: Fetched ${suggestions?.length || 0} suggestions with status=${status}`);
    if (suggestions && suggestions.length > 0) {
      console.log('🔍 API: Sample suggestion user_feedback:', suggestions[0].user_feedback);
    }

    return NextResponse.json({
      success: true,
      data: suggestions || []
    });

  } catch (error) {
    console.error('Error in AI suggestions API:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
