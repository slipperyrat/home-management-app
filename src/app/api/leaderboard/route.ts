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

    console.log(`🏆 Leaderboard request for user: ${userId}`);

    // First, get the user's household_id from household_members table
    const { data: userHousehold, error: householdError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();

    if (householdError) {
      console.error('❌ Error fetching user household:', householdError);
      return NextResponse.json({ error: 'Failed to fetch user household' }, { status: 500 });
    }

    if (!userHousehold) {
      console.error('❌ User not found in household_members');
      return NextResponse.json({ error: 'User not found in household' }, { status: 404 });
    }

    const householdId = userHousehold.household_id;
    console.log(`🏠 User household_id: ${householdId}`);

    // Get all users in the same household with their XP
    // First get the household member IDs
    const { data: memberIds, error: membersError } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId);

    if (membersError) {
      console.error('❌ Error fetching household members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
    }

    if (!memberIds || memberIds.length === 0) {
      console.log('📭 No household members found');
      return NextResponse.json({ 
        success: true, 
        leaderboard: [],
        householdId 
      });
    }

    // Then get the user data for all members
    const userIds = memberIds.map(m => m.user_id);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, xp, email')
      .in('id', userIds)
      .order('xp', { ascending: false })
      .limit(10);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
    }

    // Transform the data to match the expected format
    const leaderboard = users?.map(user => ({
      id: user.id,
      xp: user.xp || 0,
      username: user.email || `User ${user.id.slice(-4)}`
    })) || [];

    console.log(`📊 Leaderboard data:`, leaderboard);

    return NextResponse.json({ 
      success: true, 
      leaderboard,
      householdId 
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 