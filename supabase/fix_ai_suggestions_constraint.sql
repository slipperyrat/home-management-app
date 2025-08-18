-- Fix ai_suggestions user_feedback constraint to allow new status values
-- This allows suggestions to be marked as completed, ignored, or corrected

-- First, drop the existing constraint
ALTER TABLE ai_suggestions 
DROP CONSTRAINT IF EXISTS ai_suggestions_user_feedback_check;

-- Add the new constraint with expanded values
ALTER TABLE ai_suggestions 
ADD CONSTRAINT ai_suggestions_user_feedback_check 
CHECK (user_feedback IN (
  'accepted', 
  'rejected', 
  'modified', 
  'pending',
  'completed',  -- For mark_done actions
  'ignored',    -- For ignore actions  
  'corrected'   -- For correction actions
));

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT ai_suggestions_user_feedback_check ON ai_suggestions IS 
'User feedback status: accepted, rejected, modified, pending, completed, ignored, or corrected';

-- Verify the constraint was applied
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'ai_suggestions'::regclass 
AND conname = 'ai_suggestions_user_feedback_check';
