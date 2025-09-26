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

const ResolveConflictSchema = z.object({
  resolution_notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { resolution_notes } = ResolveConflictSchema.parse(body);

    // Get the conflict to verify access
    const { data: conflict, error: conflictError } = await supabase
      .from('calendar_conflicts')
      .select(`
        *,
        household_id
      `)
      .eq('id', id)
      .single();

    if (conflictError || !conflict) {
      return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });
    }

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('household_id', conflict.household_id)
      .eq('user_id', userId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 });
    }

    // Update the conflict as resolved
    const { data: updatedConflict, error: updateError } = await supabase
      .from('calendar_conflicts')
      .update({
        resolved: true,
        resolution_notes: resolution_notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error resolving conflict:', updateError);
      return NextResponse.json({ error: 'Failed to resolve conflict' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedConflict
    });
  } catch (error) {
    console.error('Error in POST /api/conflicts/[id]/resolve:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}