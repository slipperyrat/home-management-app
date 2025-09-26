import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { canAccessFeatureFromEntitlements } from '@/lib/server/canAccessFeature';
import { QuietHoursService } from '@/lib/quietHoursService';
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
 * Get current quiet hours status for a household
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

    if (!canAccessFeatureFromEntitlements(entitlements, 'quiet_hours')) {
      return NextResponse.json({ 
        error: 'Quiet hours requires Pro plan',
        code: 'UPGRADE_REQUIRED'
      }, { status: 403 });
    }

    // Get quiet hours status
    const status = await QuietHoursService.getQuietHoursStatus(household_id);

    return NextResponse.json({
      success: true,
      data: {
        is_quiet_hours: status.isQuietHours,
        settings: status.settings,
        next_change: status.nextChange?.toISOString() || null,
        formatted: {
          next_change: status.nextChange ? 
            QuietHoursService.formatTime(status.nextChange.toTimeString().slice(0, 5)) : null,
          days_of_week: status.settings ? 
            QuietHoursService.formatDaysOfWeek(status.settings.days_of_week) : null,
          time_range: status.settings ? 
            `${QuietHoursService.formatTime(status.settings.start_time)} - ${QuietHoursService.formatTime(status.settings.end_time)}` : null
        }
      }
    });

  } catch (error) {
    console.error('Error getting quiet hours status:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
