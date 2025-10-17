import { NextRequest } from 'next/server';
import { z } from 'zod';

import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getDatabaseClient, getUserAndHouseholdData, createAuditLog } from '@/lib/api/database';
import { createSuccessResponse, createValidationErrorResponse, handleApiError } from '@/lib/api/errors';
import { createCalendarEventInputSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logging/logger';

const calendarQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  type: z.string().max(50).optional()
});

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user) {
        logger.warn('Calendar fetch attempted without authenticated user', {
          url: req.url,
          route: '/api/calendar',
          securityEvent: true,
          severity: 'medium',
        });
        return createValidationErrorResponse([
          {
            path: ['user'],
            message: 'Authentication required',
            code: 'custom',
          },
        ]);
      }

      const queryValidation = calendarQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
      if (!queryValidation.success) {
        return createValidationErrorResponse(queryValidation.error.errors);
      }

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createValidationErrorResponse([
          {
            path: ['household'],
            message: 'User not associated with a household',
            code: 'custom'
          }
        ]);
      }

      const supabase = getDatabaseClient();

      // Fetch calendar events for the household
      const { data: events, error: eventsError } = await supabase
        .from('household_events')
        .select('*')
        .eq('household_id', household.id)
        .order('start_time', { ascending: true });

      if (eventsError) {
        throw eventsError;
      }

      // Filter and enhance calendar events (only show calendar.event type)
      const calendarEvents = (events || []).filter((event) => event.type === 'calendar.event');

      const enhancedEvents = calendarEvents.map((event) => {
        const payload = event.payload;
        let derivedEventType = event.event_type;

        if (!derivedEventType && payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const candidate = (payload as Record<string, unknown>).event_type;
          if (typeof candidate === 'string' && candidate.length > 0) {
            derivedEventType = candidate;
          }
        }

        return {
          ...event,
          startAt: event.start_time,
          endAt: event.end_time,
          ai_confidence: event.ai_confidence ?? 75,
          ai_suggested: event.ai_suggested ?? false,
          conflict_resolved: event.conflict_resolved ?? false,
          reminder_sent: event.reminder_sent ?? false,
          priority: event.priority ?? 'medium',
          event_type: derivedEventType ?? 'general',
        };
      });

      return createSuccessResponse({ events: enhancedEvents }, 'Events fetched successfully');

    } catch (error) {
      return handleApiError(error, {
        route: '/api/calendar',
        method: 'GET',
        ...(user ? { userId: user.id } : {}),
      });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user) {
        logger.warn('Calendar create attempted without authenticated user', {
          url: req.url,
          route: '/api/calendar',
          securityEvent: true,
          severity: 'medium',
        });
        return createValidationErrorResponse([
          {
            path: ['user'],
            message: 'Authentication required',
            code: 'custom',
          },
        ]);
      }

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createValidationErrorResponse([
          {
            path: ['household'],
            message: 'User not associated with a household',
            code: 'custom'
          }
        ]);
      }

      const body = await req.json();
      const validated = createCalendarEventInputSchema.safeParse(body);

      if (!validated.success) {
        return createValidationErrorResponse(validated.error.errors);
      }

      const { title, description, start_time, end_time, event_type, priority } = validated.data;
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
        throw createError;
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

      await logger.info('Calendar event created', {
        userId: user.id,
        householdId: household.id,
        eventId: newEvent.id
      });

      return createSuccessResponse({ event: newEvent }, 'Event created successfully');

    } catch (error) {
      return handleApiError(error, {
        route: '/api/calendar',
        method: 'POST',
        ...(user ? { userId: user.id } : {}),
      });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
} 