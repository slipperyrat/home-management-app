import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { z } from 'zod';
import { generateEventOccurrences } from '@/lib/calendar/rruleUtils';
import { ConflictDetectionService } from '@/lib/conflictDetectionService';
import { canAccessFeatureFromEntitlements } from '@/lib/server/canAccessFeature';

// Validation schemas
const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().default('Australia/Melbourne'),
  isAllDay: z.boolean().default(false),
  rrule: z.string().optional(),
  exdates: z.array(z.string().datetime()).optional().default([]),
  rdates: z.array(z.string().datetime()).optional().default([]),
  location: z.string().optional(),
  calendarId: z.string().uuid().optional(),
  attendees: z.array(z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    status: z.enum(['accepted', 'declined', 'tentative', 'needsAction']).default('needsAction'),
    isOptional: z.boolean().default(false)
  })).optional().default([]),
  reminders: z.array(z.object({
    minutesBefore: z.number().min(0),
    method: z.enum(['push', 'email', 'sms']).default('push')
  })).optional().default([])
});

const updateEventSchema = createEventSchema.partial();

const getEventsSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  calendarId: z.string().uuid().optional()
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const calendarId = searchParams.get('calendarId');

    // Validate query parameters
    const validatedQuery = getEventsSchema.parse({
      start,
      end,
      calendarId: calendarId || undefined
    });

    const supabase = getDatabaseClient();
    
    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('User not found:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('User household_id:', userData.household_id);

    // Build query
    let query = supabase
      .from('events')
      .select(`
        *,
        calendar:calendars(name, color),
        attendees:event_attendees(
          id,
          user_id,
          email,
          status,
          is_optional
        ),
        reminders:event_reminders(
          minutes_before,
          method
        )
      `)
      .eq('household_id', userData.household_id)
      .gte('start_at', validatedQuery.start)
      .lte('start_at', validatedQuery.end)
      .order('start_at', { ascending: true });

    if (validatedQuery.calendarId) {
      query = query.eq('calendar_id', validatedQuery.calendarId);
    }

    console.log('Querying events for household:', userData.household_id);
    const { data: events, error } = await query;
    
    if (error) {
      console.error('Error fetching events:', error);
      return NextResponse.json({ error: 'Failed to fetch events', details: error.message }, { status: 500 });
    }
    
    console.log('Events found:', events?.length || 0);

    // Generate occurrences for recurring events
    const allOccurrences = [];
    const startDate = new Date(validatedQuery.start);
    const endDate = new Date(validatedQuery.end);

    for (const event of events || []) {
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
          startDate,
          endDate
        );

        allOccurrences.push(...occurrences.map(occ => ({
          ...occ,
          calendar: event.calendar,
          attendees: event.attendees,
          reminders: event.reminders,
          isRecurring: true,
          originalEventId: event.id
        })));
      } else {
        // Single occurrence event
        allOccurrences.push({
          ...event,
          isRecurring: false
        });
      }
    }

    // Sort all occurrences by start time
    allOccurrences.sort((a, b) => 
      new Date(a.startAt || a.start_at).getTime() - new Date(b.startAt || b.start_at).getTime()
    );

    return NextResponse.json({ 
      events: allOccurrences,
      count: allOccurrences.length 
    });

  } catch (error) {
    console.error('Error in GET /api/events:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid query parameters', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createEventSchema.parse(body);

    const supabase = getDatabaseClient();
    
    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        household_id: userData.household_id,
        calendar_id: validatedData.calendarId || null,
        title: validatedData.title,
        description: validatedData.description,
        start_at: validatedData.startAt,
        end_at: validatedData.endAt,
        timezone: validatedData.timezone,
        is_all_day: validatedData.isAllDay,
        rrule: validatedData.rrule || null,
        exdates: validatedData.exdates || [],
        rdates: validatedData.rdates || [],
        location: validatedData.location,
        created_by: userId
      })
      .select()
      .single();

    if (eventError) {
      console.error('Error creating event:', eventError);
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    // Add attendees
    if (validatedData.attendees && validatedData.attendees.length > 0) {
      const attendeeData = validatedData.attendees.map(attendee => ({
        event_id: event.id,
        user_id: attendee.userId || null,
        email: attendee.email || null,
        status: attendee.status,
        is_optional: attendee.isOptional
      }));

      const { error: attendeesError } = await supabase
        .from('event_attendees')
        .insert(attendeeData);

      if (attendeesError) {
        console.error('Error adding attendees:', attendeesError);
        // Don't fail the entire request for attendee errors
      }
    }

    // Add reminders
    if (validatedData.reminders && validatedData.reminders.length > 0) {
      const reminderData = validatedData.reminders.map(reminder => ({
        event_id: event.id,
        minutes_before: reminder.minutesBefore,
        method: reminder.method
      }));

      const { error: remindersError } = await supabase
        .from('event_reminders')
        .insert(reminderData);

      if (remindersError) {
        console.error('Error adding reminders:', remindersError);
        // Don't fail the entire request for reminder errors
      }
    }

    // Check for conflicts if Pro plan
    let conflictResult = null;
    try {
      const { data: entitlements, error: entitlementsError } = await supabase
        .from('entitlements')
        .select('*')
        .eq('household_id', userData.household_id)
        .single();

      if (!entitlementsError && entitlements && canAccessFeatureFromEntitlements(entitlements, 'conflict_detection')) {
        conflictResult = await ConflictDetectionService.detectConflictsForEvent(
          event.id,
          userData.household_id,
          {
            id: event.id,
            title: event.title,
            start_at: event.start_at,
            end_at: event.end_at,
            is_all_day: event.is_all_day,
            household_id: userData.household_id
          }
        );
      }
    } catch (conflictError) {
      console.error('Error detecting conflicts:', conflictError);
      // Don't fail the entire request for conflict detection errors
    }

    return NextResponse.json({ 
      event,
      message: 'Event created successfully',
      conflicts: conflictResult
    }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/events:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid event data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
