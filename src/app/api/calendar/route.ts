import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const householdId = userData.household_id;

    // Fetch calendar events for the household
    const { data: events, error: eventsError } = await supabase
      .from('household_events')
      .select('*')
      .eq('household_id', householdId)
      .order('start_time', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Enhance events with AI confidence scores and suggestions
    const enhancedEvents = (events || []).map(event => ({
      ...event,
      ai_confidence: event.ai_confidence || 75,
      ai_suggested: event.ai_suggested || false,
      conflict_resolved: event.conflict_resolved || false,
      reminder_sent: event.reminder_sent || false,
      priority: event.priority || 'medium',
      event_type: event.event_type || 'general'
    }));

    return NextResponse.json({
      success: true,
      events: enhancedEvents
    });

  } catch (error) {
    console.error('Error in calendar API:', error);
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
    const { title, description, start_time, end_time, event_type, priority } = body;

    if (!title || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user's household
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('household_id')
      .eq('clerk_id', userId)
      .single();

    if (userError || !userData?.household_id) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }

    const householdId = userData.household_id;

    // Create new event
    const { data: newEvent, error: createError } = await supabase
      .from('household_events')
      .insert({
        title,
        description,
        start_time,
        end_time,
        household_id: householdId,
        created_by: userId,
        event_type: event_type || 'general',
        priority: priority || 'medium',
        ai_suggested: false,
        ai_confidence: 75,
        conflict_resolved: false,
        reminder_sent: false
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating event:', createError);
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event: newEvent
    });

  } catch (error) {
    console.error('Error in calendar POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 