-- Verify and fix conflict detection triggers
-- This ensures triggers are properly created and working

-- First, let's check if triggers exist
SELECT 
  trigger_name, 
  event_manipulation, 
  action_timing, 
  action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%conflict%';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS events_conflict_detection_insert ON events;
DROP TRIGGER IF EXISTS events_conflict_detection_update ON events;
DROP TRIGGER IF EXISTS events_conflict_cleanup_delete ON events;

-- Recreate trigger functions
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

-- Test the trigger by manually running conflict detection
-- Replace 'your-household-id' with an actual household ID
-- SELECT upsert_calendar_conflicts('your-household-id-here');
