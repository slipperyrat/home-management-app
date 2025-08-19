import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

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

    // Get user's household
    const { data: userHousehold, error: householdError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();

    if (householdError || !userHousehold) {
      return NextResponse.json({ error: 'No household found' }, { status: 400 });
    }

    const householdId = userHousehold.household_id;

    // Fetch bills for the household
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('*')
      .eq('household_id', householdId)
      .order('due_date', { ascending: true });

    if (billsError) {
      console.error('Error fetching bills:', billsError);
      return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
    }

    // Transform bills to match the frontend interface
    const transformedBills = (bills || []).map(bill => ({
      id: bill.id,
      title: bill.name || bill.title || 'Untitled Bill',
      amount: bill.amount || 0,
      due_date: bill.due_date,
      category: bill.category || 'other',
      provider: bill.source || bill.provider || 'Unknown',
      status: bill.status || 'unpaid',
      ai_confidence: bill.ai_confidence || 0.8, // Default confidence for existing bills
      ai_category_suggestion: bill.ai_category_suggestion,
      ai_amount_prediction: bill.ai_amount_prediction,
      created_at: bill.created_at
    }));

    return NextResponse.json({
      success: true,
      bills: transformedBills
    });

  } catch (error) {
    console.error('Error in bills API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, amount, due_date, category, provider } = body;

    // Get user's household
    const { data: userHousehold, error: householdError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', userId)
      .single();

    if (householdError || !userHousehold) {
      return NextResponse.json({ error: 'No household found' }, { status: 400 });
    }

    const householdId = userHousehold.household_id;

    // Create new bill
    const { data: newBill, error: createError } = await supabase
      .from('bills')
      .insert({
        household_id: householdId,
        name: title,
        amount: parseFloat(amount),
        due_date: due_date,
        category: category || 'other',
        source: provider,
        status: 'unpaid',
        created_by: userId,
        ai_confidence: 1.0 // User-created bills have 100% confidence
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating bill:', createError);
      return NextResponse.json({ error: 'Failed to create bill' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      bill: newBill
    });

  } catch (error) {
    console.error('Error in bills POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
