-- Add ICS Sync functionality to households table
-- This adds fields for calendar sync tokens and public access

-- Add ICS sync fields to households table
ALTER TABLE households ADD COLUMN IF NOT EXISTS ics_token TEXT;
ALTER TABLE households ADD COLUMN IF NOT EXISTS ics_token_expires_at TIMESTAMPTZ;
ALTER TABLE households ADD COLUMN IF NOT EXISTS public_sync_enabled BOOLEAN DEFAULT FALSE;

-- Add public event flag to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Create index for ICS token lookup
CREATE INDEX IF NOT EXISTS idx_households_ics_token ON households(ics_token) WHERE ics_token IS NOT NULL;

-- Create index for public events
CREATE INDEX IF NOT EXISTS idx_events_public ON events(household_id, is_public, start_at) WHERE is_public = TRUE;

-- Add RLS policies for public events (events marked as public can be read by anyone with the token)
-- Note: This is handled by the API layer for security

-- Add comments for documentation
COMMENT ON COLUMN households.ics_token IS 'Secret token for public calendar sync access';
COMMENT ON COLUMN households.ics_token_expires_at IS 'Expiration date for the ICS token';
COMMENT ON COLUMN households.public_sync_enabled IS 'Whether public calendar sync is enabled for this household';
COMMENT ON COLUMN events.is_public IS 'Whether this event should be included in public calendar sync';
