import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(_request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's household ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'User not found or no household' }, { status: 404 });
    }

    // Fetch bills for the household
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .eq('household_id', userData.household_id)
      .order('due_date', { ascending: true });

    if (billsError) {
      console.error('Error fetching bills:', billsError);
      return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      bills: bills || [] 
    });

  } catch (error) {
    console.error('Exception in GET /api/bills:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's household ID
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'User not found or no household' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { title, description, amount, due_date, category, priority } = body;

    // Validate required fields
    if (!title || !amount || !due_date) {
      return NextResponse.json({ 
        error: 'Missing required fields: title, amount, due_date' 
      }, { status: 400 });
    }

    // Create the bill
    const { data: bill, error: createError } = await supabase
      .from('bills')
      .insert({
        household_id: userData.household_id,
        title,
        description,
        amount: parseFloat(amount),
        due_date,
        category: category || 'General',
        priority: priority || 'medium',
        source: 'manual',
        created_by: user.id
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating bill:', createError);
      return NextResponse.json({ 
        error: 'Failed to create bill' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      bill,
      message: 'Bill created successfully' 
    });

  } catch (error) {
    console.error('Exception in POST /api/bills:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
