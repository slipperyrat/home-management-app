import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

// Stripe product IDs for your plans
export const STRIPE_PRODUCTS = {
  PRO: process.env.STRIPE_PRO_PRODUCT_ID || 'prod_pro_plan',
  PRO_PLUS: process.env.STRIPE_PRO_PLUS_PRODUCT_ID || 'prod_pro_plus_plan',
} as const;

// Stripe price IDs for your plans
export const STRIPE_PRICES = {
  PRO: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly',
  PRO_PLUS: process.env.STRIPE_PRO_PLUS_PRICE_ID || 'price_pro_plus_monthly',
} as const;

export const PLAN_TO_STRIPE_PRICE: Record<string, string> = {
  pro: STRIPE_PRICES.PRO,
  pro_plus: STRIPE_PRICES.PRO_PLUS,
};

export const STRIPE_PRICE_TO_PLAN: Record<string, string> = {
  [STRIPE_PRICES.PRO]: 'pro',
  [STRIPE_PRICES.PRO_PLUS]: 'pro_plus',
};

/**
 * Create a Stripe checkout session for plan upgrade
 */
export async function createCheckoutSession({
  customerId,
  priceId,
  successUrl,
  cancelUrl,
  metadata = {},
}: {
  customerId?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    subscription_data: {
      metadata,
    },
  };

  if (customerId) {
    sessionParams.customer = customerId;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return session;
}

/**
 * Create a Stripe customer
 */
export async function createCustomer({
  email,
  name,
  metadata = {},
}: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}) {
  const params: Stripe.CustomerCreateParams = {
    email,
    metadata,
  };

  if (name) {
    params.name = name;
  }

  const customer = await stripe.customers.create(params);

  return customer;
}

/**
 * Get customer by ID
 */
export async function getCustomer(customerId: string) {
  return await stripe.customers.retrieve(customerId);
}

/**
 * Get subscription by ID
 */
export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Update subscription
 */
export async function updateSubscription(
  subscriptionId: string,
  updates: {
    items?: Array<{ id: string; price: string }>;
    metadata?: Record<string, string>;
  }
) {
  return await stripe.subscriptions.update(subscriptionId, updates);
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}
