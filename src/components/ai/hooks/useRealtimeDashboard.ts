'use client';

import { useCallback, useMemo } from 'react';
import { useRealTimeAI } from '@/hooks/useRealTimeAI';
import type { RealTimeAIRequest } from '@/types/websocket';
import type {
  RealTimeRequestPayload,
  ProgressUpdate,
  CompletedResult,
  RealtimeStatus,
  AIRequestType,
} from '../types/dashboard';

export const useRealtimeDashboard = () => {
  const realtime = useRealTimeAI();

  const processingRequests = useMemo(
    () => Array.from(realtime.processingRequests.entries()) as Array<[string, ProgressUpdate]>,
    [realtime.processingRequests],
  );

  const completedRequests = useMemo(
    () => Array.from(realtime.completedRequests.entries()) as Array<[string, CompletedResult]>,
    [realtime.completedRequests],
  );

  const buildRequest = useCallback(
    <T extends Record<string, unknown>>(type: AIRequestType, context: T, priority: RealTimeRequestPayload['priority']): RealTimeRequestPayload<T> => ({
      type,
      context,
      priority,
    }),
    [],
  );

  const sendRequest = useCallback(
    async <T extends Record<string, unknown>>(payload: RealTimeRequestPayload<T>) => {
      const request: RealTimeAIRequest = {
        type: payload.type,
        context: payload.context as RealTimeAIRequest['context'],
        requestId: payload.requestId ?? `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        priority: payload.priority,
        userId: realtime.userId,
        householdId: realtime.householdId,
      };

      await realtime.processRequest(request);
    },
    [realtime],
  );

  return {
    ...realtime,
    processingRequests,
    completedRequests,
    buildRequest,
    sendRequest,
    status: realtime.status as RealtimeStatus | null,
  };
};
