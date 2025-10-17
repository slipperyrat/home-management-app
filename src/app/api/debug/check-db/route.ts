import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getDatabaseClient } from '@/lib/api/database';
import { logger } from '@/lib/logging/logger';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (_req, user) => {
    try {
      if (!user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const userId = user.id;
      logger.info('Database check request', { userId });

      const supabase = getDatabaseClient();

      const { data: household, error: householdError } = await supabase
        .from('households')
        .select('id, name')
        .eq('id', userId)
        .single();

      if (householdError || !household) {
        return NextResponse.json({ error: 'Household not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        summary: {
          household,
        },
      });
    } catch (error) {
      logger.error('Database check failed', error instanceof Error ? error : new Error(String(error)));
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  });
}
