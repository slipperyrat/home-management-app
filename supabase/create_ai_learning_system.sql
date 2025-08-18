-- AI Learning System for Continuous Improvement
-- This system tracks corrections, learns patterns, and improves AI suggestions over time

-- 1. Enhanced correction tracking with learning data
CREATE TABLE IF NOT EXISTS ai_correction_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  correction_id UUID NOT NULL REFERENCES ai_corrections(id) ON DELETE CASCADE,
  
  -- Pattern analysis fields
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'email_format', 'data_extraction', 'classification', 'confidence_threshold', 'user_preference'
  )),
  
  -- What was wrong and why
  issue_category TEXT NOT NULL CHECK (issue_category IN (
    'missing_data', 'incorrect_data', 'wrong_classification', 'low_confidence', 'user_override'
  )),
  
  -- Correction details
  correction_type TEXT NOT NULL CHECK (correction_type IN (
    'correct', 'ignore', 'mark_done'
  )),
  
  -- Detailed analysis
  original_ai_output JSONB, -- What the AI originally suggested
  corrected_output JSONB,   -- What the user corrected it to
  correction_reason TEXT,   -- Why the correction was needed
  
  -- Learning metadata
  confidence_impact DECIMAL(3,2), -- How much this correction affects confidence scoring
  pattern_strength INTEGER DEFAULT 1, -- How strong this pattern is (frequency)
  is_learned BOOLEAN DEFAULT FALSE, -- Whether this pattern has been incorporated into AI model
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  learned_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Household AI learning profiles
CREATE TABLE IF NOT EXISTS ai_household_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE UNIQUE,
  
  -- Learning progress
  total_corrections INTEGER DEFAULT 0,
  successful_learnings INTEGER DEFAULT 0,
  accuracy_improvement DECIMAL(3,2) DEFAULT 0.0,
  
  -- Pattern preferences
  preferred_email_formats JSONB, -- Common email formats this household receives
  common_bill_providers JSONB,   -- Frequent bill providers
  typical_shopping_patterns JSONB, -- Shopping behavior patterns
  event_preferences JSONB,       -- Calendar and event preferences
  
  -- AI model version and learning status
  current_ai_model_version TEXT DEFAULT 'gpt-3.5-turbo',
  last_learning_update TIMESTAMPTZ DEFAULT NOW(),
  learning_status TEXT DEFAULT 'active' CHECK (learning_status IN ('active', 'paused', 'completed')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Pattern learning rules and triggers
CREATE TABLE IF NOT EXISTS ai_learning_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE, -- Allow NULL for global rules
  
  -- Rule definition
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'email_parsing', 'data_extraction', 'classification', 'confidence_adjustment'
  )),
  
  -- Rule conditions and actions
  trigger_conditions JSONB NOT NULL, -- When this rule applies
  learning_actions JSONB NOT NULL,   -- What to learn from this
  priority INTEGER DEFAULT 1,        -- Rule priority (higher = more important)
  
  -- Rule status
  is_active BOOLEAN DEFAULT TRUE,
  success_rate DECIMAL(3,2) DEFAULT 0.0, -- How often this rule successfully applies
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI suggestion improvements tracking
CREATE TABLE IF NOT EXISTS ai_suggestion_improvements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  
  -- Improvement tracking
  suggestion_type TEXT NOT NULL,
  original_accuracy DECIMAL(3,2), -- Accuracy before learning
  improved_accuracy DECIMAL(3,2), -- Accuracy after learning
  improvement_factor DECIMAL(3,2), -- How much improvement was achieved
  
  -- Learning source
  pattern_id UUID REFERENCES ai_correction_patterns(id),
  rule_id UUID REFERENCES ai_learning_rules(id),
  
  -- Metadata
  learning_date TIMESTAMPTZ DEFAULT NOW(),
  improvement_notes TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_correction_patterns_household ON ai_correction_patterns(household_id);
CREATE INDEX IF NOT EXISTS idx_ai_correction_patterns_type ON ai_correction_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_ai_correction_patterns_learned ON ai_correction_patterns(is_learned);

CREATE INDEX IF NOT EXISTS idx_ai_household_profiles_learning ON ai_household_profiles(learning_status);
CREATE INDEX IF NOT EXISTS idx_ai_learning_rules_household ON ai_learning_rules(household_id);
CREATE INDEX IF NOT EXISTS idx_ai_learning_rules_type ON ai_learning_rules(rule_type);

-- Add RLS policies
ALTER TABLE ai_correction_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_household_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_learning_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestion_improvements ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see learning data for their household
CREATE POLICY "Users can view learning data for their household" ON ai_correction_patterns
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can view household profiles for their household" ON ai_household_profiles
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id::text = auth.uid()::text
    )
  );

-- Add triggers for automatic updates
CREATE OR REPLACE FUNCTION update_ai_learning_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_correction_patterns_timestamp 
  BEFORE UPDATE ON ai_correction_patterns 
  FOR EACH ROW EXECUTE FUNCTION update_ai_learning_timestamps();

CREATE TRIGGER update_ai_household_profiles_timestamp 
  BEFORE UPDATE ON ai_household_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_ai_learning_timestamps();

CREATE TRIGGER update_ai_learning_rules_timestamp 
  BEFORE UPDATE ON ai_learning_rules 
  FOR EACH ROW EXECUTE FUNCTION update_ai_learning_timestamps();

-- Insert default learning rules for common scenarios
-- Global rules (household_id = NULL) apply to all households
-- Household-specific rules can override or extend these global rules
INSERT INTO ai_learning_rules (household_id, rule_name, rule_description, rule_type, trigger_conditions, learning_actions) VALUES
  (NULL, 'Email Format Learning', 'Learn common email formats from corrections', 'email_parsing', 
   '{"correction_type": "correct", "pattern_type": "email_format"}', 
   '{"action": "update_email_format_preferences", "weight": 1.0}'),
  
  (NULL, 'Bill Provider Learning', 'Learn bill provider patterns from corrections', 'classification', 
   '{"correction_type": "correct", "pattern_type": "classification"}', 
   '{"action": "update_bill_provider_patterns", "weight": 1.0}'),
  
  (NULL, 'Confidence Adjustment', 'Adjust confidence thresholds based on user corrections', 'confidence_adjustment', 
   '{"correction_type": "correct", "issue_category": "low_confidence"}', 
   '{"action": "adjust_confidence_threshold", "weight": 0.5}');

-- Add comments for documentation
COMMENT ON TABLE ai_correction_patterns IS 'Tracks AI correction patterns for continuous learning';
COMMENT ON TABLE ai_household_profiles IS 'Household-specific AI learning profiles and preferences';
COMMENT ON TABLE ai_learning_rules IS 'Rules that govern how the AI learns from corrections';
COMMENT ON TABLE ai_suggestion_improvements IS 'Tracks improvements in AI suggestion accuracy over time';
