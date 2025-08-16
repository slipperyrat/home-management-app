-- Fix users table schema to match what syncUser function expects
-- This migration adds missing fields: email, role, xp, coins

-- Add email column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email'
    ) THEN
        ALTER TABLE users ADD COLUMN email TEXT;
    END IF;
END $$;

-- Add role column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member';
    END IF;
END $$;

-- Add xp column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'xp'
    ) THEN
        ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add coins column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'coins'
    ) THEN
        ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp);
CREATE INDEX IF NOT EXISTS idx_users_coins ON users(coins);

-- Add comments to document the new fields
COMMENT ON COLUMN users.email IS 'User email address from Clerk';
COMMENT ON COLUMN users.role IS 'User role in the household (owner, member)';
COMMENT ON COLUMN users.xp IS 'User experience points for gamification';
COMMENT ON COLUMN users.coins IS 'User coins for rewards system';

-- Update existing users to have default values
UPDATE users SET 
    email = COALESCE(email, ''),
    role = COALESCE(role, 'member'),
    xp = COALESCE(xp, 0),
    coins = COALESCE(coins, 0)
WHERE email IS NULL OR role IS NULL OR xp IS NULL OR coins IS NULL;
