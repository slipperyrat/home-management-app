-- Fix power_ups table schema to add missing is_active column
-- This migration adds the is_active column that the app expects

-- Add is_active column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'power_ups' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE power_ups ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_power_ups_is_active ON power_ups(is_active);

-- Add comment to document the field
COMMENT ON COLUMN power_ups.is_active IS 'Whether the power-up is currently active';

-- Update existing power-ups to have is_active = true by default
UPDATE power_ups SET is_active = true WHERE is_active IS NULL;

-- Set is_active to false for expired power-ups
UPDATE power_ups SET is_active = false 
WHERE expires_at IS NOT NULL AND expires_at < NOW();
