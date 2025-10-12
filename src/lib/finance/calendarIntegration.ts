import { getDatabaseClient } from '@/lib/api/database';
import { logger } from '@/lib/logging/logger';
import type { Database } from '@/types/database';

export interface BillCalendarEvent {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  event_type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  payload: {
    bill_id: string;
    bill_amount: number;
    bill_currency: string;
    event_type: 'bill_due';
  };
}

export async function createBillCalendarEvent(
  bill: {
    id: string;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    due_date: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category?: string;
  },
  householdId: string,
  createdBy: string,
): Promise<Database['public']['Tables']['household_events']['Row']> {
  const db = getDatabaseClient();

  const eventData = {
    title: `Bill Due: ${bill.title}`,
    description: `Bill payment due: ${bill.title}${bill.description ? ` - ${bill.description}` : ''}\nAmount: ${bill.currency} ${bill.amount.toFixed(2)}${bill.category ? `\nCategory: ${bill.category}` : ''}`,
    start_time: `${bill.due_date}T09:00:00Z`,
    end_time: `${bill.due_date}T10:00:00Z`,
    household_id: householdId,
    created_by: createdBy,
    type: 'calendar.event',
    source: 'bill_automation',
    payload: {
      bill_id: bill.id,
      bill_amount: bill.amount,
      bill_currency: bill.currency,
      event_type: 'bill_due' as const,
    },
    event_type: 'bill_due',
    priority: bill.priority,
    ai_suggested: false,
    ai_confidence: 100,
    conflict_resolved: false,
    reminder_sent: false,
  } satisfies BillCalendarEvent & Database['public']['Tables']['household_events']['Row'];

  const { data: event, error } = await db
    .from('household_events')
    .insert(eventData)
    .select()
    .single();

  if (error || !event) {
    logger.error('Error creating bill calendar event', error ?? new Error('No event returned'), {
      billId: bill.id,
      householdId,
    });
    throw new Error(`Failed to create calendar event: ${error?.message ?? 'Unknown error'}`);
  }

  logger.info('Created bill calendar event', { billId: bill.id, householdId });
  return event;
}

export async function updateBillCalendarEvent(
  billId: string,
  updates: {
    paid?: boolean;
    new_due_date?: string;
    new_amount?: number;
    new_title?: string;
  },
  householdId: string,
): Promise<void> {
  const db = getDatabaseClient();

  const { data: events, error: findError } = await db
    .from('household_events')
    .select('*')
    .eq('household_id', householdId)
    .eq('type', 'calendar.event')
    .contains('payload', { bill_id: billId });

  if (findError) {
    logger.error('Error finding bill calendar event', findError, { billId, householdId });
    return;
  }

  if (!events || events.length === 0) {
    logger.warn('No calendar event found for bill', { billId, householdId });
    return;
  }

  const event = events[0];

  if (updates.paid) {
    const { error: deleteError } = await db
      .from('household_events')
      .delete()
      .eq('id', event.id);

    if (deleteError) {
      logger.error('Error deleting paid bill calendar event', deleteError, { billId, householdId });
    }
    return;
  }

  const updateData: Partial<Database['public']['Tables']['household_events']['Row']> & { payload?: Record<string, unknown> } = {};

  if (updates.new_due_date) {
    updateData.start_time = `${updates.new_due_date}T09:00:00Z`;
    updateData.end_time = `${updates.new_due_date}T10:00:00Z`;
  }

  if (updates.new_title) {
    updateData.title = `Bill Due: ${updates.new_title}`;
  }

  if (updates.new_amount) {
    updateData.payload = {
      ...event.payload,
      bill_amount: updates.new_amount,
    };

    if (event.description) {
      updateData.description = event.description.replace(
        /Amount: [^\n]+/,
        `Amount: ${event.payload?.bill_currency ?? ''} ${updates.new_amount.toFixed(2)}`,
      );
    }
  }

  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await db
      .from('household_events')
      .update(updateData)
      .eq('id', event.id);

    if (updateError) {
      logger.error('Error updating bill calendar event', updateError, { billId, householdId });
    }
  }
}

export async function deleteBillCalendarEvent(billId: string, householdId: string): Promise<void> {
  const db = getDatabaseClient();

  const { error } = await db
    .from('household_events')
    .delete()
    .eq('household_id', householdId)
    .eq('type', 'calendar.event')
    .contains('payload', { bill_id: billId });

  if (error) {
    logger.error('Error deleting bill calendar event', error, { billId, householdId });
  }
}

export async function createRecurringBillEvents(
  bill: {
    id: string;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    due_date: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category?: string;
    recurring_rrule?: string;
  },
  householdId: string,
  createdBy: string,
  monthsAhead = 6,
): Promise<Database['public']['Tables']['household_events']['Row'][]> {
  const events: Database['public']['Tables']['household_events']['Row'][] = [];

  if (!bill.recurring_rrule) {
    const event = await createBillCalendarEvent(bill, householdId, createdBy);
    events.push(event);
    return events;
  }

  const startDate = new Date(bill.due_date);

  for (let i = 0; i < monthsAhead; i += 1) {
    const eventDate = new Date(startDate);
    eventDate.setMonth(eventDate.getMonth() + i);

    const recurringBill = {
      ...bill,
      id: `${bill.id}_${i}`,
      due_date: eventDate.toISOString().split('T')[0],
    };

    const event = await createBillCalendarEvent(recurringBill, householdId, createdBy);
    events.push(event);
  }

  return events;
}

export async function syncBillsWithCalendar(householdId: string): Promise<void> {
  const db = getDatabaseClient();

  const { data: bills, error: billsError } = await db
    .from('bills')
    .select('*')
    .eq('household_id', householdId)
    .eq('status', 'pending');

  if (billsError) {
    logger.error('Error fetching bills for calendar sync', billsError, { householdId });
    return;
  }

  if (!bills || bills.length === 0) {
    return;
  }

  const { data: existingEvents, error: eventsError } = await db
    .from('household_events')
    .select('*')
    .eq('household_id', householdId)
    .eq('type', 'calendar.event')
    .contains('payload', { event_type: 'bill_due' });

  if (eventsError) {
    logger.error('Error fetching existing bill events', eventsError, { householdId });
    return;
  }

  const existingBillIds = new Set(
    existingEvents?.map((event) => event.payload?.bill_id).filter(Boolean) as string[] ?? [],
  );

  for (const bill of bills) {
    if (!existingBillIds.has(bill.id)) {
      try {
        await createBillCalendarEvent(bill, householdId, bill.created_by);
        logger.info('Created calendar event for bill', { billId: bill.id, householdId });
      } catch (error) {
        logger.error('Failed to create calendar event', error as Error, { billId: bill.id, householdId });
      }
    }
  }

  if (existingEvents) {
    for (const event of existingEvents) {
      const billId = event.payload?.bill_id as string | undefined;
      if (!billId) continue;

      const bill = bills.find((b) => b.id === billId);
      if (!bill || bill.status === 'paid') {
        await deleteBillCalendarEvent(billId, householdId);
        logger.info('Deleted calendar event for bill', { billId, status: bill ? 'paid' : 'removed' });
      }
    }
  }
}
