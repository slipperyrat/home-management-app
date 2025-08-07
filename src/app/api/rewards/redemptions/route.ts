import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Create a Supabase client with service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('reward_redemptions')
      .select(`
        id,
        xp_spent,
        redeemed_at,
        user_id,
        reward:reward_id (
          id,
          title,
          household_id
        )
      `)
      .order('redeemed_at', { ascending: false });

    if (error) {
      console.error('Error fetching redemptions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filteredData = data.filter(item => item.reward.household_id === householdId);
    return NextResponse.json({ data: filteredData });
  } catch (error) {
    console.error('Exception in GET /api/rewards/redemptions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rewardId, userId, cost } = body;

    if (!rewardId || !userId || cost === undefined) {
      return NextResponse.json({ error: 'Reward ID, user ID, and cost are required' }, { status: 400 });
    }

    console.log('Redeeming reward:', { rewardId, userId, cost });

    // Insert redemption record
    const { data, error } = await supabase
      .from('reward_redemptions')
      .insert({
        reward_id: rewardId,
        user_id: userId,
        xp_spent: cost
      })
      .select()
      .single();

    if (error) {
      console.error('Error redeeming reward:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Deduct XP from user
    const { error: xpError } = await supabase.rpc('increment_user_xp', {
      user_id: userId,
      amount: -cost
    });

    if (xpError) {
      console.error('Error deducting XP:', xpError);
      return NextResponse.json({ error: xpError }, { status: 500 });
    }

    console.log('Successfully redeemed reward and deducted XP:', data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Exception in POST /api/rewards/redemptions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 