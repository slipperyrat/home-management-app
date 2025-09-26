// Security Dashboard API Route
// Provides security metrics and monitoring data

import { NextRequest, NextResponse } from "next/server";
import { withAdminAPISecurity } from "@/lib/security/apiProtection";
import { securityMonitor } from "@/lib/security/monitoring";

export async function GET(request: NextRequest) {
  return withAdminAPISecurity(request, async (req, user) => {
    try {
      // Get security metrics
      const metrics = securityMonitor.getSecurityMetrics();
      
      // Get recent events
      const recentEvents = securityMonitor.getRecentEvents(100);
      
      // Get events by severity
      const criticalEvents = securityMonitor.getEventsBySeverity('critical', 20);
      const highEvents = securityMonitor.getEventsBySeverity('high', 20);
      
      // Get events by type
      const rateLimitEvents = securityMonitor.getEventsByType('rate_limit_exceeded', 20);
      const csrfEvents = securityMonitor.getEventsByType('csrf_failure', 20);
      const unauthorizedEvents = securityMonitor.getEventsByType('unauthorized_access', 20);
      
      return NextResponse.json({
        success: true,
        data: {
          metrics,
          recentEvents,
          eventsBySeverity: {
            critical: criticalEvents,
            high: highEvents
          },
          eventsByType: {
            rateLimit: rateLimitEvents,
            csrf: csrfEvents,
            unauthorized: unauthorizedEvents
          }
        }
      });
    } catch (error) {
      console.error('Security dashboard error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch security data' },
        { status: 500 }
      );
    }
  });
}
