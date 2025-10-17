import { NextRequest, NextResponse } from 'next/server';
import { withAPISecurity, RequestUser } from '@/lib/security/apiProtection';
import { createCheckoutSession, createCustomer, PLAN_TO_STRIPE_PRICE } from '@/lib/stripe';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';

export async function POST(request: NextRequest) {
  return withAPISecurity(request, async (req: NextRequest, user: RequestUser | null) => {
    try {
      if (!user?.id) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
      }
      const { plan } = await req.json();

      if (!plan || !['pro', 'pro_plus'].includes(plan)) {
        return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
      }

      const supabase = getSupabaseAdminClient();

      // Get user's household
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          household_id,
          households!inner(
            id,
            plan,
            stripe_customer_id
          )
        `)
        .eq('id', user.id)
        .single();

      if (userError || !userData || 'code' in userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const typedUserData = userData as unknown as {
        id: string;
        email: string | null;
        name: string | null;
        household_id: string | null;
        households: {
          id: string;
          plan: string | null;
          stripe_customer_id: string | null;
        } | null;
      };

      const household = typedUserData.households;
      if (!household) {
        return NextResponse.json({ error: 'Household not found' }, { status: 404 });
      }
      const priceId = PLAN_TO_STRIPE_PRICE[plan];

      if (!priceId) {
        return NextResponse.json({ error: 'Price not found for plan' }, { status: 400 });
      }

      // Create or get Stripe customer
      let customerId = household.stripe_customer_id;
      
      if (!customerId) {
        const customer = await createCustomer({
          email: typedUserData.email ?? '',
          ...(typedUserData.name ? { name: typedUserData.name } : {}),
          metadata: {
            household_id: household.id,
            user_id: user.id,
          },
        });
        customerId = customer.id;

        // Update household with customer ID
        await supabase
          .from('households')
          .update({ stripe_customer_id: customerId })
          .eq('id', household.id);
      }

      // Create checkout session
      const session = await createCheckoutSession({
        customerId,
        priceId,
        successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/upgrade/cancelled`,
        metadata: {
          household_id: household.id,
          user_id: user.id,
          plan,
        },
      });

      return NextResponse.json({ 
        success: true, 
        sessionId: session.id,
        url: session.url 
      });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
  }, {
    requireAuth: true,
    requireCSRF: true,
    rateLimitConfig: 'api'
  });
}
