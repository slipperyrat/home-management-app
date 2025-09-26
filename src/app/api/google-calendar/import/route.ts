import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleCalendarService } from '@/lib/googleCalendar';
import { canAccessFeatureFromEntitlements } from '@/lib/server/canAccessFeature';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ImportRequestSchema = z.object({
  household_id: z.string().uuid(),
  calendar_ids: z.array(z.string()).optional(),
  time_min: z.string().optional(),
  time_max: z.string().optional(),
  max_results: z.number().min(1).max(1000).optional(),
});

/**
 * Import events from Google Calendar
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { household_id, calendar_ids, time_min, time_max, max_results = 100 } = ImportRequestSchema.parse(body);

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
      .eq('import_status', 'active')
      .single();

    if (importError || !importSettings) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 404 });
    }

    if (!importSettings.access_token) {
      return NextResponse.json({ error: 'No valid access token' }, { status: 400 });
    }

    // Check if token is expired
    if (importSettings.token_expires_at && new Date(importSettings.token_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Access token expired, please re-authenticate' }, { status: 401 });
    }

    // Initialize Google Calendar service
    const googleCalendar = new GoogleCalendarService(importSettings.access_token);

    // Determine which calendars to import from
    let calendarsToImport = calendar_ids;
    if (!calendarsToImport || calendarsToImport.length === 0) {
      // Import from all selected calendars
      const allCalendars = await googleCalendar.getCalendarList();
      calendarsToImport = allCalendars
        .filter(cal => cal.selected !== false) // Include calendars that are selected or undefined
        .map(cal => cal.id);
    }

    if (calendarsToImport.length === 0) {
      return NextResponse.json({ error: 'No calendars selected for import' }, { status: 400 });
    }

    // Set time range for import
    const timeMin = time_min || new Date().toISOString();
    const timeMax = time_max || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Next 30 days

    // Import events from selected calendars
    const importResults = await googleCalendar.getEventsFromCalendars(calendarsToImport, {
      timeMin,
      timeMax,
      maxResults: max_results
    });

    let totalEvents = 0;
    let importedEvents = 0;
    let skippedEvents = 0;
    const errors: string[] = [];

    // Process each calendar's events
    for (const { calendarId, events } of importResults) {
      totalEvents += events.length;

      for (const googleEvent of events) {
        try {
          // Convert Google event to internal format
          const internalEvent = GoogleCalendarService.convertToInternalEvent(googleEvent, calendarId);

          // Check if event already exists (by external_id)
          const { data: existingEvent } = await supabase
            .from('events')
            .select('id')
            .eq('external_id', googleEvent.id)
            .eq('external_source', 'google_calendar')
            .eq('household_id', household_id)
            .single();

          if (existingEvent) {
            skippedEvents++;
            continue;
          }

          // Insert new event
          const { error: insertError } = await supabase
            .from('events')
            .insert({
              household_id,
              ...internalEvent,
              created_by: userId,
              source: 'google_import'
            });

          if (insertError) {
            console.error('Error inserting event:', insertError);
            errors.push(`Failed to import event: ${googleEvent.summary}`);
            continue;
          }

          importedEvents++;

        } catch (error) {
          console.error('Error processing event:', error);
          errors.push(`Failed to process event: ${googleEvent.summary}`);
        }
      }
    }

    // Update import status
    await supabase
      .from('google_calendar_imports')
      .update({
        last_import_at: new Date().toISOString(),
        last_successful_import_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('household_id', household_id);

    // Log the import for audit
    await supabase
      .from('audit_log')
      .insert({
        actor_id: userId,
        household_id,
        action: 'google_calendar.import',
        target_table: 'events',
        meta: {
          total_events: totalEvents,
          imported_events: importedEvents,
          skipped_events: skippedEvents,
          calendars_imported: calendarsToImport,
          time_range: { timeMin, timeMax }
        }
      });

    return NextResponse.json({
      success: true,
      message: 'Import completed',
      stats: {
        total_events: totalEvents,
        imported_events: importedEvents,
        skipped_events: skippedEvents,
        calendars_imported: calendarsToImport.length,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error importing from Google Calendar:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
