-- Calendar & Event Management Schema
-- Following the other tool's superior approach: Data-first, reuse existing RRULE logic

-- Calendars (optional multi-calendar per household)
CREATE TABLE IF NOT EXISTS calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Household',
  color TEXT DEFAULT '#6C9EFF',
  created_by TEXT NOT NULL, -- Clerk id
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Core events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,         -- store UTC
  end_at TIMESTAMPTZ NOT NULL,           -- store UTC
  timezone TEXT NOT NULL DEFAULT 'Australia/Melbourne',
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  rrule TEXT,                            -- e.g. "FREQ=WEEKLY;BYDAY=MO,WE"
  exdates TIMESTAMPTZ[] DEFAULT '{}',    -- exceptions in UTC
  rdates TIMESTAMPTZ[] DEFAULT '{}',     -- explicit extra instances (optional)
  location TEXT,
  created_by TEXT NOT NULL,              -- Clerk id
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attendees: both members and external emails supported
CREATE TABLE IF NOT EXISTS event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT,          -- Clerk id (nullable if external)
  email TEXT,            -- for external guests
  status TEXT NOT NULL DEFAULT 'needsAction', -- accepted|declined|tentative|needsAction
  is_optional BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(event_id, user_id, email) -- Ensure no duplicate attendees per event
);

-- Reminders
CREATE TABLE IF NOT EXISTS event_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL CHECK (minutes_before >= 0),
  method TEXT NOT NULL DEFAULT 'push'  -- push|email|sms (future)
);

-- (Optional) Precomputed occurrences for fast range queries; fill via job/edge function
CREATE TABLE IF NOT EXISTS event_occurrences (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  household_id UUID NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_exception BOOLEAN NOT NULL DEFAULT FALSE
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS events_household_start_idx ON events (household_id, start_at);
CREATE INDEX IF NOT EXISTS events_calendar_start_idx ON events (calendar_id, start_at);
CREATE INDEX IF NOT EXISTS event_occurrences_household_start_idx ON event_occurrences (household_id, starts_at);

-- RLS
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_occurrences ENABLE ROW LEVEL SECURITY;

-- Policies (members of the household can read; creators + owners can write)
-- NOTE: household_members.user_id is TEXT; cast auth.uid() to TEXT.

-- Calendars policies
CREATE POLICY "calendars_select_household_members"
ON calendars FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = calendars.household_id
      AND hm.user_id = auth.uid()::text
  )
);

CREATE POLICY "calendars_modify_creator_or_owner"
ON calendars FOR ALL
USING (
  created_by = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = calendars.household_id
      AND hm.user_id = auth.uid()::text
      AND hm.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = calendars.household_id
      AND hm.user_id = auth.uid()::text
  )
);

-- Events policies
CREATE POLICY "events_select_household_members"
ON events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = events.household_id
      AND hm.user_id = auth.uid()::text
  )
);

CREATE POLICY "events_modify_creator_or_owner"
ON events FOR ALL
USING (
  created_by = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = events.household_id
      AND hm.user_id = auth.uid()::text
      AND hm.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = events.household_id
      AND hm.user_id = auth.uid()::text
  )
);

-- Attendees policies
CREATE POLICY "attendees_follow_event_access"
ON event_attendees FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    JOIN household_members hm ON hm.household_id = e.household_id
    WHERE e.id = event_attendees.event_id
      AND hm.user_id = auth.uid()::text
  )
);

CREATE POLICY "attendees_modify_creator_or_owner"
ON event_attendees FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_attendees.event_id
      AND (
        e.created_by = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM household_members hm
          WHERE hm.household_id = e.household_id
            AND hm.user_id = auth.uid()::text
            AND hm.role = 'owner'
        )
      )
  )
)
WITH CHECK (true);

-- Reminders policies
CREATE POLICY "reminders_follow_event_access"
ON event_reminders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    JOIN household_members hm ON hm.household_id = e.household_id
    WHERE e.id = event_reminders.event_id
      AND hm.user_id = auth.uid()::text
  )
);

CREATE POLICY "reminders_modify_creator_or_owner"
ON event_reminders FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_reminders.event_id
      AND (
        e.created_by = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM household_members hm
          WHERE hm.household_id = e.household_id
            AND hm.user_id = auth.uid()::text
            AND hm.role = 'owner'
        )
      )
  )
)
WITH CHECK (true);

-- Occurrences policies (read-only access to occurrences for household members)
CREATE POLICY "occurrences_select_household_members"
ON event_occurrences FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = event_occurrences.household_id
      AND hm.user_id = auth.uid()::text
  )
);

-- Create default calendar for existing households
INSERT INTO calendars (household_id, name, color, created_by)
SELECT 
  h.id as household_id,
  'Household Calendar' as name,
  '#6C9EFF' as color,
  hm.user_id as created_by
FROM households h
JOIN household_members hm ON hm.household_id = h.id
WHERE hm.role = 'owner'
AND NOT EXISTS (
  SELECT 1 FROM calendars c WHERE c.household_id = h.id
);
