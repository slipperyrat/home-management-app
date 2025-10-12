import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import { getSupabaseAdminClient } from '@/lib/server/supabaseAdmin';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const priceId = session.line_items?.data[0]?.price?.id;

        if (!priceId) {
          console.error('No price ID found in checkout session');
          break;
        }

        // Get the plan from the price ID
        const plan = priceId === process.env.STRIPE_PRO_PRICE_ID ? 'pro' : 
                    priceId === process.env.STRIPE_PRO_PLUS_PRICE_ID ? 'pro_plus' : 'free';

        // Update household plan in database
        const { error } = await supabase
          .from('households')
          .update({ 
            plan,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Error updating household plan:', error);
        } else {
          console.log(`Successfully updated household to ${plan} plan`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price?.id;

        if (!priceId) {
          console.error('No price ID found in subscription update');
          break;
        }

        const plan = priceId === process.env.STRIPE_PRO_PRICE_ID ? 'pro' : 
                    priceId === process.env.STRIPE_PRO_PLUS_PRICE_ID ? 'pro_plus' : 'free';

        // Update household plan
        const { error } = await supabase
          .from('households')
          .update({ 
            plan,
            stripe_subscription_id: subscription.id,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Error updating subscription:', error);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        // Downgrade to free plan
        const { error } = await supabase
          .from('households')
          .update({ 
            plan: 'free',
            stripe_subscription_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', customerId);

        if (error) {
          console.error('Error downgrading subscription:', error);
        } else {
          console.log('Successfully downgraded household to free plan');
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;

        // You might want to send an email notification here
        console.log(`Payment failed for customer ${customerId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
