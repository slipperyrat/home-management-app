// WebSocket Server for Real-time AI Processing
// This can be easily removed if the WebSocket implementation doesn't work

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse } from '@/lib/api/errors';
import { isAIEnabled } from '@/lib/ai/config/aiConfig';
import { RealTimeAIProcessor } from '@/lib/ai/services/RealTimeAIProcessor';

export interface WebSocketMessage {
  type: 'ai_processing_start' | 'ai_processing_progress' | 'ai_processing_complete' | 'ai_processing_error' | 'ai_suggestion' | 'ai_insight' | 'ai_learning_update';
  data: any;
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
  data?: any;
  error?: string;
  processingTime: number;
  provider: string;
  fallbackUsed: boolean;
}

export class WebSocketManager {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private householdRooms: Map<string, Set<string>> = new Map(); // householdId -> Set of socketIds
  private realTimeProcessor: RealTimeAIProcessor | null = null;

  constructor() {
    this.initializeWebSocket();
  }

  private initializeWebSocket() {
    // WebSocket will be initialized when the server starts
    console.log('🔌 WebSocket Manager initialized');
  }

  public initialize(server: HTTPServer) {
    if (this.io) {
      console.log('⚠️ WebSocket server already initialized');
      return;
    }

    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/api/websocket'
    });

    // Initialize real-time AI processor
    this.realTimeProcessor = new RealTimeAIProcessor(this);

    this.setupEventHandlers();
    console.log('🚀 WebSocket server initialized');
  }

  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Handle user authentication and room joining
      socket.on('join_household', async (data: { userId: string; householdId: string }) => {
        try {
          // Verify user has access to household
          const { user, household, error } = await getUserAndHouseholdData(data.userId);
          
          if (error || !household || household.id !== data.householdId) {
            socket.emit('error', { message: 'Unauthorized access to household' });
            return;
          }

          // Join household room
          socket.join(`household_${data.householdId}`);
          
          // Track user connections
          if (!this.connectedUsers.has(data.userId)) {
            this.connectedUsers.set(data.userId, new Set());
          }
          this.connectedUsers.get(data.userId)!.add(socket.id);

          // Track household rooms
          if (!this.householdRooms.has(data.householdId)) {
            this.householdRooms.set(data.householdId, new Set());
          }
          this.householdRooms.get(data.householdId)!.add(socket.id);

          socket.emit('joined_household', { householdId: data.householdId });
          console.log(`👤 User ${data.userId} joined household ${data.householdId}`);

        } catch (error) {
          console.error('Error joining household:', error);
          socket.emit('error', { message: 'Failed to join household' });
        }
      });

      // Handle AI processing requests
      socket.on('ai_process_request', async (data: {
        type: string;
        context: any;
        requestId: string;
        userId: string;
        householdId: string;
        priority?: string;
      }) => {
        await this.handleAIProcessingRequest(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        this.cleanupUserConnection(socket.id);
      });
    });
  }

  private async handleAIProcessingRequest(socket: any, data: {
    type: string;
    context: any;
    requestId: string;
    userId: string;
    householdId: string;
    priority?: string;
  }) {
    const { type, context, requestId, userId, householdId, priority = 'medium' } = data;

    try {
      // Check if AI is enabled
      if (!isAIEnabled('shoppingSuggestions') && !isAIEnabled('mealPlanning')) {
        socket.emit('ai_processing_error', {
          requestId,
          error: 'AI features are disabled',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Use real-time AI processor if available
      if (this.realTimeProcessor) {
        const result = await this.realTimeProcessor.processRequest({
          type: type as any,
          context,
          requestId,
          userId,
          householdId,
          priority: priority as any
        });

        // Emit completion
        this.emitToUser(userId, {
          type: 'ai_processing_complete',
          data: {
            requestId: result.requestId,
            results: result.data,
            processingTime: result.processingTime,
            provider: result.provider,
            fallbackUsed: result.fallbackUsed
          },
          timestamp: new Date().toISOString(),
          requestId,
          userId,
          householdId
        });
      } else {
        // Fallback to simulation
        await this.simulateAIProcessing(socket, requestId, type, context, userId, householdId);
      }

    } catch (error: any) {
      console.error('AI processing error:', error);
      this.emitToUser(userId, {
        type: 'ai_processing_error',
        data: { requestId, error: error.message },
        timestamp: new Date().toISOString(),
        requestId,
        userId,
        householdId
      });
    }
  }

  private async simulateAIProcessing(
    socket: any,
    requestId: string,
    type: string,
    context: any,
    userId: string,
    householdId: string
  ) {
    const steps = [
      { step: 'analyzing_context', progress: 20, message: 'Analyzing your preferences and context...' },
      { step: 'fetching_data', progress: 40, message: 'Fetching relevant data from your household...' },
      { step: 'ai_processing', progress: 60, message: 'AI is generating personalized suggestions...' },
      { step: 'optimizing_results', progress: 80, message: 'Optimizing and ranking results...' },
      { step: 'finalizing', progress: 100, message: 'Finalizing your personalized recommendations...' }
    ];

    for (const step of steps) {
      // Emit progress update
      this.emitToUser(userId, {
        type: 'ai_processing_progress',
        data: {
          requestId,
          step: step.step,
          progress: step.progress,
          message: step.message,
          estimatedTimeRemaining: (steps.length - steps.indexOf(step)) * 2
        },
        timestamp: new Date().toISOString(),
        requestId,
        userId,
        householdId
      });

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Emit completion with mock results
    const mockResults = this.generateMockResults(type, context);
    
    this.emitToUser(userId, {
      type: 'ai_processing_complete',
      data: {
        requestId,
        results: mockResults,
        processingTime: 5000,
        provider: 'mock',
        fallbackUsed: true
      },
      timestamp: new Date().toISOString(),
      requestId,
      userId,
      householdId
    });
  }

  private generateMockResults(type: string, context: any): any {
    switch (type) {
      case 'shopping_suggestions':
        return {
          suggestions: [
            {
              type: 'frequently_bought',
              title: 'Your Essentials',
              description: 'Items you often buy',
              items: [
                { name: 'Milk', category: 'Dairy', confidence: 90 },
                { name: 'Bread', category: 'Bakery', confidence: 85 }
              ],
              confidence: 88,
              priority: 'high'
            }
          ]
        };
      
      case 'meal_planning':
        return {
          suggestions: [
            {
              name: 'Quick Pasta Primavera',
              description: 'A fresh and colorful pasta dish',
              prepTime: 10,
              cookTime: 15,
              totalTime: 25,
              servings: context.servings || 4,
              difficulty: 'easy',
              cuisine: 'Italian',
              confidence: 80
            }
          ]
        };
      
      default:
        return { message: 'Mock results generated' };
    }
  }

  private emitToUser(userId: string, message: WebSocketMessage) {
    if (!this.io) return;

    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io!.to(socketId).emit('ai_update', message);
      });
    }
  }

  private emitToHousehold(householdId: string, message: WebSocketMessage) {
    if (!this.io) return;

    this.io.to(`household_${householdId}`).emit('ai_update', message);
  }

  private cleanupUserConnection(socketId: string) {
    // Remove from user connections
    for (const [userId, sockets] of this.connectedUsers.entries()) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          this.connectedUsers.delete(userId);
        }
        break;
      }
    }

    // Remove from household rooms
    for (const [householdId, sockets] of this.householdRooms.entries()) {
      if (sockets.has(socketId)) {
        sockets.delete(socketId);
        if (sockets.size === 0) {
          this.householdRooms.delete(householdId);
        }
        break;
      }
    }
  }

  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  public getHouseholdRoomsCount(): number {
    return this.householdRooms.size;
  }

  public isInitialized(): boolean {
    return this.io !== null;
  }
}

// Singleton instance
export const webSocketManager = new WebSocketManager();
