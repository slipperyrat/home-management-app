import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity } from '@/lib/security/apiProtection';
import { createCSRFResponse } from '@/lib/security/csrf';

export async function GET(request: NextRequest) {
  return withAPISecurity(
    request,
    async (_req, user, context) => {
      if (!user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const csrfInfo = createCSRFResponse(user.id);
      return NextResponse.json({ ...csrfInfo, requestToken: context.csrfToken ?? null });
    },
    {
      requireAuth: true,
      requireCSRF: false,
      rateLimitConfig: 'api',
    },
  );
}
