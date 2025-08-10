-- Add has_onboarded field to users table
-- This migration adds onboarding tracking to the users table

-- Add the has_onboarded column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'has_onboarded'
    ) THEN
        ALTER TABLE users ADD COLUMN has_onboarded BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Update existing users to have has_onboarded = true (assuming they're already using the app)
-- You can comment this out if you want existing users to go through onboarding
UPDATE users SET has_onboarded = true WHERE has_onboarded IS NULL OR has_onboarded = false;

-- Add an index for better performance when checking onboarding status
CREATE INDEX IF NOT EXISTS idx_users_has_onboarded ON users(has_onboarded);
CREATE INDEX IF NOT EXISTS idx_users_clerk_id_onboarded ON users(clerk_id, has_onboarded);

-- Add a comment to document the field
COMMENT ON COLUMN users.has_onboarded IS 'Tracks whether the user has completed the onboarding process';
