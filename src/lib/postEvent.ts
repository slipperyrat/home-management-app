import { logger } from '@/lib/logging/logger';

export interface EventPayload extends Record<string, unknown> {
  occurred_at?: string;
  household_id?: string;
}

export interface PostEventParams {
  householdId: string;
  type: string;
  source?: string;
  payload?: EventPayload | Record<string, unknown>;
  occurredAt?: string;
}

export interface PostEventError {
  message: string;
  code?: string;
  details?: unknown;
}

export async function postEvent(params: PostEventParams): Promise<Record<string, unknown>> {
  if (!params.householdId || params.householdId.trim() === '') {
    const error = new Error(`householdId is required and cannot be empty. Received: "${params.householdId}"`);
    logger.error('postEvent validation error', error, { params });
    throw error;
  }

  if (!params.type || params.type.trim() === '') {
    const error = new Error(`type is required and cannot be empty. Received: "${params.type}"`);
    logger.error('postEvent validation error', error, { params });
    throw error;
  }

  try {
    const { fetchWithCSRF } = await import('@/lib/csrf-client');
    const response = await fetchWithCSRF('/api/events/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        householdId: params.householdId,
        type: params.type,
        source: params.source || 'web',
        payload: params.payload || {},
        occurredAt: params.occurredAt ?? new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const message = errorBody?.error || errorBody?.message || 'Failed to post event';
      throw {
        message,
        details: errorBody,
      } satisfies PostEventError;
    }

    const result = await response.json();
    return result?.data?.event ?? {};
  } catch (error) {
    if (error instanceof Error) {
      throw {
        message: error.message,
        details: error,
      } satisfies PostEventError;
    }

    throw {
      message: 'Failed to post event',
      details: error,
    } satisfies PostEventError;
  }
}

const ensureHousehold = (payload?: EventPayload) => {
  const householdId = payload?.household_id ?? '';
  if (!householdId) {
    throw new Error('household_id is required');
  }
  return householdId;
};

export const postEventTypes = {
  heartbeat: async (payload?: EventPayload) => {
    const householdId = ensureHousehold(payload);
    return postEvent({
      householdId,
      type: 'heartbeat',
      payload: payload ?? {},
      occurredAt: payload?.occurred_at ?? new Date().toISOString(),
    });
  },
  choreCompleted: async (payload: EventPayload) => {
    const householdId = ensureHousehold(payload);
    return postEvent({
      householdId,
      type: 'chore.completed',
      payload,
    });
  },
  billEmailReceived: async (payload: EventPayload) => {
    const householdId = ensureHousehold(payload);
    return postEvent({
      householdId,
      type: 'bill.email.received',
      payload,
    });
  },
  billCreated: async (payload: EventPayload) => {
    const householdId = ensureHousehold(payload);
    return postEvent({
      householdId,
      type: 'bill.created',
      payload,
    });
  },
  billPaid: async (payload: EventPayload) => {
    const householdId = ensureHousehold(payload);
    return postEvent({
      householdId,
      type: 'bill.paid',
      payload,
    });
  },
  shoppingListUpdated: async (payload: EventPayload) => {
    const householdId = ensureHousehold(payload);
    return postEvent({
      householdId,
      type: 'shopping_list.updated',
      payload,
    });
  },
};
