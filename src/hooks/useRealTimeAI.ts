// Real-time AI Processing Hook
// This can be easily removed if the real-time processing doesn't work

import { useState, useCallback, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useUserData } from './useUserData';
import { useWebSocket, type AIProcessingProgress } from './useWebSocket';
import { logger } from '@/lib/logging/logger';

export interface RealTimeAIRequest {
  type: 'shopping_suggestions' | 'meal_planning' | 'chore_assignment' | 'email_processing';
  context: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface RealTimeAIResponse {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  processingTime: number;
  provider: string;
  fallbackUsed: boolean;
}

export interface RealTimeAIStatus {
  isWebSocketConnected: boolean;
  connectedUsers: number;
  householdRooms: number;
  processingQueue: number;
  queueItems: Array<{
    requestId: string;
    type: string;
    priority: string;
    userId: string;
    householdId: string;
  }>;
}

export interface UseRealTimeAIReturn {
  // State
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  status: RealTimeAIStatus | null;
  processingRequests: Map<string, AIProcessingProgress>;
  completedRequests: Map<string, RealTimeAIResponse>;
  
  // Methods
  processRequest: (request: RealTimeAIRequest) => Promise<RealTimeAIResponse>;
  getStatus: () => Promise<RealTimeAIStatus | null>;
  clearQueue: () => Promise<void>;
  clearCompletedRequest: (requestId: string) => void;
  clearAllCompletedRequests: () => void;
  
  // WebSocket methods
  connect: () => void;
  disconnect: () => void;
}

export function useRealTimeAI(): UseRealTimeAIReturn {
  const { user } = useUser();
  const { userData } = useUserData();
  const {
    isConnected,
    isConnecting,
    error: wsError,
    processingRequests,
    completedRequests,
    connect: wsConnect,
    disconnect: wsDisconnect,
    clearCompletedRequest: wsClearCompletedRequest,
    clearAllCompletedRequests: wsClearAllCompletedRequests
  } = useWebSocket();

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RealTimeAIStatus | null>(null);

  const processRequest = useCallback(async (request: RealTimeAIRequest): Promise<RealTimeAIResponse> => {
    if (!user?.id || !userData?.household?.id) {
      throw new Error('User not authenticated or no household');
    }

    setError(null);

    try {
      const response = await fetch('/api/ai/realtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process AI request');
      }

      const result: { data: RealTimeAIResponse } = await response.json();
      return result.data;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to process AI request');
      logger.error('Real-time AI processing error', error, { userId: user?.id });
      setError(error.message);
      throw error;
    }
  }, [user?.id, userData?.household?.id]);

  const getStatus = useCallback(async (): Promise<RealTimeAIStatus | null> => {
    if (!user?.id || !userData?.household?.id) {
      return null;
    }

    try {
      const response = await fetch('/api/ai/realtime?action=status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to get status');
      }

      const result: { data: RealTimeAIStatus } = await response.json();
      setStatus(result.data);
      return result.data;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get real-time AI status');
      logger.error('Failed to get real-time AI status', error, { userId: user?.id });
      setError(error.message);
      return null;
    }
  }, [user?.id, userData?.household?.id]);

  const clearQueue = useCallback(async (): Promise<void> => {
    if (!user?.id || !userData?.household?.id) {
      return;
    }

    try {
      const response = await fetch('/api/ai/realtime?action=clear_queue', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear queue');
      }

      // Refresh status after clearing queue
      await getStatus();

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to clear queue');
      logger.error('Failed to clear real-time AI queue', error, { userId: user?.id });
      setError(error.message);
    }
  }, [user?.id, userData?.household?.id, getStatus]);

  const clearCompletedRequest = useCallback((requestId: string) => {
    wsClearCompletedRequest(requestId);
  }, [wsClearCompletedRequest]);

  const clearAllCompletedRequests = useCallback(() => {
    wsClearAllCompletedRequests();
  }, [wsClearAllCompletedRequests]);

  const connect = useCallback(() => {
    wsConnect();
  }, [wsConnect]);

  const disconnect = useCallback(() => {
    wsDisconnect();
  }, [wsDisconnect]);

  // Auto-connect when user is available
  useEffect(() => {
    if (user?.id && userData?.household?.id && !isConnected && !isConnecting) {
      connect();
    }
  }, [user?.id, userData?.household?.id, isConnected, isConnecting, connect]);

  // Auto-fetch status when connected
  useEffect(() => {
    if (isConnected && user?.id && userData?.household?.id) {
      getStatus();
    }
  }, [isConnected, user?.id, userData?.household?.id, getStatus]);

  // Combine WebSocket and API errors
  const combinedError = error || wsError;

  return {
    isConnected,
    isConnecting,
    error: combinedError,
    status,
    processingRequests,
    completedRequests,
    processRequest,
    getStatus,
    clearQueue,
    clearCompletedRequest,
    clearAllCompletedRequests,
    connect,
    disconnect
  };
}
