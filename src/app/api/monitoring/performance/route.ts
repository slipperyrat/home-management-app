import { NextRequest } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { performanceMonitor } from '@/lib/monitoring/PerformanceMonitor';

export async function GET(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      const type = searchParams.get('type') || 'overview';
      const timeWindow = searchParams.get('timeWindow')
        ? parseInt(searchParams.get('timeWindow') as string, 10)
        : 3600000;

      let data: any = {};

      switch (type) {
        case 'overview':
          data = {
            aiMetrics: performanceMonitor.getAIPerformanceMetrics(timeWindow),
            websocketMetrics: performanceMonitor.getWebSocketMetrics(timeWindow),
            systemMetrics: performanceMonitor.getSystemMetrics(),
            totalMetrics: performanceMonitor.getMetricsCount(),
            isEnabled: performanceMonitor.isMonitoringEnabled(),
          };
          break;
        case 'ai':
          data = performanceMonitor.getAIPerformanceMetrics(timeWindow);
          break;
        case 'websocket':
          data = performanceMonitor.getWebSocketMetrics(timeWindow);
          break;
        case 'system':
          data = performanceMonitor.getSystemMetrics();
          break;
        case 'raw':
          data = performanceMonitor.getMetrics(timeWindow);
          break;
        default:
          return createErrorResponse('Invalid type parameter', 400);
      }

      return createSuccessResponse(data, 'Performance monitoring data retrieved successfully');
    } catch (error) {
      return handleApiError(error, {
        route: '/api/monitoring/performance',
        method: 'GET',
        userId: user?.id ?? '',
      });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
  });
}

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return createErrorResponse('User not authenticated', 401);
      }

      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const body = await req.json();
      const { action, metric } = body;

      switch (action) {
        case 'clear_metrics':
          performanceMonitor.clearMetrics();
          return createSuccessResponse({}, 'Performance metrics cleared successfully');
        case 'enable_monitoring':
          performanceMonitor.enable();
          return createSuccessResponse({}, 'Performance monitoring enabled');
        case 'disable_monitoring':
          performanceMonitor.disable();
          return createSuccessResponse({}, 'Performance monitoring disabled');
        case 'record_metric':
          if (!metric) {
            return createErrorResponse('Metric data is required', 400);
          }

          performanceMonitor.recordMetric({
            ...metric,
            userId: user.id,
            householdId: household.id,
          });

          return createSuccessResponse({}, 'Metric recorded successfully');
        default:
          return createErrorResponse('Unknown action', 400);
      }
    } catch (error) {
      return handleApiError(error, {
        route: '/api/monitoring/performance',
        method: 'POST',
        userId: user?.id ?? '',
      });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api',
  });
}


