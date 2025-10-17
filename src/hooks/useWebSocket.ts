// WebSocket Client Hook for Real-time AI Processing
// This can be easily removed if the WebSocket implementation doesn't work

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUser } from '@clerk/nextjs';
import { useUserData } from './useUserData';
import { logger } from '@/lib/logging/logger';
import type { RealTimeAIRequest } from '@/types/websocket';

interface WebSocketEnvelope<TData = unknown> {
  type: string;
  data: TData;
  timestamp: string;
  requestId?: string;
  userId?: string;
  householdId?: string;
}

type AIRequestContext = Record<string, unknown>;

export interface AIProcessingProgress {
  step: string;
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number; // in seconds
}

export interface AIProcessingResult {
  success: boolean;
  data?: unknown;
  error?: string;
  processingTime: number;
  provider: string;
  fallbackUsed: boolean;
  requestId?: string;
}

export interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketEnvelope | null;
  processingRequests: Map<string, AIProcessingProgress>;
  completedRequests: Map<string, AIProcessingResult>;
  
  // Methods
  connect: () => void;
  disconnect: () => void;
  joinHousehold: (householdId: string) => void;
  requestAIProcessing: (type: string, context: AIRequestContext) => string;
  clearCompletedRequest: (requestId: string) => void;
  clearAllCompletedRequests: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const { user } = useUser();
  const { userData } = useUserData();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketEnvelope | null>(null);
  const [processingRequests, setProcessingRequests] = useState<Map<string, AIProcessingProgress>>(new Map());
  const [completedRequests, setCompletedRequests] = useState<Map<string, AIProcessingResult>>(new Map());
  
  const socketRef = useRef<Socket | null>(null);
  const requestCounterRef = useRef(0);

  const joinHousehold = useCallback((householdId: string) => {
    if (socketRef.current?.connected && user?.id) {
      socketRef.current.emit('join_household', {
        userId: user.id,
        householdId,
      });
    }
  }, [user?.id]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected || isConnecting) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const newSocket = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
        path: '/api/websocket',
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      newSocket.on('connect', () => {
        logger.info('WebSocket connected', user?.id ? { userId: user.id } : {});
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        
        // Auto-join household if user data is available
        if (userData?.household?.id) {
          joinHousehold(userData.household.id);
        }
      });

      newSocket.on('disconnect', (reason) => {
        logger.info('WebSocket disconnected', { reason });
        setIsConnected(false);
        setIsConnecting(false);
      });

      newSocket.on('connect_error', (err) => {
        logger.error('WebSocket connection error', err, user?.id ? { userId: user.id } : {});
        setError(err.message);
        setIsConnecting(false);
      });

      newSocket.on('ai_update', (message: WebSocketEnvelope) => {
        logger.debug('Received AI update', { message });
        setLastMessage(message as any);
        
        // Handle different message types
        switch (message.type) {
          case 'ai_processing_start': {
            const requestId = message.requestId;
            if (!requestId) return;
            setProcessingRequests(prev => new Map(prev.set(requestId, {
              step: 'starting',
              progress: 0,
              message: 'Starting AI processing...'
            })));
            break;
          }
            
          case 'ai_processing_progress': {
            const requestId = message.requestId;
            if (!requestId) return;
            const data = message.data as AIProcessingProgress;
            setProcessingRequests(prev => new Map(prev.set(requestId, {
              step: data?.step ?? 'processing',
              progress: data?.progress ?? 0,
              message: data?.message ?? 'Processing...',
              ...(data?.estimatedTimeRemaining !== undefined
                ? { estimatedTimeRemaining: data.estimatedTimeRemaining }
                : {}),
            })));
            break;
          }
            
          case 'ai_processing_complete': {
            const requestId = message.requestId;
            if (!requestId) return;
            const data = message.data as AIProcessingResult;
            setProcessingRequests(prev => {
              const newMap = new Map(prev);
              newMap.delete(requestId);
              return newMap;
            });
            setCompletedRequests(prev => new Map(prev.set(requestId, {
              success: true,
              data: data?.data,
              processingTime: data?.processingTime ?? 0,
              provider: data?.provider ?? 'unknown',
              fallbackUsed: data?.fallbackUsed ?? false,
              requestId,
            })));
            break;
          }
            
          case 'ai_processing_error': {
            const requestId = message.requestId;
            if (!requestId) return;
            const data = message.data as { error?: string };
            setProcessingRequests(prev => {
              const newMap = new Map(prev);
              newMap.delete(requestId);
              return newMap;
            });
            setCompletedRequests(prev => new Map(prev.set(requestId, {
              success: false,
              error: data?.error ?? 'Unknown error',
              processingTime: 0,
              provider: 'error',
              fallbackUsed: false,
              requestId,
            })));
            break;
          }
        }
      });

      newSocket.on('joined_household', (data: { householdId: string }) => {
        logger.info(
          'Joined household via WebSocket',
          {
            householdId: data.householdId,
            ...(user?.id ? { userId: user.id } : {}),
          }
        );
      });

      newSocket.on('error', (err: Error) => {
        logger.error('WebSocket client error', err, user?.id ? { userId: user.id } : {});
        setError(err.message || 'WebSocket error occurred');
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect WebSocket');
      logger.error(
        'Failed to establish WebSocket connection',
        error,
        user?.id ? { userId: user.id } : {},
      );
      setError(error.message);
      setIsConnecting(false);
    }
  }, [isConnecting, joinHousehold, user?.id, userData?.household?.id]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, []);

  const requestAIProcessing = useCallback((type: string, context: AIRequestContext): string => {
    if (!socketRef.current?.connected || !user?.id || !userData?.household?.id) {
      throw new Error('WebSocket not connected or user not authenticated');
    }

    const requestId = `ai_request_${Date.now()}_${++requestCounterRef.current}`;
    
    const request: RealTimeAIRequest = {
      requestId,
      userId: user.id,
      householdId: userData.household.id,
      priority: 'medium',
      type: type as RealTimeAIRequest['type'],
      context: context as RealTimeAIRequest['context'],
    };

    socketRef.current.emit('ai_process_request', request as RealTimeAIRequest);

    return requestId;
  }, [user?.id, userData?.household?.id]);

  const clearCompletedRequest = useCallback((requestId: string) => {
    setCompletedRequests(prev => {
      const newMap = new Map(prev);
      newMap.delete(requestId);
      return newMap;
    });
  }, []);

  const clearAllCompletedRequests = useCallback(() => {
    setCompletedRequests(new Map());
  }, []);

  // Auto-connect when user is available
  useEffect(() => {
    if (user?.id && userData?.household?.id && !socketRef.current?.connected) {
      connect();
    }
  }, [user?.id, userData?.household?.id, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    lastMessage,
    processingRequests,
    completedRequests,
    connect,
    disconnect,
    joinHousehold,
    requestAIProcessing,
    clearCompletedRequest,
    clearAllCompletedRequests
  };
}
