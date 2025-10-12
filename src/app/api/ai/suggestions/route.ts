import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey);

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
      logger.error('Error fetching AI suggestions', error, { householdId, status });
      return NextResponse.json({ error: 'Failed to fetch AI suggestions' }, { status: 500 });
    }

    logger.info('Fetched AI suggestions', {
      householdId,
      status,
      count: suggestions?.length ?? 0,
      sampleFeedback: suggestions?.[0]?.user_feedback,
    });

    return NextResponse.json({
      success: true,
      data: suggestions || []
    });

  } catch (error) {
    logger.error('Error in AI suggestions API', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
