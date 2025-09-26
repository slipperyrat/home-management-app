import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 GET: Fetching calendar events for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const supabase = getDatabaseClient();

      // Fetch calendar events for the household
      const { data: events, error: eventsError } = await supabase
        .from('household_events')
        .select('*')
        .eq('household_id', household.id)
        .order('start_time', { ascending: true });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        return createErrorResponse('Failed to fetch events', 500, eventsError.message);
      }

      // Filter and enhance calendar events (only show calendar.event type)
      const calendarEvents = (events || []).filter(event => event.type === 'calendar.event');
      
      const enhancedEvents = calendarEvents.map(event => ({
        ...event,
        // Map database fields to frontend expected fields
        startAt: event.start_time,
        endAt: event.end_time,
        ai_confidence: event.ai_confidence || 75,
        ai_suggested: event.ai_suggested || false,
        conflict_resolved: event.conflict_resolved || false,
        reminder_sent: event.reminder_sent || false,
        priority: event.priority || 'medium',
        event_type: event.event_type || event.payload?.event_type || 'general'
      }));

      return createSuccessResponse({ events: enhancedEvents }, 'Events fetched successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/calendar', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 POST: Creating calendar event for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const body = await req.json();
      const { title, description, start_time, end_time, event_type, priority } = body;

      if (!title || !start_time || !end_time) {
        return createErrorResponse('Missing required fields: title, start_time, end_time', 400);
      }

      const supabase = getDatabaseClient();

      // Create new event
      const eventData = {
        title,
        description: description || '',
        start_time,
        end_time,
        household_id: household.id,
        created_by: user.id,
        type: 'calendar.event', // Required type column for automation system
        source: 'web', // Required source column for automation system
        payload: { event_type: event_type || 'general' }, // Store event_type in payload
        event_type: event_type || 'general',
        priority: priority || 'medium',
        ai_suggested: false,
        ai_confidence: 75,
        conflict_resolved: false,
        reminder_sent: false
      };
      
      
      const { data: newEvent, error: createError } = await supabase
        .from('household_events')
        .insert(eventData)
        .select()
        .single();

      if (createError) {
        console.error('Error creating event:', createError);
        return createErrorResponse('Failed to create event', 500, createError.message);
      }

      // Add audit log entry
      await createAuditLog({
        action: 'event.created',
        targetTable: 'household_events',
        targetId: newEvent.id,
        userId: user.id,
        metadata: { 
          event_title: title,
          household_id: household.id,
          event_type: event_type || 'general'
        }
      });

      return createSuccessResponse({ event: newEvent }, 'Event created successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/calendar', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
} 