import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient } from '@/lib/api/database';
import { logger } from '@/lib/logging/logger';
import { apiRequestCounter, apiLatencyHistogram } from '@/app/metrics/router';

const analyticsEventSchema = z.object({
  event: z.string().min(1),
  timestamp: z.union([z.string(), z.number(), z.date()]),
  properties: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  householdId: z.string().uuid().optional()
});

function normalizeTimestamp(timestamp: string | number | Date): string {
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  if (typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid timestamp format');
  }

  return parsed.toISOString();
}

export async function POST(request: NextRequest) {
  const start = performance.now();
  let status = 200;
  return withAPISecurity(
    request,
    async (req, user) => {
      try {
        const payload = await req.json();
        const validated = analyticsEventSchema.parse(payload);

        const supabase = getDatabaseClient();
        const timestamp = normalizeTimestamp(validated.timestamp);

        const { error } = await supabase.from('analytics_events').insert({
          event_type: validated.event,
          properties: validated.properties ?? {},
          user_id: user.id,
          household_id: validated.householdId ?? null,
          timestamp,
          metadata: validated.metadata ?? {},
        });

        if (error) {
          logger.error('Failed to store analytics event', error, {
            userId: user.id,
            analyticsEvent: validated.event,
            securityEvent: true,
            severity: 'medium',
          });

          return NextResponse.json({ error: 'Failed to store event' }, { status: 500 });
        }

        logger.info('Analytics event stored', {
          userId: user.id,
          householdId: validated.householdId,
          analyticsEvent: validated.event,
        });

        return NextResponse.json({ success: true });
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.warn('Analytics event validation failed', {
            userId: user?.id,
            errors: error.flatten().fieldErrors,
          });

          return NextResponse.json({
            error: 'Invalid analytics payload',
            details: error.flatten().fieldErrors,
          }, { status: 400 });
        }

        logger.error('Error processing analytics event', error as Error, {
          url: req.url,
          userId: user?.id,
          securityEvent: true,
          severity: 'medium',
        });

        return NextResponse.json({ error: 'Failed to process event' }, { status: 500 });
      } finally {
        const duration = performance.now() - start;
        apiRequestCounter.inc({ route: '/api/analytics/track', method: 'POST', status: String(status) });
        apiLatencyHistogram.observe({ route: '/api/analytics/track', method: 'POST' }, duration);
      }
    },
    {
      requireAuth: true,
      requireCSRF: false,
      rateLimitConfig: 'analytics',
      allowedMethods: ['POST'],
    }
  );
}
