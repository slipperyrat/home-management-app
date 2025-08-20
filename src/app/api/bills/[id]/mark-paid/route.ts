import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const billId = resolvedParams.id;
    
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

    // First, verify the bill exists and belongs to the user's household
    const { data: existingBill, error: fetchError } = await supabase
      .from('bills')
      .select('*')
      .eq('id', billId)
      .eq('household_id', userData.household_id)
      .single();

    if (fetchError || !existingBill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Update the bill to mark it as paid
    const { data: updatedBill, error: updateError } = await supabase
      .from('bills')
      .update({
        status: 'paid',
        paid_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('id', billId)
      .eq('household_id', userData.household_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bill:', updateError);
      return NextResponse.json({ 
        error: 'Failed to mark bill as paid' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      bill: updatedBill,
      message: 'Bill marked as paid successfully' 
    });

  } catch (error) {
    console.error('Exception in POST /api/bills/[id]/mark-paid:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
