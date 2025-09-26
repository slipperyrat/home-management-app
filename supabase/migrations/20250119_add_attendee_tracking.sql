-- Add attendee tracking to events table for conflict detection
-- This enables detecting conflicts only for the same attendee

-- Add attendee_user_id column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendee_user_id uuid REFERENCES users(id);

-- Add source column to track where events come from
ALTER TABLE events ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'first_party' CHECK (source IN ('first_party', 'google_import'));

-- Add index for efficient conflict detection queries
CREATE INDEX IF NOT EXISTS events_attendee_time_idx ON events (attendee_user_id, start_at, end_at) WHERE attendee_user_id IS NOT NULL;

-- Add index for household + attendee queries
CREATE INDEX IF NOT EXISTS events_household_attendee_idx ON events (household_id, attendee_user_id) WHERE attendee_user_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN events.attendee_user_id IS 'User ID of the primary attendee for this event (used for conflict detection)';
COMMENT ON COLUMN events.source IS 'Source of the event: first_party (created in app) or google_import';
