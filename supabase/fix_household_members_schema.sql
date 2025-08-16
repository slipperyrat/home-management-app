-- Fix household_members table structure to match the expected schema
-- This migration removes the id field and ensures proper composite key structure

-- First, check if the id column exists and remove it if it does
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'household_members' AND column_name = 'id'
    ) THEN
        -- Drop the id column if it exists
        ALTER TABLE household_members DROP COLUMN id;
    END IF;
END $$;

-- Ensure we have the correct columns
-- Add user_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'household_members' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE household_members ADD COLUMN user_id TEXT NOT NULL;
    END IF;
END $$;

-- Add household_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'household_members' AND column_name = 'household_id'
    ) THEN
        ALTER TABLE household_members ADD COLUMN household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add role if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'household_members' AND column_name = 'role'
    ) THEN
        ALTER TABLE household_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member';
    END IF;
END $$;

-- Add created_at if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'household_members' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE household_members ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Drop any existing primary key constraint
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'household_members' AND constraint_type = 'PRIMARY KEY'
    ) THEN
        EXECUTE 'ALTER TABLE household_members DROP CONSTRAINT household_members_pkey';
    END IF;
END $$;

-- Add composite primary key on (user_id, household_id)
ALTER TABLE household_members ADD PRIMARY KEY (user_id, household_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_role ON household_members(role);

-- Add comments to document the structure
COMMENT ON TABLE household_members IS 'Junction table linking users to households with roles';
COMMENT ON COLUMN household_members.user_id IS 'Clerk user ID (TEXT)';
COMMENT ON COLUMN household_members.household_id IS 'Household UUID';
COMMENT ON COLUMN household_members.role IS 'User role in household (owner, member)';
