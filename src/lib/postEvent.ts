import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';

export interface PostEventParams {
  householdId: string;
  type: string;
  source?: string;
  payload?: Record<string, any>;
  occurredAt?: string;
}

export interface PostEventError {
  message: string;
  code?: string;
  details?: any;
}

export async function postEvent(params: PostEventParams): Promise<any> {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  try {
    const { data, error } = await supabase
      .from('household_events')
      .insert({
        household_id: params.householdId,
        type: params.type,
        source: params.source || 'app',
        payload: params.payload || {},
        occurred_at: params.occurredAt || new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Trigger automation dispatcher to process this event
    try {
      const automationResponse = await fetch('/api/automation/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: data
        }),
      });

      if (automationResponse.ok) {
        const result = await automationResponse.json();
        console.log('Automation triggered:', result);
      } else {
        console.warn('Failed to trigger automation:', automationResponse.status);
      }
    } catch (automationError) {
      console.warn('Automation dispatch failed:', automationError);
      // Don't fail the main event posting if automation fails
    }

    return data;
  } catch (error) {
    const postEventError: PostEventError = {
      message: error instanceof Error ? error.message : 'Failed to post event',
      details: error
    };
    
    console.error('postEvent error:', postEventError);
    throw postEventError;
  }
}

// Convenience functions for common event types
export const postEventTypes = {
  heartbeat: (payload?: Record<string, any>) => postEvent({ 
    householdId: '', // Will be set by the hook
    type: 'heartbeat', 
    payload 
  }),
  choreCompleted: (payload: Record<string, any>) => postEvent({ 
    householdId: '', // Will be set by the hook
    type: 'chore.completed', 
    payload 
  }),
  billEmailReceived: (payload: Record<string, any>) => postEvent({ 
    householdId: '', // Will be set by the hook
    type: 'bill.email.received', 
    payload 
  }),
  billCreated: (payload: Record<string, any>) => postEvent({ 
    householdId: '', // Will be set by the hook
    type: 'bill.created', 
    payload 
  }),
  billPaid: (payload: Record<string, any>) => postEvent({ 
    householdId: '', // Will be set by the hook
    type: 'bill.paid', 
    payload 
  }),
  shoppingListUpdated: (payload: Record<string, any>) => postEvent({ 
    householdId: '', // Will be set by the hook
    type: 'shopping_list.updated', 
    payload 
  })
};
