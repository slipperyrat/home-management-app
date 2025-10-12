import { logger } from '@/lib/logging/logger';

interface CalendarEventPayload {
  id?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  created_by: string;
  household_id: string;
}

export async function getCalendarEvents(householdId: string): Promise<CalendarEventPayload[]> {
  try {
    logger.info('Fetching calendar events', { householdId });
    const response = await fetch(`/api/calendar?householdId=${householdId}`);
    const result = (await response.json()) as { data?: CalendarEventPayload[]; error?: string };

    if (!response.ok) {
      logger.error('Error fetching calendar events', new Error(result.error ?? 'Unknown error'), {
        householdId,
      });
      throw new Error(result.error || 'Failed to fetch calendar events');
    }

    logger.info('Fetched calendar events', { householdId, count: result.data?.length ?? 0 });
    return result.data ?? [];
  } catch (error) {
    logger.error('Exception in getCalendarEvents', error as Error, { householdId });
    throw error;
  }
}

export async function addCalendarEvent(event: CalendarEventPayload): Promise<CalendarEventPayload> {
  try {
    logger.info('Adding calendar event', { householdId: event.household_id, title: event.title });
    const response = await fetch('/api/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    const result = (await response.json()) as { event?: CalendarEventPayload; data?: CalendarEventPayload; error?: string };

    if (!response.ok || (!result.event && !result.data)) {
      logger.error('Error adding calendar event', new Error(result.error ?? 'Unknown error'), {
        householdId: event.household_id,
        title: event.title,
      });
      throw new Error(result.error || 'Failed to add calendar event');
    }

    const createdEvent = result.event ?? result.data!;
    logger.info('Added calendar event', { householdId: event.household_id, eventId: createdEvent.id });
    return createdEvent;
  } catch (error) {
    logger.error('Exception in addCalendarEvent', error as Error, {
      householdId: event.household_id,
    });
    throw error;
  }
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  try {
    logger.info('Deleting calendar event', { id });
    const response = await fetch(`/api/calendar/${id}`, {
      method: 'DELETE',
    });
    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || result.error) {
      logger.error('Error deleting calendar event', new Error(result.error ?? 'Unknown error'), { id });
      throw new Error(result.error || 'Failed to delete calendar event');
    }

    logger.info('Deleted calendar event', { id });
  } catch (error) {
    logger.error('Exception in deleteCalendarEvent', error as Error, { id });
    throw error;
  }
} 