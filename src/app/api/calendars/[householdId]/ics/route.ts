import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { generateEventOccurrences } from '@/lib/calendar/rruleUtils';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database.types';

/**
 * Generate ICS (iCalendar) feed for a household
 * This allows users to subscribe to the calendar in any calendar app
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params for Next.js 15 compatibility
    const { householdId } = await params;

    const supabase = getDatabaseClient();
    
    // Verify user has access to this household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userData.household_id !== householdId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get query parameters for date range
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    
    // Default to next 90 days if no range specified
    const startDate = start ? new Date(start) : new Date();
    const endDate = end ? new Date(end) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    // Get all events for the household
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        *,
        calendar:calendars(name, color),
        attendees:event_attendees(
          id,
          user_id,
          email,
          status
        )
      `)
      .eq('household_id', householdId)
      .gte('start_at', startDate.toISOString())
      .lte('start_at', endDate.toISOString())
      .order('start_at', { ascending: true });

    if (error) {
      logger.error('Error fetching events for ICS', error, { householdId, userId });
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Generate ICS content
    const icsContent = generateICS(events ?? [], householdId);

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="household-${householdId}.ics"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    logger.error('Error generating ICS feed', error instanceof Error ? error : new Error(String(error)), { householdId: (await params).householdId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Generate ICS content from events
 */
type EventRecord = Database['public']['Tables']['events']['Row'] & {
  calendar?: { name?: string | null; color?: string | null } | null;
  attendees?: Array<Database['public']['Tables']['event_attendees']['Row']> | null;
};

type Occurrence = {
  id?: string;
  originalEventId?: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  timezone?: string | null;
  isAllDay?: boolean | null;
  attendees?: Array<Database['public']['Tables']['event_attendees']['Row']> | null;
  calendar?: { name?: string | null; color?: string | null } | null;
  updated_at?: string | null;
  created_at: string;
};

function generateICS(events: EventRecord[], householdId: string): string {
  const calendarName = `Household Calendar ${householdId.slice(0, 8)}`;
  
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Home Management App//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    `X-WR-CALDESC:Household events and activities`,
    `X-WR-TIMEZONE:Australia/Melbourne`,
  ];

  // Process each event
  for (const event of events) {
    if (event.rrule) {
      // Generate occurrences for recurring events
      const occurrences = generateEventOccurrences(
        {
          id: event.id,
          title: event.title,
          description: event.description,
          startAt: new Date(event.start_at),
          endAt: new Date(event.end_at),
          timezone: event.timezone,
          isAllDay: event.is_all_day,
          rrule: event.rrule,
          exdates: event.exdates?.map((d: string) => new Date(d)) || [],
          rdates: event.rdates?.map((d: string) => new Date(d)) || [],
          location: event.location
        },
        new Date(event.start_at),
        new Date(event.end_at)
      );

      // Add each occurrence as a separate VEVENT
      for (const occurrence of occurrences) {
        ics.push(...generateVEVENT(occurrence, event));
      }
    } else {
      // Single occurrence event
      ics.push(...generateVEVENT({
        id: event.id,
        title: event.title,
        description: event.description,
        startAt: new Date(event.start_at),
        endAt: new Date(event.end_at),
        timezone: event.timezone,
        isAllDay: event.is_all_day,
        attendees: event.attendees ?? [],
        calendar: event.calendar ?? null,
        updated_at: event.updated_at,
        created_at: event.created_at,
      }, event));
    }
  }

  ics.push('END:VCALENDAR');
  
  return ics.join('\r\n');
}

/**
 * Generate VEVENT block for an event
 */
function generateVEVENT(event: Occurrence, originalEvent: EventRecord): string[] {
  const vevent = ['BEGIN:VEVENT'];
  
  // UID (unique identifier)
  vevent.push(`UID:${event.id || event.originalEventId}@home-management-app.com`);
  
  // Timestamps
  vevent.push(`DTSTAMP:${formatICSDate(new Date())}`);
  
  // Start and end times
  const startDate = new Date(event.startAt);
  const endDate = new Date(event.endAt);
  
  if (event.isAllDay) {
    vevent.push(`DTSTART;VALUE=DATE:${formatICSDate(startDate, true)}`);
    vevent.push(`DTEND;VALUE=DATE:${formatICSDate(endDate, true)}`);
  } else {
    vevent.push(`DTSTART:${formatICSDate(startDate)}`);
    vevent.push(`DTEND:${formatICSDate(endDate)}`);
  }
  
  // Summary (title)
  vevent.push(`SUMMARY:${escapeICS(event.title)}`);
  
  // Description
  if (event.description) {
    vevent.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }
  
  // Location
  if (originalEvent.location) {
    vevent.push(`LOCATION:${escapeICS(originalEvent.location)}`);
  }
  
  // Status
  vevent.push('STATUS:CONFIRMED');
  
  // Transparency
  vevent.push('TRANSP:OPAQUE');
  
  // RRULE (if this is a recurring event)
  if (originalEvent.rrule) {
    vevent.push(`RRULE:${originalEvent.rrule}`);
  }
  
  // Attendees
  if (event.attendees && event.attendees.length > 0) {
    for (const attendee of event.attendees) {
      const email = attendee.email || `${attendee.user_id}@home-management-app.com`;
      const name = attendee.email || `User ${attendee.user_id}`;
      const status = attendee.status === 'accepted' ? 'ACCEPTED' :
        attendee.status === 'declined' ? 'DECLINED' :
          attendee.status === 'tentative' ? 'TENTATIVE' : 'NEEDS-ACTION';

      vevent.push(`ATTENDEE;CN="${escapeICS(name)}";PARTSTAT=${status};RSVP=TRUE:mailto:${email}`);
    }
  }
  
  // Categories
  if (originalEvent.calendar?.name) {
    vevent.push(`CATEGORIES:${escapeICS(originalEvent.calendar.name)}`);
  }
  
  // URL (link back to the app)
  vevent.push(`URL:${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar`);
  
  // Last modified
  vevent.push(`LAST-MODIFIED:${formatICSDate(new Date(event.updated_at || event.created_at))}`);
  
  // Created
  vevent.push(`CREATED:${formatICSDate(new Date(event.created_at))}`);
  
  vevent.push('END:VEVENT');
  
  return vevent;
}

/**
 * Format date for ICS (UTC format)
 */
function formatICSDate(date: Date, dateOnly = false): string {
  if (dateOnly) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/**
 * Escape special characters for ICS
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}
