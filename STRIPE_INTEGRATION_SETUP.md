# Stripe Integration Setup Guide

This guide will help you set up Stripe integration for your home management app's subscription system.

## Prerequisites

1. Stripe account (sign up at https://stripe.com)
2. Your app running locally or deployed

## Step 1: Create Stripe Products and Prices

1. Log into your Stripe Dashboard
2. Go to Products → Create Product
3. Create two products:

### Pro Plan Product
- **Name**: Home Management Pro
- **Description**: Pro plan with finance features and advanced analytics
- **Pricing**: $8.99/month (recurring)
- **Note the Product ID**: `prod_xxxxx`

### Pro+ Plan Product
- **Name**: Home Management Pro+
- **Description**: Pro+ plan with multi-household and admin tools
- **Pricing**: $14.99/month (recurring)
- **Note the Product ID**: `prod_xxxxx`

4. For each product, note down:
   - Product ID (starts with `prod_`)
   - Price ID (starts with `price_`)

## Step 2: Set Up Webhooks

1. In Stripe Dashboard, go to Developers → Webhooks
2. Click "Add endpoint"
3. Set endpoint URL to: `https://yourdomain.com/api/stripe/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Note the webhook secret (starts with `whsec_`)

## Step 3: Environment Variables

Add these environment variables to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Product/Price IDs
STRIPE_PRO_PRODUCT_ID=prod_your_pro_product_id
STRIPE_PRO_PRICE_ID=price_your_pro_price_id
STRIPE_PRO_PLUS_PRODUCT_ID=prod_your_pro_plus_product_id
STRIPE_PRO_PLUS_PRICE_ID=price_your_pro_plus_price_id

# App URL (for webhook callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 4: Database Setup

Run the database migration to add Stripe columns:

```sql
-- Run this in your Supabase SQL editor
\i supabase/add_stripe_columns.sql
```

## Step 5: Test the Integration

1. Start your development server: `npm run dev`
2. Go to `/upgrade` page
3. Click "Upgrade to Pro" or "Upgrade to Pro+"
4. Complete the Stripe checkout process
5. Verify the webhook updates your database

## Step 6: Production Setup

1. Switch to live Stripe keys (remove `_test_` from keys)
2. Update webhook URL to production domain
3. Test with real payment methods
4. Monitor webhook events in Stripe Dashboard

## Features Included

✅ **Checkout Sessions**: Secure payment processing
✅ **Webhook Handling**: Automatic plan updates
✅ **Billing Portal**: Customer self-service
✅ **Database Integration**: Plan status tracking
✅ **Error Handling**: Comprehensive error management
✅ **Analytics**: Usage tracking and metrics

## Troubleshooting

### Webhook Issues
- Check webhook URL is accessible
- Verify webhook secret matches
- Check Stripe Dashboard for failed events

### Database Issues
- Ensure RLS policies are correct
- Verify user has proper permissions
- Check household_id relationships

### Payment Issues
- Verify Stripe keys are correct
- Check product/price IDs match
- Ensure webhook events are processed

## Support

For issues with this integration:
1. Check Stripe Dashboard for error logs
2. Review application logs for webhook processing
3. Verify database schema matches expected structure
4. Test with Stripe test cards first

## Security Notes

- Never commit Stripe keys to version control
- Use environment variables for all sensitive data
- Implement proper error handling for payment failures
- Monitor for suspicious activity in Stripe Dashboard
