-- Fix conflict detection functions to use correct conflict types
-- The calendar_conflicts table only allows: 'same_time', 'same_title', 'overlap'

-- Function to detect conflicts for a specific household (fixed conflict types)
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
        WHEN a.start_at = b.start_at AND a.end_at = b.end_at THEN 'same_time'
        ELSE 'overlap'
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

-- Function to check conflicts for a specific event (fixed conflict types)
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
        WHEN e.start_at = event_record.start_at AND e.end_at = event_record.end_at THEN 'same_time'
        ELSE 'overlap'
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
COMMENT ON FUNCTION detect_calendar_conflicts(uuid) IS 'Detects calendar conflicts for overlapping events with same attendee in a household (fixed conflict types)';
COMMENT ON FUNCTION check_event_conflicts(uuid) IS 'Checks for conflicts when a specific event is created or updated (fixed conflict types)';
