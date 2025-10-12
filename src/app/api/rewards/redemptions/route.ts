import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Create a Supabase client with service role key for server-side operations
const supabase: SupabaseClient<Database> = createClient(supabaseUrl, supabaseServiceKey);

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
      logger.error('Error fetching reward redemptions', error, { householdId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filteredData = data.filter(item => {
      // Handle case where reward might be an array or single object
      const reward = Array.isArray(item.reward) ? item.reward[0] : item.reward;
      return reward && reward.household_id === householdId;
    });
    return NextResponse.json({ data: filteredData });
  } catch (error) {
    logger.error('Exception in GET /api/rewards/redemptions', error instanceof Error ? error : new Error(String(error)));
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
      logger.error('Error redeeming reward', error, { rewardId, userId, cost });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Deduct XP from user
    const { error: xpError } = await supabase.rpc('increment_user_xp', {
      user_id: userId,
      amount: -cost
    });

    if (xpError) {
      logger.error('Error deducting XP during reward redemption', xpError, { rewardId, userId, cost });
      return NextResponse.json({ error: xpError }, { status: 500 });
    }

    logger.info('Reward redeemed and XP deducted', { rewardId, userId, cost });
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Exception in POST /api/rewards/redemptions', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 