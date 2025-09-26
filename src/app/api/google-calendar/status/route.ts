import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { canAccessFeatureFromEntitlements } from '@/lib/server/canAccessFeature';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const StatusRequestSchema = z.object({
  household_id: z.string().uuid(),
});

/**
 * Get Google Calendar import status and settings
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const { household_id } = StatusRequestSchema.parse({
      household_id: searchParams.get('household_id'),
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
    const { data: entitlements, error: entitlementsError } = await supabase
      .from('entitlements')
      .select('*')
      .eq('household_id', household_id)
      .single();

    if (entitlementsError || !entitlements) {
      return NextResponse.json({ error: 'Entitlements not found' }, { status: 404 });
    }

    if (!canAccessFeatureFromEntitlements(entitlements, 'google_import')) {
      return NextResponse.json({ 
        error: 'Google Calendar import requires Pro plan',
        code: 'UPGRADE_REQUIRED'
      }, { status: 403 });
    }

    // Get Google Calendar import settings
    const { data: importSettings, error: importError } = await supabase
      .from('google_calendar_imports')
      .select('*')
      .eq('household_id', household_id)
      .single();

    if (importError || !importSettings) {
      return NextResponse.json({
        success: true,
        connected: false,
        message: 'Google Calendar not connected'
      });
    }

    // Check if token is expired
    const isTokenExpired = importSettings.token_expires_at && 
      new Date(importSettings.token_expires_at) < new Date();

    // Get recent import stats
    const { data: recentEvents } = await supabase
      .from('events')
      .select('id, created_at')
      .eq('household_id', household_id)
      .eq('external_source', 'google_calendar')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      connected: true,
      status: importSettings.import_status,
      is_token_expired: isTokenExpired,
      last_import_at: importSettings.last_import_at,
      last_successful_import_at: importSettings.last_successful_import_at,
      calendars: importSettings.calendars || [],
      recent_imports: {
        last_7_days: recentEvents?.length || 0,
        last_import: recentEvents?.[0]?.created_at || null
      },
      needs_reauth: isTokenExpired
    });

  } catch (error) {
    console.error('Error getting Google Calendar status:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
