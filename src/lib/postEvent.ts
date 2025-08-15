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

// Convenience function for common event types
export const postEventTypes = {
  heartbeat: (householdId: string) => postEvent({ householdId, type: 'heartbeat' }),
  choreCompleted: (householdId: string, choreId: string, userId: string) => 
    postEvent({ 
      householdId, 
      type: 'chore.completed', 
      payload: { choreId, userId } 
    }),
  billReceived: (householdId: string, billData: any) => 
    postEvent({ 
      householdId, 
      type: 'bill.email.received', 
      payload: billData 
    }),
  shoppingListUpdated: (householdId: string, listId: string, action: string) => 
    postEvent({ 
      householdId, 
      type: 'shopping_list.updated', 
      payload: { listId, action } 
    })
};
