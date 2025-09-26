// Real-time AI Processing API Route
// This can be easily removed if the real-time processing doesn't work

import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { RealTimeAIProcessor, RealTimeAIRequest } from '@/lib/ai/services/RealTimeAIProcessor';
import { webSocketManager } from '@/lib/websocket/WebSocketServer';
import { isAIEnabled } from '@/lib/ai/config/aiConfig';

// Initialize the real-time AI processor
const realTimeProcessor = new RealTimeAIProcessor(webSocketManager);

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 POST: Real-time AI processing request for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const body = await req.json();
      const { type, context, priority = 'medium' } = body;

      // Validate request
      if (!type || !context) {
        return createErrorResponse('Type and context are required', 400);
      }

      // Check if AI is enabled for the requested type
      if (type === 'shopping_suggestions' && !isAIEnabled('shoppingSuggestions')) {
        return createErrorResponse('Shopping suggestions AI is disabled', 403);
      }

      if (type === 'meal_planning' && !isAIEnabled('mealPlanning')) {
        return createErrorResponse('Meal planning AI is disabled', 403);
      }

      // Generate request ID
      const requestId = `realtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create real-time AI request
      const aiRequest: RealTimeAIRequest = {
        type,
        context,
        requestId,
        userId: user.id,
        householdId: household.id,
        priority: priority as 'low' | 'medium' | 'high' | 'urgent'
      };

      // Process the request
      const result = await realTimeProcessor.processRequest(aiRequest);

      console.log(`✅ Real-time AI processing completed for request ${requestId}`);

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
      return handleApiError(error, { route: '/api/ai/realtime', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('🚀 GET: Real-time AI processing status for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
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
      return handleApiError(error, { route: '/api/ai/realtime', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}
