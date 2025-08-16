-- Fix households table schema to match what the app expects
-- This migration adds missing fields: plan, game_mode

-- Add plan column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'households' AND column_name = 'plan'
    ) THEN
        ALTER TABLE households ADD COLUMN plan TEXT DEFAULT 'free';
    END IF;
END $$;

-- Add game_mode column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'households' AND column_name = 'game_mode'
    ) THEN
        ALTER TABLE households ADD COLUMN game_mode TEXT DEFAULT 'default';
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_households_plan ON households(plan);
CREATE INDEX IF NOT EXISTS idx_households_game_mode ON households(game_mode);

-- Add comments to document the new fields
COMMENT ON COLUMN households.plan IS 'Household subscription plan (free, pro, etc.)';
COMMENT ON COLUMN households.game_mode IS 'Household game mode for gamification features';

-- Update existing households to have default values
UPDATE households SET 
    plan = COALESCE(plan, 'free'),
    game_mode = COALESCE(game_mode, 'default')
WHERE plan IS NULL OR game_mode IS NULL;
