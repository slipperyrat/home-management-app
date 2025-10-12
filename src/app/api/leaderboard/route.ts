import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

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

    const { data: userHousehold, error: householdError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();

    if (householdError) {
      return NextResponse.json({ error: 'Failed to fetch user household' }, { status: 500 });
    }

    if (!userHousehold) {
      return NextResponse.json({ error: 'User not found in household' }, { status: 404 });
    }

    const householdId = userHousehold.household_id;

    const { data: memberIds, error: membersError } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId);

    if (membersError) {
      return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
    }

    if (!memberIds || memberIds.length === 0) {
      return NextResponse.json({ success: true, leaderboard: [], householdId });
    }

    const userIds = memberIds.map((m) => m.user_id);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, xp, email')
      .in('id', userIds)
      .order('xp', { ascending: false })
      .limit(10);

    if (usersError) {
      return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
    }

    const leaderboard = (users ?? []).map((user) => ({
      id: user.id,
      xp: user.xp || 0,
      username: user.email || `User ${user.id.slice(-4)}`,
    }));

    return NextResponse.json({ success: true, leaderboard, householdId });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 