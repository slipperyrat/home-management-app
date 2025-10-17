import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { getPendingConfirmations } from '@/lib/server/getPendingConfirmations';
import { getUserAndHouseholdData } from '@/lib/api/database';
import { logger } from '@/lib/logging/logger';

export async function GET(req: NextRequest) {
  return withAPISecurity(req, async (_request, user) => {
    try {
      if (!user?.id) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      const { household, error: userError } = await getUserAndHouseholdData(user.id);

      if (userError || !household) {
        return NextResponse.json({ error: 'User not found or no household' }, { status: 404 });
      }

      const result = await getPendingConfirmations(household.id);

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      logger.info('Pending confirmations retrieved', {
        userId: user.id,
        householdId: household.id,
        pendingCount: result.count,
      });

      return NextResponse.json({ 
        ok: true, 
        pendingItems: result.pendingItems,
        count: result.count,
      });
    } catch (error: unknown) {
      logger.error('Error in pending-confirmations API', error instanceof Error ? error : new Error(String(error)), {
        userId: user?.id ?? 'unknown',
      });
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Internal server error',
      }, { status: error instanceof Error && 'status' in error ? Number((error as { status?: number }).status) || 500 : 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'shopping',
  });
}
