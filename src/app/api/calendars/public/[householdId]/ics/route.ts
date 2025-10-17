import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { generateEventOccurrences } from '@/lib/calendar/rruleUtils';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/supabase.generated';

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

    const supabase: SupabaseClient<Database> = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    
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
        calendar:calendars(name, color),
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

    const mappedHousehold: HouseholdInfo = {
      id: household.id,
      name: household.name,
    };

    const mappedEvents: PublicEvent[] = (events ?? []).map((event) => ({
      ...event,
      calendar: event.calendar
        ? {
            name: event.calendar.name ?? null,
            color: event.calendar.color ?? null,
          }
        : null,
      attendees: (event.attendees ?? []).map(({ id, user_id, email, status }) => ({ id, user_id, email, status })),
    }));

    const occurrences = buildOccurrences(mappedEvents);
  const icsContent = generateICSFromOccurrences(occurrences as Array<PublicOccurrence & { originalEvent: PublicEvent }>, mappedHousehold);

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
type EventRow = Database['public']['Tables']['events']['Row'];
type CalendarRow = Database['public']['Tables']['calendars']['Row'];
type EventAttendeeRow = Database['public']['Tables']['event_attendees']['Row'];
type PublicEvent = EventRow & {
  calendar?: Pick<CalendarRow, 'name' | 'color'> | null;
  attendees?: Array<Pick<EventAttendeeRow, 'id' | 'user_id' | 'email' | 'status'>> | null;
};

type Household = Database['public']['Tables']['households']['Row'];
type HouseholdInfo = Pick<Household, 'id' | 'name'>;

type PublicOccurrence = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  timezone: string | null;
  isAllDay: boolean;
  location: string | null;
  attendees: Array<Pick<EventAttendeeRow, 'email' | 'status' | 'user_id'>>;
  calendar: Pick<CalendarRow, 'name' | 'color'> | null;
  updated_at: string;
  created_at: string;
};

function ensureTimestamp(value: string | null | undefined): string {
  return value ?? new Date().toISOString();
}

function buildOccurrences(events: PublicEvent[]): Array<PublicOccurrence & { originalEvent: PublicEvent }> {
  return events.flatMap((event) => {
    const startAt = new Date(event.start_at);
    const endAt = new Date(event.end_at);
    const attendees = event.attendees?.map(({ email, status, user_id }) => ({ email, status, user_id })) ?? [];
    const calendar = event.calendar ?? null;
    const updatedAt = ensureTimestamp(event.updated_at);
    const createdAt = ensureTimestamp(event.created_at);

    const base: PublicOccurrence & { originalEvent: PublicEvent } = {
      id: event.id,
      title: event.title,
      description: event.description ?? null,
      startAt,
      endAt,
      timezone: event.timezone ?? null,
      isAllDay: event.is_all_day ?? false,
      location: event.location ?? null,
      attendees,
      calendar,
      updated_at: updatedAt,
      created_at: createdAt,
      originalEvent: event,
    };

    if (!event.rrule) {
      return [base];
    }

    const recurrenceOccurrences = generateEventOccurrences(
      {
        id: event.id,
        title: event.title,
        description: event.description ?? '',
        startAt,
        endAt,
        timezone: event.timezone ?? 'UTC',
        isAllDay: event.is_all_day ?? false,
        rrule: event.rrule ?? undefined,
        exdates: (event.exdates ?? []).map((date) => new Date(date)),
        rdates: (event.rdates ?? []).map((date) => new Date(date)),
        location: event.location ?? '',
      },
      startAt,
      endAt,
    );

    return recurrenceOccurrences.map((occurrence, index) => ({
      id: `${event.id}-${index}`,
      title: occurrence.title,
      description: occurrence.description ?? null,
      startAt: occurrence.startAt,
      endAt: occurrence.endAt,
      timezone: occurrence.timezone ?? null,
      isAllDay: occurrence.isAllDay ?? false,
      location: occurrence.location ?? null,
      attendees,
      calendar,
      updated_at: updatedAt,
      created_at: createdAt,
      originalEvent: event,
    }));
  });
}

function generateICSFromOccurrences(
  occurrences: Array<PublicOccurrence & { originalEvent: PublicEvent }>,
  household: HouseholdInfo,
): string {
  const calendarName = `${household.name ?? 'Household'} Calendar`;
  const ics: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Home Management App//Public Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    `X-WR-CALDESC:Public events for ${household.name}`,
    'X-WR-TIMEZONE:Australia/Melbourne',
    `X-WR-CALID:${household.id}`,
  ];

  for (const occurrence of occurrences) {
    const { originalEvent, ...event } = occurrence;
    ics.push(...generateVEVENT(event, originalEvent, event.calendar));
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

function generateVEVENT(
  event: PublicOccurrence,
  originalEvent: PublicEvent,
  calendar: Pick<CalendarRow, 'name' | 'color'> | null,
): string[] {
  const vevent: string[] = ['BEGIN:VEVENT'];

  vevent.push(`UID:${event.id ?? `${originalEvent.id}-${event.startAt.getTime()}`}@home-management-app.com`);
  vevent.push(`DTSTAMP:${formatICSDate(new Date())}`);

  const startDate = new Date(event.startAt);
  const endDate = new Date(event.endAt);

  if (event.isAllDay) {
    vevent.push(`DTSTART;VALUE=DATE:${formatICSDate(startDate, true)}`);
    vevent.push(`DTEND;VALUE=DATE:${formatICSDate(endDate, true)}`);
  } else {
    vevent.push(`DTSTART:${formatICSDate(startDate)}`);
    vevent.push(`DTEND:${formatICSDate(endDate)}`);
  }

  vevent.push(`SUMMARY:${escapeICS(event.title)}`);

  if (event.description) {
    vevent.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }

  const location = event.location ?? originalEvent.location ?? null;
  if (location) {
    vevent.push(`LOCATION:${escapeICS(location)}`);
  }

  vevent.push('STATUS:CONFIRMED');
  vevent.push('TRANSP:OPAQUE');

  if (originalEvent.rrule) {
    vevent.push(`RRULE:${originalEvent.rrule}`);
  }

  if (event.attendees && event.attendees.length > 0) {
    event.attendees.forEach(({ email, status, user_id }) => {
      const attendeeEmail = email ?? `${user_id ?? 'guest'}@home-management-app.com`;
      const name = email?.split('@')[0] ?? user_id ?? 'Guest';
      const partstat = status === 'accepted' ? 'ACCEPTED' : status === 'declined' ? 'DECLINED' : status === 'tentative' ? 'TENTATIVE' : 'NEEDS-ACTION';
      vevent.push(`ATTENDEE;CN="${escapeICS(name)}";PARTSTAT=${partstat};RSVP=TRUE:mailto:${attendeeEmail}`);
    });
  }

  if (calendar?.name) {
    vevent.push(`CATEGORIES:${escapeICS(calendar.name)}`);
  }

  vevent.push(`URL:${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar`);
  vevent.push(`LAST-MODIFIED:${formatICSDate(new Date(event.updated_at))}`);
  vevent.push(`CREATED:${formatICSDate(new Date(event.created_at))}`);
  vevent.push('END:VEVENT');

  return vevent;
}

function formatICSDate(date: Date, dateOnly = false): string {
  const iso = date.toISOString();
  if (dateOnly) {
    const datePart = iso.split('T')[0] ?? '';
    return datePart.replace(/-/g, '');
  }
  const timePart = iso.replace(/[-:]/g, '').split('.')[0] ?? '';
  return `${timePart}Z`;
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}
