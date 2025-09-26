import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuth } from '@clerk/nextjs/server';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CanPerformActionSchema = z.object({
  householdId: z.string().uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { householdId } = CanPerformActionSchema.parse({ householdId: (await params).householdId });
    
    
    // Get user and verify household access
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Verify user has access to this household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 });
    }
    
    // Call the can_perform_action function
    const { data, error } = await supabase.rpc('can_perform_action', {
      p_household_id: householdId
    });
    
    if (error) {
      console.error('Error checking quota:', error);
      return NextResponse.json({ error: 'Failed to check quota' }, { status: 500 });
    }
    
    return NextResponse.json({ canPerform: data });
  } catch (error) {
    console.error('Error in POST /api/entitlements/[householdId]/can-perform-action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
