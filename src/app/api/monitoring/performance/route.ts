// Performance Monitoring API Route
// This can be easily removed if the performance monitoring doesn't work

import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api/errors';
import { performanceMonitor } from '@/lib/monitoring/PerformanceMonitor';

export async function GET(request: NextRequest) {
  // Re-enable monitoring API for performance tracking
  try {
    const monitoringService = MonitoringService.getInstance();
    const metrics = monitoringService.getMetrics();
    const events = monitoringService.getEvents();
    const errors = monitoringService.getErrors();

    return NextResponse.json({
      metrics,
      events,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get monitoring data', error as Error);
    return NextResponse.json(
      { error: 'Failed to retrieve monitoring data' },
      { status: 500 }
    );
  }
  
  // return withAPISecurity(request, async (req, user) => {
  //   try {
  //     console.log('📊 GET: Performance monitoring data for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const { searchParams } = new URL(req.url);
      const type = searchParams.get('type') || 'overview';
      const timeWindow = searchParams.get('timeWindow') ? parseInt(searchParams.get('timeWindow')!) : 3600000; // 1 hour default

      let data: any = {};

      switch (type) {
        case 'overview':
          data = {
            aiMetrics: performanceMonitor.getAIPerformanceMetrics(timeWindow),
            websocketMetrics: performanceMonitor.getWebSocketMetrics(timeWindow),
            systemMetrics: performanceMonitor.getSystemMetrics(),
            totalMetrics: performanceMonitor.getMetricsCount(),
            isEnabled: performanceMonitor.isMonitoringEnabled()
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
      return handleApiError(error, { route: '/api/monitoring/performance', method: 'GET', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}

export async function POST(request: NextRequest) {
  // Re-enable monitoring API for performance tracking
  return withAPISecurity(request, async (req, user) => {
    try {
      console.log('📊 POST: Performance monitoring data for user:', user.id);
      
      const body = await req.json();
      const { metrics, events, errors } = body;

      // Validate input data
      if (!metrics && !events && !errors) {
        return NextResponse.json(
          { error: 'No monitoring data provided' },
          { status: 400 }
        );
      }

      const monitoringService = MonitoringService.getInstance();

      // Store metrics
      if (metrics && Array.isArray(metrics)) {
        metrics.forEach((metric: any) => {
          monitoringService.addMetric({
            name: metric.name,
            value: metric.value,
            timestamp: metric.timestamp || new Date().toISOString(),
            metadata: metric.metadata || {},
          });
        });
      }

      // Store events
      if (events && Array.isArray(events)) {
        events.forEach((event: any) => {
          monitoringService.addEvent({
            type: event.type,
            data: event.data || {},
            timestamp: event.timestamp || new Date().toISOString(),
          });
        });
      }

      // Store errors
      if (errors && Array.isArray(errors)) {
        errors.forEach((error: any) => {
          monitoringService.addError({
            message: error.message,
            stack: error.stack,
            timestamp: error.timestamp || new Date().toISOString(),
            metadata: error.metadata || {},
          });
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Monitoring data stored successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error processing monitoring data:', error);
      return handleApiError(error as Error, 'Failed to process monitoring data');
    }
  });
}
  
  // return withAPISecurity(request, async (req, user) => {
  //   try {
  //     console.log('📊 POST: Performance monitoring action for user:', user.id);

      // Get user and household data
      const { user: userData, household, error: userError } = await getUserAndHouseholdData(user.id);
      
      if (userError || !household) {
        return createErrorResponse('User not found or no household', 404);
      }

      const body = await req.json();
      const { action } = body;

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
          const { metric } = body;
          if (!metric) {
            return createErrorResponse('Metric data is required', 400);
          }
          
          performanceMonitor.recordMetric({
            ...metric,
            userId: user.id,
            householdId: household.id
          });
          
          return createSuccessResponse({}, 'Metric recorded successfully');

        default:
          return createErrorResponse('Unknown action', 400);
      }

    } catch (error) {
      return handleApiError(error, { route: '/api/monitoring/performance', method: 'POST', userId: user.id });
    }
  }, {
    requireAuth: true,
    requireCSRF: false, // Monitoring endpoint doesn't need CSRF protection
    rateLimitConfig: 'api'
  });
}
