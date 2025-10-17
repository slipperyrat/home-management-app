import { NextRequest, NextResponse } from 'next/server';
import { sb } from '@/lib/server/supabaseAdmin';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      const userId = user?.id;
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const body = await req.json().catch(() => null);
      if (!body) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { householdId, type, source = 'web', payload = {}, occurredAt } = body;

      if (!householdId || typeof householdId !== 'string') {
        return NextResponse.json({ error: 'householdId is required' }, { status: 400 });
      }

      if (!type || typeof type !== 'string') {
        return NextResponse.json({ error: 'type is required' }, { status: 400 });
      }

      const supabase = sb();

      const { data: membership, error: membershipError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('household_id', householdId)
        .eq('user_id', userId)
        .maybeSingle();

      if (membershipError || !membership) {
        const { data: userRecord, error: userError } = await supabase
          .from('users')
          .select('household_id')
          .eq('id', userId)
          .maybeSingle();

        if (userError || !userRecord || userRecord.household_id !== householdId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      const { data, error } = await supabase
        .from('household_events')
        .insert({
          household_id: householdId,
          type,
          source,
          payload,
          occurred_at: occurredAt ?? new Date().toISOString(),
          created_by: userId,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Failed to insert household event:', error);
        return NextResponse.json({ error: 'Failed to log event', details: error }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: { event: data } }, { status: 200 });
    } catch (error) {
      console.error('Error in events/log route:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  }, {
    allowedMethods: ['POST'],
    requireAuth: true,
    requireCSRF: true,
  });
}

