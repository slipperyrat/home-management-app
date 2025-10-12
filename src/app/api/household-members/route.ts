import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

type HouseholdMembership = {
  household_id: string;
};

type HouseholdMemberRow = {
  user_id: string;
  role: string | null;
  users: {
    id: string;
    email: string | null;
    name: string | null;
  } | null;
};

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single<HouseholdMembership>();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select('user_id, role, users:users(id, email, name)')
      .eq('household_id', membership.household_id)
      .order('created_at', { ascending: true })
      .returns<HouseholdMemberRow[]>();

    if (membersError || !members) {
      return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
    }

    const normalizedMembers = members.map((member) => ({
      userId: member.user_id,
      role: member.role,
      name: member.users?.name ?? null,
      email: member.users?.email ?? null,
    }));

    return NextResponse.json({ householdId: membership.household_id, members: normalizedMembers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}

