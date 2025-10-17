// Real-time AI Processing API Route
// This can be easily removed if the real-time processing doesn't work

import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { RealTimeAIProcessor } from '@/lib/ai/services/RealTimeAIProcessor';
import type { RealTimeAIRequest, RealTimeRequestBody } from '@/types/websocket';
import { webSocketManager } from '@/lib/websocket/WebSocketServer';
import { isAIEnabled } from '@/lib/ai/config/aiConfig';
import { logger } from '@/lib/logging/logger';

// Initialize the real-time AI processor
const realTimeProcessor = new RealTimeAIProcessor(webSocketManager);

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user) {
        logger.warn('Real-time AI processing request without authenticated user');
        return createErrorResponse('Unauthorized', 401);
      }

      logger.info('Real-time AI processing request received', { userId: user.id });

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const body = await req.json();
      const parsedBody = body as RealTimeRequestBody;

      if (!parsedBody?.type || !parsedBody?.context) {
        return createErrorResponse('Type and context are required', 400);
      }

      const priority = parsedBody.priority ?? 'medium';

      // Generate request ID
      const requestId = `realtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      let aiRequest: RealTimeAIRequest;
      switch (parsedBody.type) {
        case 'shopping_suggestions':
          aiRequest = {
            type: 'shopping_suggestions',
            context: parsedBody.context,
            requestId,
            userId: user.id,
            householdId: household.id,
            priority,
          };
          break;
        case 'meal_planning':
          aiRequest = {
            type: 'meal_planning',
            context: parsedBody.context,
            requestId,
            userId: user.id,
            householdId: household.id,
            priority,
          };
          break;
        case 'chore_assignment':
          aiRequest = {
            type: 'chore_assignment',
            context: parsedBody.context,
            requestId,
            userId: user.id,
            householdId: household.id,
            priority,
          };
          break;
        case 'email_processing':
          aiRequest = {
            type: 'email_processing',
            context: parsedBody.context,
            requestId,
            userId: user.id,
            householdId: household.id,
            priority,
          };
          break;
        default:
          return createErrorResponse('Unsupported AI request type', 400);
      }

      const { type } = aiRequest;

      // Check if AI is enabled for the requested type
      if (type === 'shopping_suggestions' && !isAIEnabled('shoppingSuggestions')) {
        return createErrorResponse('Shopping suggestions AI is disabled', 403);
      }

      if (type === 'meal_planning' && !isAIEnabled('mealPlanning')) {
        return createErrorResponse('Meal planning AI is disabled', 403);
      }

      // Process the request
      const result = await realTimeProcessor.processRequest(aiRequest);

      logger.info('Real-time AI processing completed', {
        requestId,
        userId: user.id,
        householdId: household.id,
        provider: result.provider,
        success: result.success,
        processingTime: result.processingTime,
      });

      return createSuccessResponse({
        requestId: result.requestId,
        success: result.success,
        data: result.data,
        error: result.error,
        processingTime: result.processingTime,
        provider: result.provider,
        fallbackUsed: result.fallbackUsed
      }, 'Real-time AI processing completed successfully');

    } catch (error) {
      const errorContext: {
        route: string;
        method: string;
        userId?: string;
      } = {
        route: '/api/ai/realtime',
        method: 'POST'
      };

      if (user?.id) {
        errorContext.userId = user.id;
      }

      return handleApiError(error, errorContext);
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user) {
        logger.warn('Real-time AI status request without authenticated user');
        return createErrorResponse('Unauthorized', 401);
      }

      logger.info('Real-time AI status request received', { userId: user.id });

      // Get user and household data
      const { household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      const action = searchParams.get('action') || 'status';

      switch (action) {
        case 'status':
          return createSuccessResponse({
            isWebSocketConnected: webSocketManager.isInitialized(),
            connectedUsers: webSocketManager.getConnectedUsersCount(),
            householdRooms: webSocketManager.getHouseholdRoomsCount(),
            processingQueue: realTimeProcessor.getQueueSize(),
            queueItems: realTimeProcessor.getProcessingQueue().map(req => ({
              requestId: req.requestId,
              type: req.type,
              priority: req.priority,
              userId: req.userId,
              householdId: req.householdId
            }))
          }, 'Real-time AI processing status retrieved');

        case 'queue':
          return createSuccessResponse({
            queueSize: realTimeProcessor.getQueueSize(),
            queueItems: realTimeProcessor.getProcessingQueue().map(req => ({
              requestId: req.requestId,
              type: req.type,
              priority: req.priority,
              userId: req.userId,
              householdId: req.householdId
            }))
          }, 'Processing queue retrieved');

        case 'clear_queue':
          realTimeProcessor.clearQueue();
          return createSuccessResponse({}, 'Processing queue cleared');

        default:
          return createErrorResponse('Unknown action', 400);
      }

    } catch (error) {
      const errorContext: {
        route: string;
        method: string;
        userId?: string;
      } = {
        route: '/api/ai/realtime',
        method: 'GET'
      };

      if (user?.id) {
        errorContext.userId = user.id;
      }

      return handleApiError(error, errorContext);
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}
