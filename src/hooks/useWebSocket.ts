// WebSocket Client Hook for Real-time AI Processing
// This can be easily removed if the WebSocket implementation doesn't work

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useUser } from '@clerk/nextjs';
import { useUserData } from './useUserData';
import { logger } from '@/lib/logging/logger';

type WebSocketPayload = WebSocketMessage['data'];

interface BaseWebSocketMessage<TType extends WebSocketMessage['type'], TData> {
  type: TType;
  data: TData;
  timestamp: string;
  requestId: string;
  userId: string;
  householdId: string;
}

type AIProcessingStartMessage = BaseWebSocketMessage<'ai_processing_start', Record<string, never>>;
type AIProcessingProgressMessage = BaseWebSocketMessage<'ai_processing_progress', AIProcessingProgress>;
type AIProcessingCompleteMessage = BaseWebSocketMessage<
  'ai_processing_complete',
  AIProcessingResult & { processingTime: number; provider: string; fallbackUsed: boolean }
>;
type AIProcessingErrorMessage = BaseWebSocketMessage<'ai_processing_error', { error: string }>;
type AISuggestionMessage = BaseWebSocketMessage<'ai_suggestion', Record<string, unknown>>;
type AIInsightMessage = BaseWebSocketMessage<'ai_insight', Record<string, unknown>>;
type AILearningUpdateMessage = BaseWebSocketMessage<'ai_learning_update', Record<string, unknown>>;

export type WebSocketMessage =
  | AIProcessingStartMessage
  | AIProcessingProgressMessage
  | AIProcessingCompleteMessage
  | AIProcessingErrorMessage
  | AISuggestionMessage
  | AIInsightMessage
  | AILearningUpdateMessage;

type AIRequestContext = Record<string, unknown>;

export interface WebSocketMessage {
  type: 'ai_processing_start' | 'ai_processing_progress' | 'ai_processing_complete' | 'ai_processing_error' | 'ai_suggestion' | 'ai_insight' | 'ai_learning_update';
  data: WebSocketPayload;
  timestamp: string;
  requestId: string;
  userId: string;
  householdId: string;
}

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
}

export interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
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
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [processingRequests, setProcessingRequests] = useState<Map<string, AIProcessingProgress>>(new Map());
  const [completedRequests, setCompletedRequests] = useState<Map<string, AIProcessingResult>>(new Map());
  
  const socketRef = useRef<Socket | null>(null);
  const requestCounterRef = useRef(0);

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
        logger.info('WebSocket connected', { userId: user?.id });
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
        logger.error('WebSocket connection error', err, { userId: user?.id });
        setError(err.message);
        setIsConnecting(false);
      });

      newSocket.on('ai_update', (message: WebSocketMessage) => {
        logger.debug('Received AI update', { message });
        setLastMessage(message);
        
        // Handle different message types
        switch (message.type) {
          case 'ai_processing_start':
            setProcessingRequests(prev => new Map(prev.set(message.requestId, {
              step: 'starting',
              progress: 0,
              message: 'Starting AI processing...'
            })));
            break;
            
          case 'ai_processing_progress':
            setProcessingRequests(prev => new Map(prev.set(message.requestId, {
              step: message.data.step,
              progress: message.data.progress,
              message: message.data.message,
              estimatedTimeRemaining: message.data.estimatedTimeRemaining
            })));
            break;
            
          case 'ai_processing_complete':
            setProcessingRequests(prev => {
              const newMap = new Map(prev);
              newMap.delete(message.requestId);
              return newMap;
            });
            setCompletedRequests(prev => new Map(prev.set(message.requestId, {
              success: true,
              data: message.data.results,
              processingTime: message.data.processingTime,
              provider: message.data.provider,
              fallbackUsed: message.data.fallbackUsed
            })));
            break;
            
          case 'ai_processing_error':
            setProcessingRequests(prev => {
              const newMap = new Map(prev);
              newMap.delete(message.requestId);
              return newMap;
            });
            setCompletedRequests(prev => new Map(prev.set(message.requestId, {
              success: false,
              error: message.data.error,
              processingTime: 0,
              provider: 'error',
              fallbackUsed: false
            })));
            break;
        }
      });

      newSocket.on('joined_household', (data: { householdId: string }) => {
        logger.info('Joined household via WebSocket', { householdId: data.householdId, userId: user?.id });
      });

      newSocket.on('error', (err: Error) => {
        logger.error('WebSocket client error', err, { userId: user?.id });
        setError(err.message || 'WebSocket error occurred');
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to connect WebSocket');
      logger.error('Failed to establish WebSocket connection', error, { userId: user?.id });
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

  const joinHousehold = useCallback((householdId: string) => {
    if (socketRef.current?.connected && user?.id) {
      socketRef.current.emit('join_household', {
        userId: user.id,
        householdId
      });
    }
  }, [user?.id]);

  const requestAIProcessing = useCallback((type: string, context: AIRequestContext): string => {
    if (!socketRef.current?.connected || !user?.id || !userData?.household?.id) {
      throw new Error('WebSocket not connected or user not authenticated');
    }

    const requestId = `ai_request_${Date.now()}_${++requestCounterRef.current}`;
    
    socketRef.current.emit('ai_process_request', {
      type,
      context,
      requestId,
      userId: user.id,
      householdId: userData.household.id
    });

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
