-- Digest Preferences Schema
-- This table stores user preferences for daily and weekly digest notifications

CREATE TABLE IF NOT EXISTS digest_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL, -- Clerk user ID
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  
  -- Timing preferences
  daily_digest_enabled boolean NOT NULL DEFAULT true,
  daily_digest_time text NOT NULL DEFAULT '08:00', -- HH:MM format
  weekly_digest_enabled boolean NOT NULL DEFAULT true,
  weekly_digest_day text NOT NULL DEFAULT 'sunday', -- day of week
  weekly_digest_time text NOT NULL DEFAULT '09:00', -- HH:MM format
  
  -- Content preferences
  include_chores boolean NOT NULL DEFAULT true,
  include_meals boolean NOT NULL DEFAULT true,
  include_shopping boolean NOT NULL DEFAULT true,
  include_events boolean NOT NULL DEFAULT true,
  include_achievements boolean NOT NULL DEFAULT true,
  include_insights boolean NOT NULL DEFAULT true,
  
  -- Delivery preferences
  email_enabled boolean NOT NULL DEFAULT true,
  email_address text, -- User's email for digest delivery
  push_enabled boolean NOT NULL DEFAULT true,
  
  -- Advanced preferences
  priority_filter text NOT NULL DEFAULT 'all' CHECK (priority_filter IN ('all', 'high', 'medium_high')),
  completion_status text NOT NULL DEFAULT 'all' CHECK (completion_status IN ('all', 'pending', 'overdue')),
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT unique_user_household UNIQUE (user_id, household_id),
  CONSTRAINT valid_daily_time CHECK (daily_digest_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT valid_weekly_time CHECK (weekly_digest_time ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT valid_weekly_day CHECK (weekly_digest_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  CONSTRAINT valid_email CHECK (email_address IS NULL OR email_address ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_digest_preferences_user_id ON digest_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_preferences_household_id ON digest_preferences(household_id);
CREATE INDEX IF NOT EXISTS idx_digest_preferences_daily_enabled ON digest_preferences(daily_digest_enabled) WHERE daily_digest_enabled = true;
CREATE INDEX IF NOT EXISTS idx_digest_preferences_weekly_enabled ON digest_preferences(weekly_digest_enabled) WHERE weekly_digest_enabled = true;

-- RLS Policies
ALTER TABLE digest_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own digest preferences
CREATE POLICY "Users can view their own digest preferences" ON digest_preferences
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own digest preferences" ON digest_preferences
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own digest preferences" ON digest_preferences
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own digest preferences" ON digest_preferences
  FOR DELETE USING (auth.uid()::text = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_digest_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at timestamp
CREATE TRIGGER trigger_update_digest_preferences_updated_at
  BEFORE UPDATE ON digest_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_digest_preferences_updated_at();

-- Function to get digest preferences for a user
CREATE OR REPLACE FUNCTION get_user_digest_preferences(p_user_id text, p_household_id uuid)
RETURNS digest_preferences AS $$
DECLARE
  result digest_preferences;
BEGIN
  SELECT * INTO result
  FROM digest_preferences
  WHERE user_id = p_user_id AND household_id = p_household_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all users who should receive daily digests
CREATE OR REPLACE FUNCTION get_daily_digest_users()
RETURNS TABLE (
  user_id text,
  household_id uuid,
  preferences digest_preferences
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dp.user_id,
    dp.household_id,
    dp
  FROM digest_preferences dp
  WHERE dp.daily_digest_enabled = true
    AND (dp.email_enabled = true OR dp.push_enabled = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all users who should receive weekly digests
CREATE OR REPLACE FUNCTION get_weekly_digest_users()
RETURNS TABLE (
  user_id text,
  household_id uuid,
  preferences digest_preferences
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dp.user_id,
    dp.household_id,
    dp
  FROM digest_preferences dp
  WHERE dp.weekly_digest_enabled = true
    AND (dp.email_enabled = true OR dp.push_enabled = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON digest_preferences TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_digest_preferences(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_digest_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_weekly_digest_users() TO authenticated;
