import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getUserPowerUps } from '@/lib/supabase/rewards';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Create a Supabase client with service role key for server-side operations
const supabase: SupabaseClient<Database> = createClient(supabaseUrl, supabaseServiceKey);

interface ChoreCompletion {
  id: string;
  completed_at: string;
  xp_earned: number;
  completed_by: string;
  chore: {
    id: string;
    title: string;
    household_id: string;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('chore_completions')
      .select(`
        id,
        completed_at,
        xp_earned,
        completed_by,
        chore:chore_id (
          id,
          title,
          household_id
        )
      `)
      .order('completed_at', { ascending: false });

    if (error) {
      logger.error('Error fetching chore completions', error, { householdId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filteredData = (data as ChoreCompletion[]).filter(item => {
      // chore is now an array, so we can safely access the first element
      const chore = item.chore[0];
      return chore && chore.household_id === householdId;
    });
    return NextResponse.json({ data: filteredData });
  } catch (error) {
    logger.error('Exception in GET /api/chores/completions', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { choreId, userId, xp = 10 } = body;

    if (!choreId || !userId) {
      return NextResponse.json({ error: 'Chore ID and user ID are required' }, { status: 400 });
    }

    // Check for active xp_boost power-up
    let finalXp = xp;
    try {
      const activePowerUps = await getUserPowerUps(userId);
      const hasXpBoost = activePowerUps.includes('xp_boost');
      
      if (hasXpBoost) {
        // Apply 1.5x multiplier and round down
        finalXp = Math.floor(xp * 1.5);
        logger.info('Applying XP boost', { userId, baseXp: xp, finalXp });
      } else {
        logger.info('No XP boost active', { userId, baseXp: xp });
      }
    } catch (error) {
      logger.error('Error checking power-ups, using base XP', error instanceof Error ? error : new Error(String(error)), { userId });
      // Continue with base XP if power-up check fails
    }

    const { data, error } = await supabase
      .from('chore_completions')
      .insert({
        chore_id: choreId,
        completed_by: userId,
        xp_earned: finalXp
      })
      .select()
      .single();

    if (error) {
      logger.error('Error completing chore', error, { choreId, userId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Award XP to the user with the adjusted amount
    const { error: xpError } = await supabase.rpc('increment_user_xp', {
      user_id: userId,
      amount: finalXp,
    });

    if (xpError) {
      logger.error('Error awarding XP', xpError, { userId, awardedXp: finalXp });
      return NextResponse.json({ error: xpError }, { status: 500 });
    }

    logger.info('Chore completed and XP awarded', { choreId, userId, finalXp });
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Exception in POST /api/chores/completions', error instanceof Error ? error : new Error(String(error)), {
      householdId: (await params).householdId,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 