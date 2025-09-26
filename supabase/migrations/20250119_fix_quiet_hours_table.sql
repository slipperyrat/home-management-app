-- Fix quiet_hours table by adding missing days_of_week column
ALTER TABLE quiet_hours ADD COLUMN IF NOT EXISTS days_of_week text[] NOT NULL DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[];

-- Update existing records to have the default days
UPDATE quiet_hours SET days_of_week = ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']::text[] WHERE days_of_week IS NULL;

-- Add comment
COMMENT ON COLUMN quiet_hours.days_of_week IS 'Array of days when quiet hours are active (mon, tue, wed, thu, fri, sat, sun)';