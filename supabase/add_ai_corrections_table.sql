-- Create ai_corrections table for user feedback and corrections
-- This table stores user corrections to AI suggestions for continuous improvement

CREATE TABLE IF NOT EXISTS ai_corrections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  suggestion_id UUID NOT NULL REFERENCES ai_suggestions(id) ON DELETE CASCADE,
  correction_type TEXT NOT NULL CHECK (correction_type IN ('correct', 'mark_done', 'ignore', 'custom')),
  correction_data JSONB, -- Store the corrected/updated data
  user_notes TEXT, -- User's explanation of the correction
  corrected_at TIMESTAMPTZ DEFAULT NOW(),
  ai_model_version TEXT, -- Track which AI model version was corrected
  confidence_score_before DECIMAL(3,2), -- Store the original confidence score
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE ai_corrections IS 'User corrections and feedback for AI suggestions to improve system accuracy';
COMMENT ON COLUMN ai_corrections.correction_type IS 'Type of correction: correct, mark_done, ignore, or custom';
COMMENT ON COLUMN ai_corrections.correction_data IS 'JSON data containing the corrected information';
COMMENT ON COLUMN ai_corrections.user_notes IS 'User explanation of what was wrong and how it was corrected';
COMMENT ON COLUMN ai_corrections.ai_model_version IS 'Version of AI model that made the original suggestion';
COMMENT ON COLUMN ai_corrections.confidence_score_before IS 'Original confidence score before correction';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_corrections_household_id ON ai_corrections(household_id);
CREATE INDEX IF NOT EXISTS idx_ai_corrections_suggestion_id ON ai_corrections(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_ai_corrections_type ON ai_corrections(correction_type);
CREATE INDEX IF NOT EXISTS idx_ai_corrections_created_at ON ai_corrections(created_at);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_ai_corrections_household_type ON ai_corrections(household_id, correction_type);

-- Add RLS (Row Level Security) policies
ALTER TABLE ai_corrections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see corrections for their household
CREATE POLICY "Users can view corrections for their household" ON ai_corrections
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id::text = auth.uid()::text
    )
  );

-- Policy: Users can insert corrections for their household
CREATE POLICY "Users can insert corrections for their household" ON ai_corrections
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id::text = auth.uid()::text
    )
  );

-- Policy: Users can update corrections for their household
CREATE POLICY "Users can update corrections for their household" ON ai_corrections
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id::text = auth.uid()::text
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_corrections_updated_at 
  BEFORE UPDATE ON ai_corrections 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
