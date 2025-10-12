// WebSocket API Route for Real-time AI Processing
// This can be easily removed if the WebSocket implementation doesn't work

import type { NextRequest } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { webSocketManager } from '@/lib/websocket/WebSocketServer';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      // Check if WebSocket is initialized
      if (!webSocketManager.isInitialized()) {
        return createErrorResponse('WebSocket server not initialized', 503);
      }

      // Get WebSocket status
      const status = {
        initialized: webSocketManager.isInitialized(),
        connectedUsers: webSocketManager.getConnectedUsersCount(),
        householdRooms: webSocketManager.getHouseholdRoomsCount(),
        websocketUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/websocket`
      };

      return createSuccessResponse(status, 'WebSocket status retrieved successfully');

    } catch (error) {
      return handleApiError(error, { route: '/api/websocket', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req, user) => {
    try {
      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const body = await req.json();
      const { action } = body as { action?: string };

      switch (action) {
        case 'test_connection':
          return createSuccessResponse({
            connected: webSocketManager.isInitialized(),
            message: 'WebSocket connection test completed'
          }, 'Connection test completed');

        case 'get_status':
          return createSuccessResponse({
            initialized: webSocketManager.isInitialized(),
            connectedUsers: webSocketManager.getConnectedUsersCount(),
            householdRooms: webSocketManager.getHouseholdRoomsCount()
          }, 'WebSocket status retrieved');

        default:
          return createErrorResponse('Unknown action', 400);
      }

    } catch (error) {
      return handleApiError(error, { route: '/api/websocket', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
