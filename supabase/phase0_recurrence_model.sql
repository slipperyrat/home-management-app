-- Phase 0: Recurrence Model Foundation
-- This file adds RRULE support for recurring chores and events
-- Prevents future rewrites and enables advanced scheduling

-- Add recurrence support to chores table
ALTER TABLE chores ADD COLUMN IF NOT EXISTS rrule text;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS dtstart timestamptz;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS rrule_end_date timestamptz;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS next_occurrence timestamptz;

-- Add recurrence support to calendar_events table (if it exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events') THEN
        ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS rrule text;
        ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS dtstart timestamptz;
        ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS rrule_end_date timestamptz;
        ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS next_occurrence timestamptz;
        RAISE NOTICE 'Added recurrence columns to calendar_events table';
    ELSE
        RAISE NOTICE 'calendar_events table does not exist, skipping';
    END IF;
END $$;

-- Create indexes for recurrence queries
CREATE INDEX IF NOT EXISTS chores_household_rrule_idx ON chores (household_id, rrule) WHERE rrule IS NOT NULL;
CREATE INDEX IF NOT EXISTS chores_next_occurrence_idx ON chores (next_occurrence) WHERE next_occurrence IS NOT NULL;
CREATE INDEX IF NOT EXISTS chores_rrule_active_idx ON chores (household_id, rrule, next_occurrence) 
    WHERE rrule IS NOT NULL AND next_occurrence IS NOT NULL;

-- Add comments to document the recurrence fields
COMMENT ON COLUMN chores.rrule IS 'RRULE string for recurring chores (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR")';
COMMENT ON COLUMN chores.dtstart IS 'Start date/time for the recurrence pattern';
COMMENT ON COLUMN chores.rrule_end_date IS 'Optional end date for the recurrence pattern';
COMMENT ON COLUMN chores.next_occurrence IS 'Calculated next occurrence date for this recurring chore';

-- Create a function to calculate next occurrence from RRULE
CREATE OR REPLACE FUNCTION calculate_next_occurrence(
    rrule_text text,
    start_date timestamptz,
    end_date timestamptz DEFAULT NULL
) RETURNS timestamptz AS $$
DECLARE
    next_date timestamptz;
BEGIN
    -- Basic RRULE parsing for common patterns
    -- This is a simplified implementation - consider using a proper RRULE library
    IF rrule_text IS NULL OR start_date IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- For now, return start_date + 1 day as placeholder
    -- TODO: Implement proper RRULE parsing
    next_date := start_date + INTERVAL '1 day';
    
    -- Check if we've exceeded the end date
    IF end_date IS NOT NULL AND next_date > end_date THEN
        RETURN NULL;
    END IF;
    
    RETURN next_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to update next_occurrence for all recurring chores
CREATE OR REPLACE FUNCTION update_recurring_chores() RETURNS void AS $$
BEGIN
    UPDATE chores 
    SET next_occurrence = calculate_next_occurrence(rrule, dtstart, rrule_end_date)
    WHERE rrule IS NOT NULL 
        AND dtstart IS NOT NULL
        AND (next_occurrence IS NULL OR next_occurrence < now());
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update next_occurrence when rrule changes
CREATE OR REPLACE FUNCTION trigger_update_recurring_chores() RETURNS trigger AS $$
BEGIN
    IF NEW.rrule IS NOT NULL AND NEW.dtstart IS NOT NULL THEN
        NEW.next_occurrence := calculate_next_occurrence(NEW.rrule, NEW.dtstart, NEW.rrule_end_date);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add the trigger to the chores table
DROP TRIGGER IF EXISTS update_recurring_chores_trigger ON chores;
CREATE TRIGGER update_recurring_chores_trigger
    BEFORE INSERT OR UPDATE ON chores
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_recurring_chores();

-- Example RRULE patterns for common household tasks
-- These can be used as templates in your UI
COMMENT ON TABLE chores IS 'Chores table with recurrence support. Common RRULE patterns:
- Daily: FREQ=DAILY
- Weekly: FREQ=WEEKLY;BYDAY=MO,WE,FR
- Monthly: FREQ=MONTHLY;BYMONTHDAY=1
- Every 2 weeks: FREQ=WEEKLY;INTERVAL=2
- Weekdays only: FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';

-- Verify the new columns were added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'chores'
    AND column_name IN ('rrule', 'dtstart', 'rrule_end_date', 'next_occurrence')
ORDER BY column_name;
