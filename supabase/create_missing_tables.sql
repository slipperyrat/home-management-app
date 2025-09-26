-- Create missing tables and columns for the home management app
-- This file should be run in your Supabase SQL editor

-- 1. Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Clerk user ID
  email TEXT,
  role TEXT DEFAULT 'member',
  xp INTEGER DEFAULT 0,
  coins INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create households table if it doesn't exist
CREATE TABLE IF NOT EXISTS households (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create household_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS household_members (
  user_id TEXT NOT NULL,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, household_id)
);

-- 4. Add missing columns to users table if they don't exist
DO $$ 
BEGIN
    -- Add email column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email'
    ) THEN
        ALTER TABLE users ADD COLUMN email TEXT;
    END IF;
    
    -- Add role column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member';
    END IF;
    
    -- Add xp column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'xp'
    ) THEN
        ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0;
    END IF;
    
    -- Add coins column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'coins'
    ) THEN
        ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0;
    END IF;
    
    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp);
CREATE INDEX IF NOT EXISTS idx_users_coins ON users(coins);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_role ON household_members(role);

-- 6. Insert a default household if none exists
INSERT INTO households (name) 
SELECT 'My Household' 
WHERE NOT EXISTS (SELECT 1 FROM households LIMIT 1);

-- 7. Add comments to document the structure
COMMENT ON TABLE users IS 'User accounts with XP and coins for gamification';
COMMENT ON TABLE households IS 'Households that users can belong to';
COMMENT ON TABLE household_members IS 'Junction table linking users to households with roles';

COMMENT ON COLUMN users.id IS 'Clerk user ID (TEXT)';
COMMENT ON COLUMN users.email IS 'User email address from Clerk';
COMMENT ON COLUMN users.role IS 'User role in the household (owner, member)';
COMMENT ON COLUMN users.xp IS 'User experience points for gamification';
COMMENT ON COLUMN users.coins IS 'User coins for rewards system';

COMMENT ON COLUMN households.name IS 'Name of the household';
COMMENT ON COLUMN household_members.user_id IS 'Clerk user ID (TEXT)';
COMMENT ON COLUMN household_members.household_id IS 'Household UUID';
COMMENT ON COLUMN household_members.role IS 'User role in household (owner, member)';

-- 8. Create digest_preferences table if it doesn't exist
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

-- 9. Create indexes for digest_preferences
CREATE INDEX IF NOT EXISTS idx_digest_preferences_user_id ON digest_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_preferences_household_id ON digest_preferences(household_id);
CREATE INDEX IF NOT EXISTS idx_digest_preferences_daily_enabled ON digest_preferences(daily_digest_enabled) WHERE daily_digest_enabled = true;
CREATE INDEX IF NOT EXISTS idx_digest_preferences_weekly_enabled ON digest_preferences(weekly_digest_enabled) WHERE weekly_digest_enabled = true;

-- 10. Enable RLS for digest_preferences
ALTER TABLE digest_preferences ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policies for digest_preferences (with IF NOT EXISTS)
DO $$ 
BEGIN
    -- Create policies only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'digest_preferences' AND policyname = 'Users can view their own digest preferences') THEN
        CREATE POLICY "Users can view their own digest preferences" ON digest_preferences
          FOR SELECT USING (auth.uid()::text = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'digest_preferences' AND policyname = 'Users can insert their own digest preferences') THEN
        CREATE POLICY "Users can insert their own digest preferences" ON digest_preferences
          FOR INSERT WITH CHECK (auth.uid()::text = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'digest_preferences' AND policyname = 'Users can update their own digest preferences') THEN
        CREATE POLICY "Users can update their own digest preferences" ON digest_preferences
          FOR UPDATE USING (auth.uid()::text = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'digest_preferences' AND policyname = 'Users can delete their own digest preferences') THEN
        CREATE POLICY "Users can delete their own digest preferences" ON digest_preferences
          FOR DELETE USING (auth.uid()::text = user_id);
    END IF;
END $$;

-- 12. Create function to update the updated_at timestamp for digest_preferences
CREATE OR REPLACE FUNCTION update_digest_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Create trigger for digest_preferences updated_at
CREATE TRIGGER trigger_update_digest_preferences_updated_at
  BEFORE UPDATE ON digest_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_digest_preferences_updated_at();

-- 15. Create rate_limits table for API rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint, window_start)
);

-- 16. Create indexes for rate_limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint_window ON rate_limits(user_id, endpoint, window_start);

-- 17. Enable RLS for rate_limits
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- 18. Create RLS policies for rate_limits (service role access only)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rate_limits' AND policyname = 'Service role can manage rate limits') THEN
        CREATE POLICY "Service role can manage rate limits" ON rate_limits
          FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- 19. Add missing columns to chores table if they don't exist
DO $$ 
BEGIN
    -- Add assignment_strategy column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chores' AND column_name = 'assignment_strategy'
    ) THEN
        ALTER TABLE chores ADD COLUMN assignment_strategy TEXT DEFAULT 'auto';
    END IF;
    
    -- Add ai_confidence column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chores' AND column_name = 'ai_confidence'
    ) THEN
        ALTER TABLE chores ADD COLUMN ai_confidence INTEGER DEFAULT 75;
    END IF;
    
    -- Add ai_suggested column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chores' AND column_name = 'ai_suggested'
    ) THEN
        ALTER TABLE chores ADD COLUMN ai_suggested BOOLEAN DEFAULT false;
    END IF;
    
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chores' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE chores ADD COLUMN created_by TEXT;
    END IF;
    
    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chores' AND column_name = 'status'
    ) THEN
        ALTER TABLE chores ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chores' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE chores ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 20. Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON users TO authenticated;
-- GRANT ALL ON households TO authenticated;
-- GRANT ALL ON household_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON digest_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limits TO service_role;
