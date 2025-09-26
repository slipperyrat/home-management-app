-- Complete fix for household_events table - all missing columns
-- This should resolve all calendar event creation errors

-- Add missing core event columns
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'general';
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

-- Add missing user tracking columns
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS household_id UUID;

-- Add missing AI-related columns
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS ai_suggested BOOLEAN DEFAULT FALSE;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS ai_confidence INTEGER DEFAULT 75;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS conflict_resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_household_events_title ON household_events(title);
CREATE INDEX IF NOT EXISTS idx_household_events_start_at ON household_events(start_at);
CREATE INDEX IF NOT EXISTS idx_household_events_end_at ON household_events(end_at);
CREATE INDEX IF NOT EXISTS idx_household_events_household_id ON household_events(household_id);
CREATE INDEX IF NOT EXISTS idx_household_events_created_by ON household_events(created_by);
CREATE INDEX IF NOT EXISTS idx_household_events_event_type ON household_events(event_type);

-- Update any existing events to have proper defaults
UPDATE household_events SET title = 'Untitled Event' WHERE title IS NULL;
UPDATE household_events SET description = '' WHERE description IS NULL;
UPDATE household_events SET is_all_day = FALSE WHERE is_all_day IS NULL;
UPDATE household_events SET event_type = 'general' WHERE event_type IS NULL;
UPDATE household_events SET priority = 'medium' WHERE priority IS NULL;
UPDATE household_events SET created_by = 'system' WHERE created_by IS NULL;
UPDATE household_events SET updated_by = 'system' WHERE updated_by IS NULL;
UPDATE household_events SET ai_suggested = FALSE WHERE ai_suggested IS NULL;
UPDATE household_events SET ai_confidence = 75 WHERE ai_confidence IS NULL;
UPDATE household_events SET conflict_resolved = FALSE WHERE conflict_resolved IS NULL;
UPDATE household_events SET reminder_sent = FALSE WHERE reminder_sent IS NULL;
