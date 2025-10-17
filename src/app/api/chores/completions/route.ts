import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getUserPowerUps } from '@/lib/supabase/rewards';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/supabase.generated';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Create a Supabase client with service role key for server-side operations
const supabase: SupabaseClient<Database> = createClient(supabaseUrl, supabaseServiceKey);

type ChoreCompletionRecord = Database['public']['Tables']['chore_completions']['Row'] & {
  chore: Pick<Database['public']['Tables']['chores']['Row'], 'id' | 'title' | 'household_id'> | null;
};

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
      const logError = error instanceof Error
        ? error
        : new Error(typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: unknown }).message) : 'Postgrest error');
      logger.error('Error fetching chore completions', logError, { householdId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filteredData = (data ?? []).filter((item): item is ChoreCompletionRecord => {
      const chore = item.chore as ChoreCompletionRecord['chore'];
      return Boolean(chore && chore.household_id === householdId);
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

    const insertPayload: Database['public']['Tables']['chore_completions']['Insert'] = {
      chore_id: choreId,
      completed_by: userId,
      xp_earned: finalXp,
    };

    const { data, error } = await supabase
      .from('chore_completions')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      const logError = error instanceof Error
        ? error
        : new Error(typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: unknown }).message) : 'Postgrest error');
      logger.error('Error completing chore', logError, { choreId, userId });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Award XP to the user with the adjusted amount
    const { error: xpError } = await supabase.rpc('increment_user_xp', {
      user_id: userId,
      amount: finalXp,
    });

    if (xpError) {
      const logError = xpError instanceof Error
        ? xpError
        : new Error(typeof xpError === 'object' && xpError !== null && 'message' in xpError ? String((xpError as { message?: unknown }).message) : 'Postgrest error');
      logger.error('Error awarding XP', logError, {
        userId,
        awardedXp: finalXp,
      });
      return NextResponse.json({ error: logError.message }, { status: 500 });
    }

    logger.info('Chore completed and XP awarded', { choreId, userId, finalXp });
    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Exception in POST /api/chores/completions', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 