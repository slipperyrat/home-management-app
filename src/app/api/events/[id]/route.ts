import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDatabaseClient } from '@/lib/api/database';
import { z } from 'zod';

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  timezone: z.string().optional(),
  isAllDay: z.boolean().optional(),
  rrule: z.string().optional(),
  exdates: z.array(z.string().datetime()).optional(),
  rdates: z.array(z.string().datetime()).optional(),
  location: z.string().optional(),
  calendarId: z.string().uuid().optional(),
  attendees: z.array(z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
    status: z.enum(['accepted', 'declined', 'tentative', 'needsAction']).optional(),
    isOptional: z.boolean().optional()
  })).optional(),
  reminders: z.array(z.object({
    minutesBefore: z.number().min(0),
    method: z.enum(['push', 'email', 'sms'])
  })).optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params for Next.js 15 compatibility
    const { id } = await params;

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

    // Get event with all related data
    const { data: event, error } = await supabase
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
      .eq('id', id)
      .eq('household_id', userData.household_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 });
      }
      console.error('Error fetching event:', error);
      return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 });
    }

    return NextResponse.json({ event });

  } catch (error) {
    console.error('Error in GET /api/events/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params for Next.js 15 compatibility
    const { id } = await params;

    const body = await request.json();
    const validatedData = updateEventSchema.parse(body);

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

    // Check if event exists and user has permission
    const { data: existingEvent, error: checkError } = await supabase
      .from('events')
      .select('id, created_by')
      .eq('id', id)
      .eq('household_id', userData.household_id)
      .single();

    if (checkError || !existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if user can modify (creator or household owner)
    const { data: userRole } = await supabase
      .from('household_members')
      .select('role')
      .eq('household_id', userData.household_id)
      .eq('user_id', userId)
      .single();

    const canModify = existingEvent.created_by === userId || userRole?.role === 'owner';
    
    if (!canModify) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.startAt !== undefined) updateData.start_at = validatedData.startAt;
    if (validatedData.endAt !== undefined) updateData.end_at = validatedData.endAt;
    if (validatedData.timezone !== undefined) updateData.timezone = validatedData.timezone;
    if (validatedData.isAllDay !== undefined) updateData.is_all_day = validatedData.isAllDay;
    if (validatedData.rrule !== undefined) updateData.rrule = validatedData.rrule;
    if (validatedData.exdates !== undefined) updateData.exdates = validatedData.exdates;
    if (validatedData.rdates !== undefined) updateData.rdates = validatedData.rdates;
    if (validatedData.location !== undefined) updateData.location = validatedData.location;
    if (validatedData.calendarId !== undefined) updateData.calendar_id = validatedData.calendarId;

    // Update event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (eventError) {
      console.error('Error updating event:', eventError);
      return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
    }

    // Update attendees if provided
    if (validatedData.attendees !== undefined) {
      // Delete existing attendees
      await supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', id);

      // Insert new attendees
      if (validatedData.attendees.length > 0) {
        const attendeeData = validatedData.attendees.map(attendee => ({
          event_id: id,
          user_id: attendee.userId || null,
          email: attendee.email || null,
          status: attendee.status || 'needsAction',
          is_optional: attendee.isOptional || false
        }));

        const { error: attendeesError } = await supabase
          .from('event_attendees')
          .insert(attendeeData);

        if (attendeesError) {
          console.error('Error updating attendees:', attendeesError);
          // Don't fail the entire request for attendee errors
        }
      }
    }

    // Update reminders if provided
    if (validatedData.reminders !== undefined) {
      // Delete existing reminders
      await supabase
        .from('event_reminders')
        .delete()
        .eq('event_id', id);

      // Insert new reminders
      if (validatedData.reminders.length > 0) {
        const reminderData = validatedData.reminders.map(reminder => ({
          event_id: id,
          minutes_before: reminder.minutesBefore,
          method: reminder.method
        }));

        const { error: remindersError } = await supabase
          .from('event_reminders')
          .insert(reminderData);

        if (remindersError) {
          console.error('Error updating reminders:', remindersError);
          // Don't fail the entire request for reminder errors
        }
      }
    }

    return NextResponse.json({ 
      event,
      message: 'Event updated successfully' 
    });

  } catch (error) {
    console.error('Error in PATCH /api/events/[id]:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid event data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params for Next.js 15 compatibility
    const { id } = await params;

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

    // Check if event exists and user has permission
    const { data: existingEvent, error: checkError } = await supabase
      .from('events')
      .select('id, created_by')
      .eq('id', id)
      .eq('household_id', userData.household_id)
      .single();

    if (checkError || !existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if user can delete (creator or household owner)
    const { data: userRole } = await supabase
      .from('household_members')
      .select('role')
      .eq('household_id', userData.household_id)
      .eq('user_id', userId)
      .single();

    const canDelete = existingEvent.created_by === userId || userRole?.role === 'owner';
    
    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Delete event (cascade will handle attendees and reminders)
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting event:', deleteError);
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Event deleted successfully' 
    });

  } catch (error) {
    console.error('Error in DELETE /api/events/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
