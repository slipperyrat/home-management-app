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
      .from('rewards')
      .select('*')
      .or(`household_id.eq.${householdId},household_id.is.null`)
      .order('cost_xp', { ascending: true });

    if (error) {
      console.error('Error fetching rewards:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Exception in GET /api/rewards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, cost_xp, household_id, created_by } = body;

    if (!title || !cost_xp || !household_id || !created_by) {
      return NextResponse.json({ error: 'Title, cost_xp, household_id, and created_by are required' }, { status: 400 });
    }

    const rewardData = {
      title,
      cost_xp,
      household_id,
      created_by
    };

    console.log('Creating reward:', rewardData);

    const { data, error } = await supabase
      .from('rewards')
      .insert(rewardData)
      .select()
      .single();

    if (error) {
      console.error('Error creating reward:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('Successfully created reward:', data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Exception in POST /api/rewards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 