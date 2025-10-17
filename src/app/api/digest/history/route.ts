import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { canAccessFeatureFromEntitlements } from '@/lib/server/canAccessFeature';
import { z } from 'zod';
import type { Database } from '@/types/supabase.generated';
import { toEntitlements } from '@/lib/entitlements';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseKey);

type EntitlementRow = Database['public']['Tables']['entitlements']['Row'];

function mapEntitlement(row: EntitlementRow) {
  return toEntitlements(row);
}

const HistoryRequestSchema = z.object({
  household_id: z.string().uuid(),
  days: z.number().min(1).max(30).optional(),
});

/**
 * Get digest history and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { household_id, days = 7 } = HistoryRequestSchema.parse({
      household_id: searchParams.get('household_id'),
      days: searchParams.get('days') ? parseInt(searchParams.get('days')!) : 7,
    });

    // Verify user has access to this household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id, role')
      .eq('household_id', household_id)
      .eq('user_id', userId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Household not found or access denied' }, { status: 404 });
    }

    // Check entitlements
    const { data: entitlementsRow, error: entitlementsError } = await supabase
      .from('entitlements')
      .select('*')
      .eq('household_id', household_id)
      .single();

    if (entitlementsError || !entitlementsRow) {
      return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
    }

    const entitlements = mapEntitlement(entitlementsRow);

    if (!canAccessFeatureFromEntitlements(entitlements, 'digest_max_per_day')) {
      return NextResponse.json({ 
        error: 'Daily digest requires Pro plan',
        code: 'UPGRADE_REQUIRED'
      }, { status: 403 });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Get digest history
    const { data: digests, error: digestsError } = await supabase
      .from('daily_digests')
      .select(`
        id,
        digest_date,
        sent_at,
        status,
        error_message,
        created_at
      `)
      .eq('household_id', household_id)
      .gte('digest_date', startDate.toISOString().split('T')[0])
      .lte('digest_date', endDate.toISOString().split('T')[0])
      .order('digest_date', { ascending: false });

    if (digestsError) {
      console.error('Error fetching digest history:', digestsError);
      return NextResponse.json({ error: 'Failed to fetch digest history' }, { status: 500 });
    }

    // Calculate statistics
    const today = new Date().toISOString().split('T')[0];
    const todayDigests = (digests ?? []).filter((d) => d.digest_date === today);
    const successfulDigests = (digests ?? []).filter((d) => d.status === 'sent');
    const failedDigests = (digests ?? []).filter((d) => d.status === 'failed');

    // Get last sent date
    const lastSent = successfulDigests[0]?.digest_date ?? null;

    // Get next scheduled time (simplified for now since digest_preferences table doesn't exist)
    let nextScheduled = null;
    // For now, assume daily digests are scheduled for 8 AM
    const now = new Date();
    const nextTime = new Date();
    nextTime.setHours(8, 0, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (nextTime <= now) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
    
    nextScheduled = nextTime.toISOString();

    return NextResponse.json({
      success: true,
      data: {
        last_sent: lastSent,
        next_scheduled: nextScheduled,
        quota_used: todayDigests.length,
        quota_limit: entitlements.digest_max_per_day || 1,
        total_sent: successfulDigests.length,
        total_failed: failedDigests.length,
        success_rate: digests && digests.length > 0
          ? Math.round((successfulDigests.length / digests.length) * 100)
          : 0,
        recent_digests: (digests ?? []).slice(0, 10).map((digest) => ({
          id: digest.id,
          date: digest.digest_date,
          sent: digest.status === 'sent',
          message_id: null, // Not stored in current schema
          user: 'User', // Fallback since we removed the join
          created_at: digest.created_at
        })) || []
      }
    });

  } catch (error) {
    console.error('Error getting digest history:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
