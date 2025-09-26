import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleCalendarService } from '@/lib/googleCalendar';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Cron job for automatic Google Calendar imports
 * This should be called by a cron service every hour
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting Google Calendar cron import...');

    // Get all active Google Calendar imports
    const { data: importSettings, error: importError } = await supabase
      .from('google_calendar_imports')
      .select('*')
      .eq('import_status', 'active');

    if (importError) {
      console.error('Error fetching import settings:', importError);
      return NextResponse.json({ error: 'Failed to fetch import settings' }, { status: 500 });
    }

    if (!importSettings || importSettings.length === 0) {
      console.log('ℹ️ No active Google Calendar imports found');
      return NextResponse.json({ 
        success: true, 
        message: 'No active imports to process',
        processed: 0 
      });
    }

    let totalProcessed = 0;
    let totalImported = 0;
    const errors: string[] = [];

    // Process each household's Google Calendar import
    for (const importSetting of importSettings) {
      try {
        console.log(`📅 Processing import for household ${importSetting.household_id}`);

        // Check if token is expired
        if (importSetting.token_expires_at && new Date(importSetting.token_expires_at) < new Date()) {
          console.log(`⚠️ Token expired for household ${importSetting.household_id}, skipping`);
          continue;
        }

        if (!importSetting.access_token) {
          console.log(`⚠️ No access token for household ${importSetting.household_id}, skipping`);
          continue;
        }

        // Initialize Google Calendar service
        const googleCalendar = new GoogleCalendarService(importSetting.access_token);

        // Get selected calendars
        const calendars = importSetting.calendars || [];
        const selectedCalendars = calendars
          .filter((cal: any) => cal.selected !== false)
          .map((cal: any) => cal.id);

        if (selectedCalendars.length === 0) {
          console.log(`ℹ️ No calendars selected for household ${importSetting.household_id}`);
          continue;
        }

        // Set time range for import (last 24 hours to catch any missed events)
        const timeMin = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Next 7 days

        // Import events from selected calendars
        const importResults = await googleCalendar.getEventsFromCalendars(selectedCalendars, {
          timeMin,
          timeMax,
          maxResults: 50 // Limit for cron job
        });

        let householdImported = 0;
        let householdSkipped = 0;

        // Process each calendar's events
        for (const { calendarId, events } of importResults) {
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
                .eq('household_id', importSetting.household_id)
                .single();

              if (existingEvent) {
                householdSkipped++;
                continue;
              }

              // Insert new event
              const { error: insertError } = await supabase
                .from('events')
                .insert({
                  household_id: importSetting.household_id,
                  ...internalEvent,
                  created_by: 'system', // System import
                  source: 'google_import_cron'
                });

              if (insertError) {
                console.error(`Error inserting event for household ${importSetting.household_id}:`, insertError);
                continue;
              }

              householdImported++;

            } catch (error) {
              console.error(`Error processing event for household ${importSetting.household_id}:`, error);
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
          .eq('household_id', importSetting.household_id);

        // Log the import for audit
        await supabase
          .from('audit_log')
          .insert({
            actor_id: 'system',
            household_id: importSetting.household_id,
            action: 'google_calendar.cron_import',
            target_table: 'events',
            meta: {
              imported_events: householdImported,
              skipped_events: householdSkipped,
              calendars_processed: selectedCalendars.length,
              time_range: { timeMin, timeMax }
            }
          });

        totalProcessed++;
        totalImported += householdImported;

        console.log(`✅ Household ${importSetting.household_id}: ${householdImported} imported, ${householdSkipped} skipped`);

      } catch (error) {
        console.error(`Error processing household ${importSetting.household_id}:`, error);
        errors.push(`Household ${importSetting.household_id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`🎉 Cron import completed: ${totalProcessed} households processed, ${totalImported} events imported`);

    return NextResponse.json({
      success: true,
      message: 'Cron import completed',
      stats: {
        households_processed: totalProcessed,
        events_imported: totalImported,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error in Google Calendar cron job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
