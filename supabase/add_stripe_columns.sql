-- Add Stripe integration columns to households table
-- This migration adds support for Stripe customer and subscription management

-- Add Stripe-related columns to households table
ALTER TABLE households 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN DEFAULT false;

-- Add indexes for Stripe queries
CREATE INDEX IF NOT EXISTS idx_households_stripe_customer_id ON households(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_households_stripe_subscription_id ON households(stripe_subscription_id);

-- Add comments for documentation
COMMENT ON COLUMN households.stripe_customer_id IS 'Stripe customer ID for billing management';
COMMENT ON COLUMN households.stripe_subscription_id IS 'Stripe subscription ID for plan management';
COMMENT ON COLUMN households.subscription_status IS 'Current subscription status (active, canceled, past_due, etc.)';
COMMENT ON COLUMN households.subscription_current_period_end IS 'When the current billing period ends';
COMMENT ON COLUMN households.subscription_cancel_at_period_end IS 'Whether subscription will cancel at period end';

-- Update the plan constraint to ensure valid values
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'households_plan_check'
    ) THEN
        ALTER TABLE households DROP CONSTRAINT households_plan_check;
    END IF;
    
    -- Add new constraint for the three-tier structure
    ALTER TABLE households ADD CONSTRAINT households_plan_check 
    CHECK (plan IN ('free', 'pro', 'pro_plus'));
END $$;

-- Create a function to get subscription status
CREATE OR REPLACE FUNCTION get_subscription_status(household_id_param UUID)
RETURNS TABLE(
    plan TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT,
    subscription_current_period_end TIMESTAMPTZ,
    subscription_cancel_at_period_end BOOLEAN,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.plan,
        h.stripe_customer_id,
        h.stripe_subscription_id,
        h.subscription_status,
        h.subscription_current_period_end,
        h.subscription_cancel_at_period_end,
        CASE 
            WHEN h.plan = 'free' THEN true
            WHEN h.stripe_subscription_id IS NOT NULL 
                 AND h.subscription_status = 'active' 
                 AND (h.subscription_current_period_end IS NULL OR h.subscription_current_period_end > NOW())
            THEN true
            ELSE false
        END as is_active
    FROM households h
    WHERE h.id = household_id_param;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policy for subscription data
CREATE POLICY "Users can view their household subscription data" ON households
    FOR SELECT USING (
        id IN (
            SELECT household_id FROM household_members 
            WHERE user_id = auth.uid()::text
        )
    );

-- Add RLS policy for subscription updates (owners only)
CREATE POLICY "Only owners can update subscription data" ON households
    FOR UPDATE USING (
        id IN (
            SELECT household_id FROM household_members 
            WHERE user_id = auth.uid()::text 
            AND role = 'owner'
        )
    );

-- Add helpful comments
COMMENT ON FUNCTION get_subscription_status(UUID) IS 'Returns comprehensive subscription status for a household';
