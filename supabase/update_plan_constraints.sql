-- Update plan constraints to support Free → Pro → Pro+ structure
-- This migration adds proper constraints and updates existing data

-- 1. First, update any existing 'premium' plans to 'pro' to maintain compatibility
UPDATE households 
SET plan = 'pro' 
WHERE plan = 'premium';

-- 2. Add a check constraint to ensure only valid plan values are allowed
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

-- 3. Update the comment to reflect the new plan structure
COMMENT ON COLUMN households.plan IS 'Household subscription plan: free, pro, or pro_plus';

-- 4. Add an index for better performance on plan-based queries
CREATE INDEX IF NOT EXISTS idx_households_plan_performance ON households(plan) WHERE plan != 'free';

-- 5. Create a function to get plan features (for future use)
CREATE OR REPLACE FUNCTION get_plan_features(plan_type TEXT)
RETURNS TEXT[] AS $$
BEGIN
    CASE plan_type
        WHEN 'free' THEN
            RETURN ARRAY['calendar', 'chores', 'meal_planner', 'shopping_lists', 'leaderboard', 'basic_reminders', 'ics_export', 'basic_analytics'];
        WHEN 'pro' THEN
            RETURN ARRAY['calendar', 'chores', 'meal_planner', 'shopping_lists', 'leaderboard', 'basic_reminders', 'ics_export', 'basic_analytics', 
                        'finance_enabled', 'bill_management', 'spending_tracking', 'budget_envelopes', 'advanced_analytics', 'ai_insights', 
                        'push_notifications', 'google_calendar_read', 'data_export', 'projects', 'priority_support'];
        WHEN 'pro_plus' THEN
            RETURN ARRAY['calendar', 'chores', 'meal_planner', 'shopping_lists', 'leaderboard', 'basic_reminders', 'ics_export', 'basic_analytics', 
                        'finance_enabled', 'bill_management', 'spending_tracking', 'budget_envelopes', 'advanced_analytics', 'ai_insights', 
                        'push_notifications', 'google_calendar_read', 'data_export', 'projects', 'priority_support',
                        'google_calendar_sync', 'multi_household', 'admin_tools', 'unlimited_automations', 'unlimited_notifications', 'availability_resolver'];
        ELSE
            RETURN ARRAY['calendar', 'chores', 'meal_planner', 'shopping_lists', 'leaderboard', 'basic_reminders', 'ics_export', 'basic_analytics'];
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 6. Add a view for easy plan feature checking
CREATE OR REPLACE VIEW household_plan_features AS
SELECT 
    h.id as household_id,
    h.plan,
    get_plan_features(h.plan) as available_features,
    CASE 
        WHEN h.plan = 'free' THEN 5
        WHEN h.plan = 'pro' THEN 6
        WHEN h.plan = 'pro_plus' THEN 6
        ELSE 5
    END as max_members,
    CASE 
        WHEN h.plan = 'free' THEN 1
        WHEN h.plan = 'pro' THEN 1
        WHEN h.plan = 'pro_plus' THEN 3
        ELSE 1
    END as max_households
FROM households h;

-- 7. Add RLS policy to ensure users can only see their household's plan
CREATE POLICY "Users can view their household plan" ON households
    FOR SELECT USING (
        id IN (
            SELECT household_id FROM household_members 
            WHERE user_id = auth.uid()::text
        )
    );

-- 8. Add RLS policy to ensure only owners can update plan
CREATE POLICY "Only owners can update household plan" ON households
    FOR UPDATE USING (
        id IN (
            SELECT household_id FROM household_members 
            WHERE user_id = auth.uid()::text 
            AND role = 'owner'
        )
    );

-- 9. Create a function to check if a household can access a feature
CREATE OR REPLACE FUNCTION can_access_feature(household_id_param UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    household_plan TEXT;
    available_features TEXT[];
BEGIN
    -- Get the household's plan
    SELECT plan INTO household_plan
    FROM households 
    WHERE id = household_id_param;
    
    -- If household not found, return false
    IF household_plan IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get available features for the plan
    available_features := get_plan_features(household_plan);
    
    -- Check if feature is in the available features array
    RETURN feature_name = ANY(available_features);
END;
$$ LANGUAGE plpgsql;

-- 10. Add helpful comments
COMMENT ON FUNCTION get_plan_features(TEXT) IS 'Returns array of features available for a given plan';
COMMENT ON FUNCTION can_access_feature(UUID, TEXT) IS 'Checks if a household can access a specific feature based on their plan';
COMMENT ON VIEW household_plan_features IS 'View showing plan details and available features for each household';
