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
  // Validate required parameters
  if (!params.householdId || params.householdId.trim() === '') {
    const error = new Error(`householdId is required and cannot be empty. Received: "${params.householdId}"`);
    console.error('postEvent validation error:', error);
    console.error('postEvent params:', params);
    throw error;
  }

  if (!params.type || params.type.trim() === '') {
    const error = new Error(`type is required and cannot be empty. Received: "${params.type}"`);
    console.error('postEvent validation error:', error);
    console.error('postEvent params:', params);
    throw error;
  }

  console.log('postEvent called with params:', {
    householdId: params.householdId,
    type: params.type,
    source: params.source,
    payload: params.payload
  });

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
        source: params.source || 'web',
        payload: params.payload || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    console.log('Event posted successfully:', data);

    // Re-enable automation dispatch for automated workflows
    try {
      const automationResponse = await fetch('/api/automation/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: {
            id: data.id,
            household_id: params.householdId,
            type: params.type,
            source: params.source || 'web',
            payload: params.payload || {},
            occurred_at: data.occurred_at
          }
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
    console.error('postEvent failed params:', params);
    throw postEventError;
  }
}

// Convenience functions for common event types
export const postEventTypes = {
  heartbeat: (payload?: Record<string, any>) => {
    const householdId = payload?.household_id || '';
    if (!householdId) {
      console.warn('postEventTypes.heartbeat: No household_id provided in payload');
      return Promise.reject(new Error('household_id is required'));
    }
    return postEvent({ 
      householdId, 
      type: 'heartbeat', 
      payload: payload || {}
    });
  },
  choreCompleted: (payload: Record<string, any>) => {
    const householdId = payload?.household_id || '';
    if (!householdId) {
      console.warn('postEventTypes.choreCompleted: No household_id provided in payload');
      return Promise.reject(new Error('household_id is required'));
    }
    return postEvent({ 
      householdId, 
      type: 'chore.completed', 
      payload 
    });
  },
  billEmailReceived: (payload: Record<string, any>) => {
    const householdId = payload?.household_id || '';
    if (!householdId) {
      console.warn('postEventTypes.billEmailReceived: No household_id provided in payload');
      return Promise.reject(new Error('household_id is required'));
    }
    return postEvent({ 
      householdId, 
      type: 'bill.email.received', 
      payload 
    });
  },
  billCreated: (payload: Record<string, any>) => {
    const householdId = payload?.household_id || '';
    if (!householdId) {
      console.warn('postEventTypes.billCreated: No household_id provided in payload');
      return Promise.reject(new Error('household_id is required'));
    }
    return postEvent({ 
      householdId, 
      type: 'bill.created', 
      payload 
    });
  },
  billPaid: (payload: Record<string, any>) => {
    const householdId = payload?.household_id || '';
    if (!householdId) {
      console.warn('postEventTypes.billPaid: No household_id provided in payload');
      return Promise.reject(new Error('household_id is required'));
    }
    return postEvent({ 
      householdId, 
      type: 'bill.paid', 
      payload 
    });
  },
  shoppingListUpdated: (payload: Record<string, any>) => {
    const householdId = payload?.household_id || '';
    if (!householdId) {
      console.warn('postEventTypes.shoppingListUpdated: No household_id provided in payload');
      return Promise.reject(new Error('household_id is required'));
    }
    return postEvent({ 
      householdId, 
      type: 'shopping_list.updated', 
      payload 
    });
  }
};
