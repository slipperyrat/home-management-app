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

const GetEntitlementsSchema = z.object({
  householdId: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { householdId } = GetEntitlementsSchema.parse({ householdId: (await params).householdId });
    
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
    
    // Get entitlements
    const { data: entitlements, error: entitlementsError } = await supabase
      .from('entitlements')
      .select('*')
      .eq('household_id', householdId)
      .single();
    
    if (entitlementsError) {
      console.error('Error fetching entitlements:', entitlementsError);
      return NextResponse.json({ error: 'Failed to fetch entitlements' }, { status: 500 });
    }
    
    if (!entitlements) {
      return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
    }
    
    return NextResponse.json(entitlements);
  } catch (error) {
    console.error('Error in GET /api/entitlements/[householdId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
