-- Fix missing 'type' column in household_events table
-- This is critical for calendar event creation

-- Add missing 'type' column to household_events table
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'general';

-- Update any existing events to have proper defaults
UPDATE household_events SET type = 'general' WHERE type IS NULL;

-- Create index on type for better performance
CREATE INDEX IF NOT EXISTS idx_household_events_type ON household_events(type);