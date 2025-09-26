-- Final comprehensive fix for household_events table - ALL missing columns
-- This should resolve ALL calendar event creation errors

-- Add missing core event columns
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
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

-- Add missing event management columns
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS recurring_pattern TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_household_events_created_by ON household_events(created_by);
CREATE INDEX IF NOT EXISTS idx_household_events_household_id ON household_events(household_id);
CREATE INDEX IF NOT EXISTS idx_household_events_start_time ON household_events(start_time);
CREATE INDEX IF NOT EXISTS idx_household_events_end_time ON household_events(end_time);
CREATE INDEX IF NOT EXISTS idx_household_events_event_type ON household_events(event_type);

-- Update any existing events to have proper defaults
UPDATE household_events SET ai_suggested = FALSE WHERE ai_suggested IS NULL;
UPDATE household_events SET ai_confidence = 75 WHERE ai_confidence IS NULL;
UPDATE household_events SET conflict_resolved = FALSE WHERE conflict_resolved IS NULL;
UPDATE household_events SET reminder_sent = FALSE WHERE reminder_sent IS NULL;
UPDATE household_events SET is_all_day = FALSE WHERE is_all_day IS NULL;
UPDATE household_events SET event_type = 'general' WHERE event_type IS NULL;
UPDATE household_events SET priority = 'medium' WHERE priority IS NULL;
UPDATE household_events SET is_public = FALSE WHERE is_public IS NULL;
UPDATE household_events SET is_recurring = FALSE WHERE is_recurring IS NULL;

-- Set household_id for existing events if not set
UPDATE household_events SET household_id = (
  SELECT h.id FROM households h 
  LIMIT 1
) WHERE household_id IS NULL;
