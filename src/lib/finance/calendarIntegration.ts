import { getDatabaseClient } from '@/lib/api/database'
import { logger } from '@/lib/logging/logger'
import type { Database, Json } from '@/types/supabase.generated'

type HouseholdEventRow = Database['public']['Tables']['household_events']['Row']

type BillCalendarPayload = {
  bill_id: string
  bill_amount: number
  bill_currency: string
  event_type: 'bill_due'
}

export interface BillCalendarEvent {
  title: string
  description: string
  start_time: string | null
  end_time: string | null
  household_id: string
  created_by: string | null
  type: string
  source: string
  payload: BillCalendarPayload
  event_type: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent' | null
  ai_suggested: boolean | null
  ai_confidence: number | null
  conflict_resolved: boolean | null
  reminder_sent: boolean | null
}

export async function createBillCalendarEvent(
  bill: {
    id: string
    title: string
    description?: string | null
    amount: number
    currency: string
    due_date: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    category?: string | null
  },
  householdId: string,
  createdBy: string,
): Promise<HouseholdEventRow> {
  const db = getDatabaseClient()

  const eventData: Database['public']['Tables']['household_events']['Insert'] = {
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
      event_type: 'bill_due',
    } as unknown as Json,
    event_type: 'bill_due',
    priority: bill.priority,
    ai_suggested: false,
    ai_confidence: 100,
    conflict_resolved: false,
    reminder_sent: false,
    occurred_at: `${bill.due_date}T09:00:00Z`,
  }

  const { data: event, error } = await db
    .from('household_events')
    .insert(eventData)
    .select()
    .single()

  if (error || !event) {
    logger.error('Error creating bill calendar event', error ?? new Error('No event returned'), {
      billId: bill.id,
      householdId,
    })
    throw new Error(`Failed to create calendar event: ${error?.message ?? 'Unknown error'}`)
  }

  logger.info('Created bill calendar event', { billId: bill.id, householdId })
  return event
}

export async function updateBillCalendarEvent(
  billId: string,
  updates: {
    paid?: boolean
    new_due_date?: string
    new_amount?: number
    new_title?: string
  },
  householdId: string,
): Promise<void> {
  const db = getDatabaseClient()

  const { data: events, error: findError } = await db
    .from('household_events')
    .select('*')
    .eq('household_id', householdId)
    .eq('type', 'calendar.event')
    .contains('payload', { bill_id: billId })

  if (findError) {
    logger.error('Error finding bill calendar event', findError, { billId, householdId })
    return
  }

  if (!events || events.length === 0) {
    logger.warn('No calendar event found for bill', { billId, householdId })
    return
  }

  const event = events[0]
  if (!event) {
    return
  }

  if (updates.paid) {
    const { error: deleteError } = await db
      .from('household_events')
      .delete()
      .eq('id', event.id)

    if (deleteError) {
      logger.error('Error deleting paid bill calendar event', deleteError, { billId, householdId })
    }
    return
  }

  const updateData: Database['public']['Tables']['household_events']['Update'] = {}

  if (updates.new_due_date) {
    const newStart = `${updates.new_due_date}T09:00:00Z`
    const newEnd = `${updates.new_due_date}T10:00:00Z`
    updateData.start_time = newStart
    updateData.end_time = newEnd
    updateData.occurred_at = newStart
  }

  if (updates.new_title) {
    updateData.title = `Bill Due: ${updates.new_title}`
  }

  if (typeof updates.new_amount === 'number') {
    const currentPayload = (event.payload as BillCalendarPayload | null) ?? null
    updateData.payload = {
      ...(currentPayload ?? {}),
      bill_amount: updates.new_amount,
    } as unknown as Json

    if (event.description) {
      const currency = currentPayload?.bill_currency ?? ''
      updateData.description = event.description.replace(
        /Amount: [^\n]+/,
        `Amount: ${currency} ${updates.new_amount.toFixed(2)}`,
      )
    }
  }

  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await db
      .from('household_events')
      .update(updateData)
      .eq('id', event.id)

    if (updateError) {
      logger.error('Error updating bill calendar event', updateError, { billId, householdId })
    }
  }
}

export async function deleteBillCalendarEvent(billId: string, householdId: string): Promise<void> {
  const db = getDatabaseClient()

  const { error } = await db
    .from('household_events')
    .delete()
    .eq('household_id', householdId)
    .eq('type', 'calendar.event')
    .contains('payload', { bill_id: billId })

  if (error) {
    logger.error('Error deleting bill calendar event', error, { billId, householdId })
  }
}

export async function createRecurringBillEvents(
  bill: {
    id: string
    title: string
    description?: string | null
    amount: number
    currency: string
    due_date: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    category?: string | null
    recurring_rrule?: string | null
  },
  householdId: string,
  createdBy: string,
  monthsAhead = 6,
): Promise<HouseholdEventRow[]> {
  const events: HouseholdEventRow[] = []

  if (!bill.recurring_rrule) {
    const event = await createBillCalendarEvent(bill, householdId, createdBy)
    events.push(event)
    return events
  }

  const startDate = new Date(bill.due_date)

  for (let i = 0; i < monthsAhead; i += 1) {
    const eventDate = new Date(startDate)
    eventDate.setMonth(eventDate.getMonth() + i)

    const recurringBill = {
      ...bill,
      id: `${bill.id}_${i}`,
      due_date: eventDate.toISOString().split('T')[0],
      priority: bill.priority ?? 'medium',
    } as typeof bill

    const event = await createBillCalendarEvent(recurringBill, householdId, createdBy)
    events.push(event)
  }

  return events
}

export async function syncBillsWithCalendar(householdId: string): Promise<void> {
  const db = getDatabaseClient()

  const { data: bills, error: billsError } = await db
    .from('bills')
    .select('*')
    .eq('household_id', householdId)
    .eq('status', 'pending')

  if (billsError) {
    logger.error('Error fetching bills for calendar sync', billsError, { householdId })
    return
  }

  if (!bills || bills.length === 0) {
    return
  }

  const { data: existingEvents, error: eventsError } = await db
    .from('household_events')
    .select('*')
    .eq('household_id', householdId)
    .eq('type', 'calendar.event')
    .contains('payload', { event_type: 'bill_due' })

  if (eventsError) {
    logger.error('Error fetching existing bill events', eventsError, { householdId })
    return
  }

  const existingBillIds = new Set(
    existingEvents?.map((event) => (event.payload as BillCalendarPayload | null)?.bill_id).filter(Boolean) as string[] ?? [],
  )

  for (const bill of bills) {
    if (!existingBillIds.has(bill.id)) {
      try {
        await createBillCalendarEvent(
          {
            ...bill,
            priority: (bill.priority as 'low' | 'medium' | 'high' | 'urgent') ?? 'medium',
            description: bill.description ?? '',
          },
          householdId,
          bill.created_by ?? householdId,
        )
        logger.info('Created calendar event for bill', { billId: bill.id, householdId })
      } catch (error) {
        logger.error('Failed to create calendar event', error as Error, { billId: bill.id, householdId })
      }
    }
  }

  if (existingEvents) {
    for (const event of existingEvents) {
      const payload = event.payload as BillCalendarPayload | null
      const billId = payload?.bill_id
      if (!billId) continue

      const bill = bills.find((b) => b.id === billId)
      if (!bill || bill.status === 'paid') {
        await deleteBillCalendarEvent(billId, householdId)
        logger.info('Deleted calendar event for bill', { billId, status: bill ? 'paid' : 'removed' })
      }
    }
  }
}
