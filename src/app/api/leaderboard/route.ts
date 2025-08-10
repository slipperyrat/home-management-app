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
    const { data: householdUsers, error: usersError } = await supabase
      .from('household_members')
      .select(`
        user_id,
        users!inner (
          id,
          xp,
          email
        )
      `)
      .eq('household_id', householdId)
      .limit(10);

    if (usersError) {
      console.error('❌ Error fetching household users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
    }

    // Transform the data to match the expected format and sort by XP (descending)
    const leaderboard = householdUsers
      ?.map((member, index) => {
        // Handle case where users might be an array or single object
        const user = Array.isArray(member.users) ? member.users[0] : member.users;
        return {
          id: user?.id || `user-${index}`,
          xp: user?.xp || 0,
          username: user?.email || `User ${index + 1}`
        };
      })
      .sort((a, b) => b.xp - a.xp) // Sort by XP descending
      .slice(0, 10) || [];

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