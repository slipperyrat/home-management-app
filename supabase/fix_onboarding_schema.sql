-- Fix Onboarding Schema Issues
-- This migration ensures all required tables and fields exist for onboarding to work properly

-- 1. Fix users table to have consistent onboarding field
DO $$ 
BEGIN
    -- Add onboarding_completed column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'onboarding_completed'
    ) THEN
        ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
    END IF;
    
    -- Remove has_onboarded column if it exists (to avoid confusion)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'has_onboarded'
    ) THEN
        ALTER TABLE users DROP COLUMN has_onboarded;
    END IF;
    
    -- Ensure household_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'household_id'
    ) THEN
        ALTER TABLE users ADD COLUMN household_id UUID REFERENCES households(id);
    END IF;
END $$;

-- 2. Ensure households table has required fields
DO $$ 
BEGIN
    -- Add game_mode column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'households' AND column_name = 'game_mode'
    ) THEN
        ALTER TABLE households ADD COLUMN game_mode TEXT DEFAULT 'default';
    END IF;
    
    -- Add created_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'households' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE households ADD COLUMN created_by TEXT;
    END IF;
END $$;

-- 3. Ensure household_members table exists and has required fields
CREATE TABLE IF NOT EXISTS household_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Ensure recipes table exists for sample data
CREATE TABLE IF NOT EXISTS recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    ingredients JSONB NOT NULL DEFAULT '[]',
    instructions TEXT[] NOT NULL DEFAULT '{}',
    prep_time INTEGER NOT NULL DEFAULT 0,
    cook_time INTEGER NOT NULL DEFAULT 0,
    servings INTEGER NOT NULL DEFAULT 1,
    difficulty TEXT NOT NULL DEFAULT 'medium',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Ensure chores table exists for sample data
CREATE TABLE IF NOT EXISTS chores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    points INTEGER NOT NULL DEFAULT 0,
    frequency TEXT NOT NULL DEFAULT 'weekly',
    category TEXT NOT NULL DEFAULT 'general',
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed ON users(onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_users_household_id ON users(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_recipes_household_id ON recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_chores_household_id ON chores(household_id);

-- 7. Update existing users to have default values
UPDATE users SET 
    onboarding_completed = COALESCE(onboarding_completed, false)
WHERE onboarding_completed IS NULL;

-- 8. Update existing households to have default values
UPDATE households SET 
    game_mode = COALESCE(game_mode, 'default')
WHERE game_mode IS NULL;

-- 9. Add comments for documentation
COMMENT ON COLUMN users.onboarding_completed IS 'Whether the user has completed the onboarding process';
COMMENT ON COLUMN users.household_id IS 'Reference to the household this user belongs to';
COMMENT ON COLUMN households.game_mode IS 'Gamification mode for the household';
COMMENT ON COLUMN household_members.role IS 'User role in the household (admin, member)';

-- 10. Enable RLS on new tables if they don't have it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'recipes'
    ) THEN
        ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chores'
    ) THEN
        ALTER TABLE chores ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;
