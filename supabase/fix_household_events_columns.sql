-- Fix missing columns in household_events table for calendar functionality
-- Run this to fix the calendar event creation errors

-- Add missing AI-related columns
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS ai_suggested BOOLEAN DEFAULT FALSE;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS ai_confidence INTEGER DEFAULT 75;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS conflict_resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

-- Add missing event management columns
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'general';
ALTER TABLE household_events ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

-- Update any existing events to have proper defaults
UPDATE household_events SET ai_suggested = FALSE WHERE ai_suggested IS NULL;
UPDATE household_events SET ai_confidence = 75 WHERE ai_confidence IS NULL;
UPDATE household_events SET conflict_resolved = FALSE WHERE conflict_resolved IS NULL;
UPDATE household_events SET reminder_sent = FALSE WHERE reminder_sent IS NULL;
UPDATE household_events SET event_type = 'general' WHERE event_type IS NULL;
UPDATE household_events SET priority = 'medium' WHERE priority IS NULL;
