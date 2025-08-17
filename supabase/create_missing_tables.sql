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

-- 8. Grant necessary permissions (adjust as needed for your setup)
-- GRANT ALL ON users TO authenticated;
-- GRANT ALL ON households TO authenticated;
-- GRANT ALL ON household_members TO authenticated;
