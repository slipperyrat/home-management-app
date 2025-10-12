import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseClient } from '@/lib/api/database';
import { generateEventOccurrences } from '@/lib/calendar/rruleUtils';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database.types';

/**
 * Public ICS (iCalendar) feed for a household
 * This allows anyone with the URL to subscribe to the calendar
 * No authentication required - uses a secret token for security
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ householdId: string }> }
) {
  try {
    // Await params for Next.js 15 compatibility
    const { householdId } = await params;
    
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const format = searchParams.get('format') || 'ics'; // ics or json

    // Verify the token (you can generate these per household)
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 401 });
    }

    const supabase = getDatabaseClient();
    
    // Verify household exists and token is valid
    const { data: household, error: householdError } = await supabase
      .from('households')
      .select('id, name, ics_token')
      .eq('id', householdId)
      .eq('ics_token', token)
      .single();

    if (householdError || !household) {
      return NextResponse.json({ error: 'Invalid token or household' }, { status: 403 });
    }

    // Default to next 90 days if no range specified
    const startDate = start ? new Date(start) : new Date();
    const endDate = end ? new Date(end) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    // Get all public events for the household
    const { data: events, error } = await supabase
      .from('events')
      .select(`
        *,
        calendar:calendars(name, color, is_public),
        attendees:event_attendees(
          id,
          user_id,
          email,
          status
        )
      `)
      .eq('household_id', householdId)
      .eq('is_public', true) // Only public events
      .gte('start_at', startDate.toISOString())
      .lte('start_at', endDate.toISOString())
      .order('start_at', { ascending: true });

    if (error) {
      logger.error('Error fetching public events for ICS', error, { householdId });
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Return JSON format if requested
    if (format === 'json') {
      return NextResponse.json({
        calendar: {
          id: household.id,
          name: household.name,
          description: `Public calendar for ${household.name}`,
          timezone: 'Australia/Melbourne',
          events: events || []
        }
      });
    }

    // Generate ICS content
    const icsContent = generateICS(events ?? [], household);

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${household.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
        'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
        'Access-Control-Allow-Origin': '*', // Allow CORS for public access
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    logger.error('Error generating public ICS feed', error instanceof Error ? error : new Error(String(error)), { householdId: (await params).householdId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Generate ICS content from events
 */
type PublicEvent = Database['public']['Tables']['events']['Row'] & {
  calendar?: { name?: string | null; color?: string | null; is_public?: boolean | null } | null;
  attendees?: Array<Database['public']['Tables']['event_attendees']['Row']> | null;
};

type Household = Database['public']['Tables']['households']['Row'];

function generateICS(events: PublicEvent[], household: Household): string {
  const calendarName = `${household.name ?? 'Household'} Calendar`;
  
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Home Management App//Public Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    `X-WR-CALDESC:Public events for ${household.name}`,
    `X-WR-TIMEZONE:Australia/Melbourne`,
    `X-WR-CALID:${household.id}`,
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
      ics.push(
        ...occurrences.flatMap((occurrence) =>
          generateVEVENT(
            {
              id: event.id,
              title: event.title,
              description: event.description,
              startAt: occurrence.startAt,
              endAt: occurrence.endAt,
              timezone: occurrence.timezone ?? event.timezone,
              isAllDay: occurrence.isAllDay ?? event.is_all_day,
              attendees: event.attendees ?? [],
              calendar: event.calendar ?? null,
              updated_at: occurrence.updated_at ?? event.updated_at,
              created_at: occurrence.created_at ?? event.created_at,
            },
            event,
          ),
        ),
      );
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
type PublicOccurrence = {
  id?: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  timezone?: string | null;
  isAllDay?: boolean | null;
  attendees?: Array<Database['public']['Tables']['event_attendees']['Row']>;
  calendar?: { name?: string | null; color?: string | null; is_public?: boolean | null } | null;
  updated_at?: string | null;
  created_at: string;
};

function generateVEVENT(event: PublicOccurrence, originalEvent: PublicEvent): string[] {
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
  if (event.location) {
    vevent.push(`LOCATION:${escapeICS(event.location)}`);
  }
  
  // Status
  vevent.push('STATUS:CONFIRMED');
  
  // Transparency
  vevent.push('TRANSP:OPAQUE');
  
  // RRULE (if this is a recurring event)
  if (originalEvent.rrule) {
    vevent.push(`RRULE:${originalEvent.rrule}`);
  }
  
  // Attendees (only include public attendees)
  if (event.attendees && event.attendees.length > 0) {
    for (const { email, status } of event.attendees) {
      if (!email || status === 'private') {
        continue;
      }

      const name = email.split('@')[0];
      const partstat = status === 'accepted' ? 'ACCEPTED' :
        status === 'declined' ? 'DECLINED' :
          status === 'tentative' ? 'TENTATIVE' : 'NEEDS-ACTION';

      vevent.push(`ATTENDEE;CN="${escapeICS(name)}";PARTSTAT=${partstat};RSVP=TRUE:mailto:${email}`);
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
