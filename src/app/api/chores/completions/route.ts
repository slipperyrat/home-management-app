import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserPowerUps } from '@/lib/supabase/rewards';

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
      console.error('Error fetching chore completions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filteredData = data.filter(item => item.chore.household_id === householdId);
    return NextResponse.json({ data: filteredData });
  } catch (error) {
    console.error('Exception in GET /api/chores/completions:', error);
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

    console.log('Completing chore:', { choreId, userId, xp });

    // Check for active xp_boost power-up
    let finalXp = xp;
    try {
      const activePowerUps = await getUserPowerUps(userId);
      const hasXpBoost = activePowerUps.includes('xp_boost');
      
      if (hasXpBoost) {
        // Apply 1.5x multiplier and round down
        finalXp = Math.floor(xp * 1.5);
        console.log(`🎯 User ${userId} has active xp_boost power-up - applying 1.5x multiplier: ${xp} → ${finalXp}`);
      } else {
        console.log(`🎯 User ${userId} has no active xp_boost power-up - using base XP: ${xp}`);
      }
    } catch (error) {
      console.error('Error checking power-ups, using base XP:', error);
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
      console.error('Error completing chore:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Award XP to the user with the adjusted amount
    const { error: xpError } = await supabase.rpc('increment_user_xp', {
      user_id: userId,
      amount: finalXp,
    });

    if (xpError) {
      console.error('Error awarding XP:', xpError);
      return NextResponse.json({ error: xpError }, { status: 500 });
    }

    console.log('Successfully completed chore and awarded XP:', data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Exception in POST /api/chores/completions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 