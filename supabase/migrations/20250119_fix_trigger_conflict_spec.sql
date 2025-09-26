-- Fix trigger functions to remove ON CONFLICT issues
-- The problem is likely in the upsert_calendar_conflicts function

-- Drop and recreate the functions without ON CONFLICT issues
DROP FUNCTION IF EXISTS upsert_calendar_conflicts(uuid);
DROP FUNCTION IF EXISTS check_event_conflicts(uuid);

-- Function to upsert conflicts into calendar_conflicts table (fixed)
CREATE OR REPLACE FUNCTION upsert_calendar_conflicts(p_household_id uuid)
RETURNS void AS $$
DECLARE
  conflict_record RECORD;
BEGIN
  -- Delete existing unresolved conflicts for this household
  DELETE FROM calendar_conflicts 
  WHERE household_id = p_household_id 
    AND is_resolved = false;
  
  -- Insert new conflicts
  FOR conflict_record IN 
    SELECT * FROM detect_calendar_conflicts(p_household_id)
  LOOP
    -- Check if conflict already exists before inserting
    IF NOT EXISTS (
      SELECT 1 FROM calendar_conflicts 
      WHERE household_id = p_household_id 
        AND event1_id = conflict_record.event_id_a 
        AND event2_id = conflict_record.event_id_b
    ) THEN
      INSERT INTO calendar_conflicts (
        household_id,
        event1_id,
        event2_id,
        conflict_type,
        severity,
        is_resolved,
        created_at
      ) VALUES (
        p_household_id,
        conflict_record.event_id_a,
        conflict_record.event_id_b,
        conflict_record.conflict_type,
        conflict_record.severity,
        false,
        now()
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to check conflicts for a specific event (for real-time detection) (fixed)
CREATE OR REPLACE FUNCTION check_event_conflicts(p_event_id uuid)
RETURNS void AS $$
DECLARE
  event_record RECORD;
  conflict_record RECORD;
BEGIN
  -- Get the event details
  SELECT household_id, attendee_user_id, start_at, end_at, title
  INTO event_record
  FROM events
  WHERE id = p_event_id AND attendee_user_id IS NOT NULL;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Find overlapping events for the same attendee
  FOR conflict_record IN
    SELECT 
      e.id as other_event_id,
      CASE 
        WHEN e.title = event_record.title THEN 'same_title'
        WHEN e.start_at = event_record.start_at AND e.end_at = event_record.end_at THEN 'exact_duplicate'
        ELSE 'time_overlap'
      END as conflict_type,
      CASE 
        WHEN e.title = event_record.title AND e.start_at = event_record.start_at AND e.end_at = event_record.end_at THEN 'high'
        WHEN e.title = event_record.title THEN 'medium'
        ELSE 'low'
      END as severity
    FROM events e
    WHERE e.household_id = event_record.household_id
      AND e.attendee_user_id = event_record.attendee_user_id
      AND e.id != p_event_id
      AND e.start_at < event_record.end_at
      AND event_record.start_at < e.end_at
  LOOP
    -- Check if conflict already exists before inserting
    IF NOT EXISTS (
      SELECT 1 FROM calendar_conflicts 
      WHERE household_id = event_record.household_id 
        AND event1_id = LEAST(p_event_id, conflict_record.other_event_id)
        AND event2_id = GREATEST(p_event_id, conflict_record.other_event_id)
    ) THEN
      INSERT INTO calendar_conflicts (
        household_id,
        event1_id,
        event2_id,
        conflict_type,
        severity,
        is_resolved,
        created_at
      ) VALUES (
        event_record.household_id,
        LEAST(p_event_id, conflict_record.other_event_id),
        GREATEST(p_event_id, conflict_record.other_event_id),
        conflict_record.conflict_type,
        conflict_record.severity,
        false,
        now()
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION upsert_calendar_conflicts(uuid) IS 'Updates calendar_conflicts table with current conflicts for a household (fixed ON CONFLICT issue)';
COMMENT ON FUNCTION check_event_conflicts(uuid) IS 'Checks for conflicts when a specific event is created or updated (fixed ON CONFLICT issue)';
