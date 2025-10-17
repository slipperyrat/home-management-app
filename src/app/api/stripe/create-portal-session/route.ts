import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { createBillingPortalSession } from '@/lib/stripe';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (_req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      const supabase = getSupabaseAdminClient();

      // Get user's household
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          household_id,
          households!inner(
            id,
            stripe_customer_id
          )
        `)
        .eq('id', user.id)
        .single();

      if (userError || !userData || 'code' in userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const household = userData.households;
      if (!household) {
        return NextResponse.json({ error: 'Household not found' }, { status: 404 });
      }

      if (!household.stripe_customer_id) {
        return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
      }

      // Create billing portal session
      const session = await createBillingPortalSession({
        customerId: household.stripe_customer_id,
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/plan`,
      });

      return NextResponse.json({ 
        success: true, 
        url: session.url 
      });
    } catch (error) {
      console.error('Error creating portal session:', error);
      return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
