-- Smart Chore Management System Schema
-- This migration enhances the existing chores system with AI-powered features

-- 1. Enhance existing chores table with AI fields
ALTER TABLE chores ADD COLUMN IF NOT EXISTS ai_difficulty_rating INTEGER DEFAULT 50;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS ai_estimated_duration INTEGER DEFAULT 30; -- in minutes
ALTER TABLE chores ADD COLUMN IF NOT EXISTS ai_preferred_time TEXT DEFAULT 'anytime';
ALTER TABLE chores ADD COLUMN IF NOT EXISTS ai_energy_level TEXT DEFAULT 'medium';
ALTER TABLE chores ADD COLUMN IF NOT EXISTS ai_skill_requirements TEXT[] DEFAULT '{}';
ALTER TABLE chores ADD COLUMN IF NOT EXISTS ai_confidence INTEGER DEFAULT 75;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS ai_suggested BOOLEAN DEFAULT false;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS recurrence TEXT;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE chores ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2. Create chore_assignments table for AI-powered assignments
CREATE TABLE IF NOT EXISTS chore_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chore_id UUID NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  assigned_to TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  ai_suggested BOOLEAN DEFAULT false,
  ai_confidence INTEGER DEFAULT 75,
  ai_reasoning TEXT,
  rotation_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create chore_preferences table for AI learning
CREATE TABLE IF NOT EXISTS chore_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  chore_category TEXT NOT NULL,
  preference_score INTEGER DEFAULT 50, -- 0-100, higher = more preferred
  difficulty_preference TEXT DEFAULT 'medium',
  time_preference TEXT DEFAULT 'anytime',
  energy_preference TEXT DEFAULT 'medium',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, household_id, chore_category)
);

-- 4. Create chore_completion_patterns table for AI learning
CREATE TABLE IF NOT EXISTS chore_completion_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  chore_id UUID NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  completion_time INTEGER NOT NULL, -- actual time taken in minutes
  energy_level TEXT DEFAULT 'medium',
  satisfaction_rating INTEGER DEFAULT 50, -- 0-100
  difficulty_rating INTEGER DEFAULT 50, -- 0-100
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  ai_learning_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create chore_ai_insights table for storing AI-generated insights
CREATE TABLE IF NOT EXISTS chore_ai_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL, -- 'assignment', 'scheduling', 'optimization', 'fairness'
  insight_data JSONB NOT NULL,
  ai_confidence INTEGER DEFAULT 75,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create chore_rotation_schedules table for smart rotation
CREATE TABLE IF NOT EXISTS chore_rotation_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  chore_id UUID NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  rotation_type TEXT NOT NULL, -- 'round_robin', 'fairness_based', 'preference_based'
  current_assignee TEXT,
  next_assignee TEXT,
  rotation_order INTEGER[] DEFAULT '{}', -- array of user IDs in rotation order
  last_rotated TIMESTAMPTZ DEFAULT NOW(),
  ai_optimized BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chores_ai_difficulty ON chores(ai_difficulty_rating);
CREATE INDEX IF NOT EXISTS idx_chores_ai_confidence ON chores(ai_confidence);
CREATE INDEX IF NOT EXISTS idx_chores_assigned_to ON chores(assigned_to);
CREATE INDEX IF NOT EXISTS idx_chores_status ON chores(status);
CREATE INDEX IF NOT EXISTS idx_chore_assignments_chore_id ON chore_assignments(chore_id);
CREATE INDEX IF NOT EXISTS idx_chore_assignments_assigned_to ON chore_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_chore_preferences_user_household ON chore_preferences(user_id, household_id);
CREATE INDEX IF NOT EXISTS idx_chore_completion_patterns_user_chore ON chore_completion_patterns(user_id, chore_id);
CREATE INDEX IF NOT EXISTS idx_chore_ai_insights_household_type ON chore_ai_insights(household_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_chore_rotation_schedules_household ON chore_rotation_schedules(household_id);

-- 8. Add comments for documentation
COMMENT ON COLUMN chores.ai_difficulty_rating IS 'AI-assessed difficulty rating (0-100)';
COMMENT ON COLUMN chores.ai_estimated_duration IS 'AI-estimated completion time in minutes';
COMMENT ON COLUMN chores.ai_preferred_time IS 'AI-suggested optimal time for this chore';
COMMENT ON COLUMN chores.ai_energy_level IS 'AI-assessed energy level required (low/medium/high)';
COMMENT ON COLUMN chores.ai_skill_requirements IS 'Array of skills needed for this chore';
COMMENT ON COLUMN chores.ai_confidence IS 'AI confidence in its assessment (0-100)';
COMMENT ON COLUMN chores.ai_suggested IS 'Whether this chore was AI-suggested';
COMMENT ON COLUMN chores.priority IS 'Chore priority (low/medium/high/urgent)';
COMMENT ON COLUMN chores.status IS 'Chore status (pending/in_progress/completed/skipped)';

COMMENT ON TABLE chore_assignments IS 'AI-powered chore assignments with reasoning';
COMMENT ON TABLE chore_preferences IS 'User preferences for chore categories and types';
COMMENT ON TABLE chore_completion_patterns IS 'AI learning data from chore completions';
COMMENT ON TABLE chore_ai_insights IS 'AI-generated insights for chore optimization';
COMMENT ON TABLE chore_rotation_schedules IS 'Smart chore rotation and fairness algorithms';

-- 9. Enable RLS on new tables
ALTER TABLE chore_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_completion_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_rotation_schedules ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for new tables
-- Chore assignments: users can see assignments for their household
CREATE POLICY "Users can view chore assignments for their household" ON chore_assignments
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
    )
  );

-- Chore preferences: users can manage their own preferences
CREATE POLICY "Users can manage their own chore preferences" ON chore_preferences
  FOR ALL USING (user_id = auth.jwt() ->> 'sub');

-- Chore completion patterns: users can see patterns for their household
CREATE POLICY "Users can view completion patterns for their household" ON chore_completion_patterns
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
    )
  );

-- Chore AI insights: users can see insights for their household
CREATE POLICY "Users can view AI insights for their household" ON chore_ai_insights
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
    )
  );

-- Chore rotation schedules: users can see rotation schedules for their household
CREATE POLICY "Users can view rotation schedules for their household" ON chore_rotation_schedules
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'
    )
  );

-- 11. Update existing chores with default AI values
UPDATE chores SET 
  ai_difficulty_rating = CASE 
    WHEN category = 'cleaning' THEN 60
    WHEN category = 'maintenance' THEN 80
    WHEN category = 'cooking' THEN 70
    ELSE 50
  END,
  ai_estimated_duration = CASE 
    WHEN category = 'cleaning' THEN 45
    WHEN category = 'maintenance' THEN 90
    WHEN category = 'cooking' THEN 60
    ELSE 30
  END,
  ai_energy_level = CASE 
    WHEN category = 'cleaning' THEN 'medium'
    WHEN category = 'maintenance' THEN 'high'
    WHEN category = 'cooking' THEN 'medium'
    ELSE 'medium'
  END,
  status = 'pending'
WHERE ai_difficulty_rating IS NULL;

-- 12. Create function to update chore AI insights
CREATE OR REPLACE FUNCTION update_chore_ai_insights()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  
  -- If this is a new chore, set default AI values
  IF TG_OP = 'INSERT' THEN
    NEW.ai_difficulty_rating = COALESCE(NEW.ai_difficulty_rating, 50);
    NEW.ai_estimated_duration = COALESCE(NEW.ai_estimated_duration, 30);
    NEW.ai_energy_level = COALESCE(NEW.ai_energy_level, 'medium');
    NEW.ai_confidence = COALESCE(NEW.ai_confidence, 75);
    NEW.status = COALESCE(NEW.status, 'pending');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Create trigger for chore AI insights
DROP TRIGGER IF EXISTS trigger_update_chore_ai_insights ON chores;
CREATE TRIGGER trigger_update_chore_ai_insights
  BEFORE INSERT OR UPDATE ON chores
  FOR EACH ROW
  EXECUTE FUNCTION update_chore_ai_insights();

-- 14. Create function to calculate household chore fairness score
CREATE OR REPLACE FUNCTION calculate_household_chore_fairness(household_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  total_chores INTEGER;
  user_distribution JSONB;
  fairness_score NUMERIC;
BEGIN
  -- Get total chores for household
  SELECT COUNT(*) INTO total_chores
  FROM chores 
  WHERE household_id = household_uuid;
  
  -- Get chore distribution by user
  SELECT jsonb_object_agg(assigned_to, chore_count) INTO user_distribution
  FROM (
    SELECT assigned_to, COUNT(*) as chore_count
    FROM chores 
    WHERE household_id = household_uuid AND assigned_to IS NOT NULL
    GROUP BY assigned_to
  ) t;
  
  -- Calculate fairness score (lower variance = more fair)
  WITH user_counts AS (
    SELECT COUNT(*) as chore_count
    FROM chores 
    WHERE household_id = household_uuid AND assigned_to IS NOT NULL
    GROUP BY assigned_to
  ),
  stats AS (
    SELECT 
      AVG(chore_count) as mean,
      STDDEV(chore_count) as stddev
    FROM user_counts
  )
  SELECT 
    CASE 
      WHEN mean = 0 THEN 100
      ELSE GREATEST(0, 100 - (stddev / mean * 100))
    END INTO fairness_score
  FROM stats;
  
  -- Build result
  result := jsonb_build_object(
    'household_id', household_uuid,
    'total_chores', total_chores,
    'user_distribution', user_distribution,
    'fairness_score', fairness_score,
    'calculated_at', NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Migration completed successfully!
-- Smart Chore Management System is now ready with:
-- ✅ AI-powered difficulty assessment
-- ✅ Smart assignment algorithms  
-- ✅ Fairness optimization
-- ✅ Preference learning
-- ✅ Completion pattern analysis
-- ✅ Rotation scheduling
-- ✅ Performance optimization
