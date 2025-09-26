import { getDatabaseClient } from '@/lib/api/database';

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

/**
 * Create a calendar event for a bill due date
 */
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
  household_id: string,
  created_by: string
): Promise<any> {
  const db = getDatabaseClient();

  // Create calendar event for bill due date
  const eventData = {
    title: `Bill Due: ${bill.title}`,
    description: `Bill payment due: ${bill.title}${bill.description ? ` - ${bill.description}` : ''}\nAmount: ${bill.currency} ${bill.amount.toFixed(2)}${bill.category ? `\nCategory: ${bill.category}` : ''}`,
    start_time: `${bill.due_date}T09:00:00Z`, // 9 AM on due date
    end_time: `${bill.due_date}T10:00:00Z`,   // 1 hour duration
    household_id,
    created_by,
    type: 'calendar.event',
    source: 'bill_automation',
    payload: {
      bill_id: bill.id,
      bill_amount: bill.amount,
      bill_currency: bill.currency,
      event_type: 'bill_due'
    },
    event_type: 'bill_due',
    priority: bill.priority,
    ai_suggested: false,
    ai_confidence: 100,
    conflict_resolved: false,
    reminder_sent: false
  };

  const { data: event, error } = await db
    .from('household_events')
    .insert(eventData)
    .select()
    .single();

  if (error) {
    console.error('Error creating bill calendar event:', error);
    throw new Error(`Failed to create calendar event: ${error.message}`);
  }

  return event;
}

/**
 * Update calendar event when bill is paid or modified
 */
export async function updateBillCalendarEvent(
  bill_id: string,
  updates: {
    paid?: boolean;
    new_due_date?: string;
    new_amount?: number;
    new_title?: string;
  },
  household_id: string
): Promise<void> {
  const db = getDatabaseClient();

  // Find the calendar event for this bill
  const { data: events, error: findError } = await db
    .from('household_events')
    .select('*')
    .eq('household_id', household_id)
    .eq('type', 'calendar.event')
    .contains('payload', { bill_id });

  if (findError) {
    console.error('Error finding bill calendar event:', findError);
    return;
  }

  if (!events || events.length === 0) {
    console.warn(`No calendar event found for bill ${bill_id}`);
    return;
  }

  const event = events[0];

  if (updates.paid) {
    // Mark event as completed or delete it
    const { error: deleteError } = await db
      .from('household_events')
      .delete()
      .eq('id', event.id);

    if (deleteError) {
      console.error('Error deleting paid bill calendar event:', deleteError);
    }
  } else {
    // Update the event with new information
    const updateData: any = {};

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
        bill_amount: updates.new_amount
      };
      updateData.description = updateData.description?.replace(
        /Amount: [^\n]+/,
        `Amount: ${event.payload.bill_currency} ${updates.new_amount.toFixed(2)}`
      );
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await db
        .from('household_events')
        .update(updateData)
        .eq('id', event.id);

      if (updateError) {
        console.error('Error updating bill calendar event:', updateError);
      }
    }
  }
}

/**
 * Delete calendar event when bill is deleted
 */
export async function deleteBillCalendarEvent(
  bill_id: string,
  household_id: string
): Promise<void> {
  const db = getDatabaseClient();

  const { error } = await db
    .from('household_events')
    .delete()
    .eq('household_id', household_id)
    .eq('type', 'calendar.event')
    .contains('payload', { bill_id });

  if (error) {
    console.error('Error deleting bill calendar event:', error);
  }
}

/**
 * Create recurring calendar events for recurring bills
 */
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
  household_id: string,
  created_by: string,
  months_ahead: number = 6
): Promise<any[]> {
  const events = [];

  if (!bill.recurring_rrule) {
    // Single bill - create one event
    const event = await createBillCalendarEvent(bill, household_id, created_by);
    events.push(event);
    return events;
  }

  // Parse RRULE and create multiple events
  // For now, we'll create monthly recurring events
  // In a full implementation, you'd parse the RRULE properly
  const startDate = new Date(bill.due_date);
  
  for (let i = 0; i < months_ahead; i++) {
    const eventDate = new Date(startDate);
    eventDate.setMonth(eventDate.getMonth() + i);

    const recurringBill = {
      ...bill,
      id: `${bill.id}_${i}`, // Temporary ID for recurring instances
      due_date: eventDate.toISOString().split('T')[0]
    };

    const event = await createBillCalendarEvent(recurringBill, household_id, created_by);
    events.push(event);
  }

  return events;
}

/**
 * Sync all bills with calendar events
 * This can be called periodically to ensure calendar events are up to date
 */
export async function syncBillsWithCalendar(household_id: string): Promise<void> {
  const db = getDatabaseClient();

  // Get all bills for the household
  const { data: bills, error: billsError } = await db
    .from('bills')
    .select('*')
    .eq('household_id', household_id)
    .eq('status', 'pending'); // Only sync pending bills

  if (billsError) {
    console.error('Error fetching bills for calendar sync:', billsError);
    return;
  }

  if (!bills || bills.length === 0) {
    return;
  }

  // Get existing bill calendar events
  const { data: existingEvents, error: eventsError } = await db
    .from('household_events')
    .select('*')
    .eq('household_id', household_id)
    .eq('type', 'calendar.event')
    .contains('payload', { event_type: 'bill_due' });

  if (eventsError) {
    console.error('Error fetching existing bill events:', eventsError);
    return;
  }

  const existingBillIds = new Set(
    existingEvents?.map(event => event.payload?.bill_id).filter(Boolean) || []
  );

  // Create calendar events for bills that don't have them
  for (const bill of bills) {
    if (!existingBillIds.has(bill.id)) {
      try {
        await createBillCalendarEvent(bill, household_id, bill.created_by);
        console.log(`Created calendar event for bill: ${bill.title}`);
      } catch (error) {
        console.error(`Failed to create calendar event for bill ${bill.id}:`, error);
      }
    }
  }

  // Clean up calendar events for bills that no longer exist or are paid
  if (existingEvents) {
    for (const event of existingEvents) {
      const billId = event.payload?.bill_id;
      if (billId) {
        const bill = bills.find(b => b.id === billId);
        if (!bill || bill.status === 'paid') {
          await deleteBillCalendarEvent(billId, household_id);
          console.log(`Deleted calendar event for ${bill ? 'paid' : 'deleted'} bill: ${billId}`);
        }
      }
    }
  }
}
