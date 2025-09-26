-- Complete fix for all conflict detection triggers and functions
-- This removes all ON CONFLICT issues

-- Drop all existing triggers
DROP TRIGGER IF EXISTS events_conflict_detection_insert ON events;
DROP TRIGGER IF EXISTS events_conflict_detection_update ON events;
DROP TRIGGER IF EXISTS events_conflict_cleanup_delete ON events;

-- Drop all existing functions
DROP FUNCTION IF EXISTS trigger_conflict_detection();
DROP FUNCTION IF EXISTS cleanup_event_conflicts();
DROP FUNCTION IF EXISTS upsert_calendar_conflicts(uuid);
DROP FUNCTION IF EXISTS check_event_conflicts(uuid);

-- Recreate all functions without ON CONFLICT issues

-- Function to detect conflicts for a specific household
CREATE OR REPLACE FUNCTION detect_calendar_conflicts(p_household_id uuid)
RETURNS TABLE (
  event_id_a uuid,
  event_id_b uuid,
  attendee_user_id text,
  conflict_type text,
  severity text
) AS $$
BEGIN
  RETURN QUERY
  WITH ev AS (
    SELECT 
      e.id, 
      e.household_id, 
      e.attendee_user_id, 
      e.start_at, 
      e.end_at,
      e.title
    FROM events e
    WHERE e.household_id = p_household_id
      AND e.attendee_user_id IS NOT NULL
  ),
  pairs AS (
    SELECT 
      a.id as event_id_a, 
      b.id as event_id_b, 
      a.attendee_user_id,
      CASE 
        WHEN a.title = b.title THEN 'same_title'
        WHEN a.start_at = b.start_at AND a.end_at = b.end_at THEN 'exact_duplicate'
        ELSE 'time_overlap'
      END as conflict_type,
      CASE 
        WHEN a.title = b.title AND a.start_at = b.start_at AND a.end_at = b.end_at THEN 'high'
        WHEN a.title = b.title THEN 'medium'
        ELSE 'low'
      END as severity
    FROM ev a
    JOIN ev b ON a.attendee_user_id = b.attendee_user_id
      AND a.id < b.id  -- Avoid duplicate pairs and self-comparison
      AND a.start_at < b.end_at  -- Time overlap condition
      AND b.start_at < a.end_at  -- Time overlap condition
  )
  SELECT 
    p.event_id_a,
    p.event_id_b,
    p.attendee_user_id,
    p.conflict_type,
    p.severity
  FROM pairs p;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert conflicts into calendar_conflicts table (no ON CONFLICT)
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

-- Function to check conflicts for a specific event (no ON CONFLICT)
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

-- Trigger function to run conflict detection on event changes
CREATE OR REPLACE FUNCTION trigger_conflict_detection()
RETURNS TRIGGER AS $$
BEGIN
  -- Run conflict detection for the affected event
  PERFORM check_event_conflicts(NEW.id);
  
  -- Also run full household conflict detection to catch any other affected events
  PERFORM upsert_calendar_conflicts(NEW.household_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to clean up conflicts when events are deleted
CREATE OR REPLACE FUNCTION cleanup_event_conflicts()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete conflicts involving the deleted event
  DELETE FROM calendar_conflicts 
  WHERE event1_id = OLD.id OR event2_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for INSERT and UPDATE on events table
CREATE TRIGGER events_conflict_detection_insert
  AFTER INSERT ON events
  FOR EACH ROW
  WHEN (NEW.attendee_user_id IS NOT NULL)
  EXECUTE FUNCTION trigger_conflict_detection();

CREATE TRIGGER events_conflict_detection_update
  AFTER UPDATE ON events
  FOR EACH ROW
  WHEN (NEW.attendee_user_id IS NOT NULL AND (
    OLD.start_at IS DISTINCT FROM NEW.start_at OR
    OLD.end_at IS DISTINCT FROM NEW.end_at OR
    OLD.attendee_user_id IS DISTINCT FROM NEW.attendee_user_id OR
    OLD.title IS DISTINCT FROM NEW.title
  ))
  EXECUTE FUNCTION trigger_conflict_detection();

-- Create trigger for DELETE on events table
CREATE TRIGGER events_conflict_cleanup_delete
  AFTER DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_event_conflicts();

-- Verify triggers were created
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing, 
  action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%conflict%';
