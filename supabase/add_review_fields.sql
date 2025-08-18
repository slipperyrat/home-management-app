-- Add review status fields to ai_parsed_items table
-- This migration adds confidence-based review system for AI extractions

ALTER TABLE ai_parsed_items 
ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'auto_approved' CHECK (review_status IN ('auto_approved', 'needs_review', 'manual_review')),
ADD COLUMN IF NOT EXISTS review_reason TEXT;

-- Add comments for documentation
COMMENT ON COLUMN ai_parsed_items.review_status IS 'Review status based on AI confidence: auto_approved, needs_review, or manual_review';
COMMENT ON COLUMN ai_parsed_items.review_reason IS 'Reason for review status, including confidence percentage and reasoning';

-- Create index for review queries
CREATE INDEX IF NOT EXISTS idx_ai_parsed_items_review_status ON ai_parsed_items(review_status);
CREATE INDEX IF NOT EXISTS idx_ai_parsed_items_confidence_review ON ai_parsed_items(confidence_score, review_status);

-- Update existing records to have default review status
UPDATE ai_parsed_items 
SET review_status = CASE 
  WHEN confidence_score >= 0.75 THEN 'auto_approved'
  ELSE 'needs_review'
END,
review_reason = CASE 
  WHEN confidence_score >= 0.75 THEN 'High confidence (' || ROUND(confidence_score * 100, 1) || '%) - Auto-approved'
  ELSE 'Low confidence (' || ROUND(confidence_score * 100, 1) || '%) - Needs human review'
END
WHERE review_status IS NULL;
