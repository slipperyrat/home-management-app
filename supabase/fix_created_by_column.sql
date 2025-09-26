-- Fix missing created_by column in household_events table
-- This is critical for calendar event creation

-- Add missing created_by column to household_events table
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Add missing updated_by column as well (commonly needed)
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS updated_by TEXT;

-- Add missing household_id column if it doesn't exist
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS household_id UUID;

-- Create index on created_by for better performance
CREATE INDEX IF NOT EXISTS idx_household_events_created_by ON household_events(created_by);

-- Create index on household_id for better performance  
CREATE INDEX IF NOT EXISTS idx_household_events_household_id ON household_events(household_id);

-- Update any existing events to have proper defaults
UPDATE household_events SET created_by = 'system' WHERE created_by IS NULL;
UPDATE household_events SET updated_by = 'system' WHERE updated_by IS NULL;
