-- Create entitlements table for MVP pricing structure
-- This table manages feature access per household based on subscription tier

CREATE TABLE IF NOT EXISTS entitlements (
  household_id uuid PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('free','pro')),
  history_months int NOT NULL DEFAULT 12,
  advanced_rrule boolean NOT NULL DEFAULT false,
  conflict_detection text NOT NULL DEFAULT 'none' CHECK (conflict_detection IN ('none', 'basic', 'advanced')),
  google_import boolean NOT NULL DEFAULT false,
  digest_max_per_day int NOT NULL DEFAULT 0,
  quiet_hours boolean NOT NULL DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  quota_actions_per_month int NOT NULL DEFAULT 400,
  quota_actions_used int NOT NULL DEFAULT 0,
  quota_reset_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS entitlements_tier_idx ON entitlements (tier);
CREATE INDEX IF NOT EXISTS entitlements_quota_reset_idx ON entitlements (quota_reset_date);

-- Enable RLS
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for entitlements
CREATE POLICY "Users can view entitlements for their household" ON entitlements
  FOR SELECT USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "Users can update entitlements for their household" ON entitlements
  FOR UPDATE USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

-- Only system/admin can insert entitlements (for upgrades)
CREATE POLICY "System can insert entitlements" ON entitlements
  FOR INSERT WITH CHECK (true);

-- Function to create free tier entitlements for new households
CREATE OR REPLACE FUNCTION create_free_entitlements()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO entitlements (household_id, tier, history_months, advanced_rrule, conflict_detection, google_import, digest_max_per_day, quiet_hours, quota_actions_per_month)
  VALUES (NEW.id, 'free', 12, false, 'none', false, 0, false, 400);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create free entitlements when household is created
CREATE TRIGGER create_entitlements_on_household_create
  AFTER INSERT ON households
  FOR EACH ROW
  EXECUTE FUNCTION create_free_entitlements();

-- Function to update entitlements when subscription changes
CREATE OR REPLACE FUNCTION update_entitlements_for_subscription(
  p_household_id uuid,
  p_tier text,
  p_stripe_subscription_id text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Update entitlements based on tier
  IF p_tier = 'pro' THEN
    UPDATE entitlements 
    SET 
      tier = 'pro',
      history_months = 24,
      advanced_rrule = true,
      conflict_detection = 'basic',
      google_import = true,
      digest_max_per_day = 1,
      quiet_hours = true,
      quota_actions_per_month = 4000,
      updated_at = now()
    WHERE household_id = p_household_id;
  ELSE
    -- Downgrade to free
    UPDATE entitlements 
    SET 
      tier = 'free',
      history_months = 12,
      advanced_rrule = false,
      conflict_detection = 'none',
      google_import = false,
      digest_max_per_day = 0,
      quiet_hours = false,
      quota_actions_per_month = 400,
      updated_at = now()
    WHERE household_id = p_household_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if household can perform an action (quota check)
CREATE OR REPLACE FUNCTION can_perform_action(p_household_id uuid)
RETURNS boolean AS $$
DECLARE
  current_quota int;
  used_quota int;
  reset_date date;
BEGIN
  SELECT quota_actions_per_month, quota_actions_used, quota_reset_date
  INTO current_quota, used_quota, reset_date
  FROM entitlements
  WHERE household_id = p_household_id;
  
  -- Reset quota if it's a new month
  IF reset_date < CURRENT_DATE THEN
    UPDATE entitlements 
    SET quota_actions_used = 0, quota_reset_date = CURRENT_DATE
    WHERE household_id = p_household_id;
    used_quota := 0;
  END IF;
  
  RETURN used_quota < current_quota;
END;
$$ LANGUAGE plpgsql;

-- Function to increment quota usage
CREATE OR REPLACE FUNCTION increment_quota_usage(p_household_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE entitlements 
  SET quota_actions_used = quota_actions_used + 1
  WHERE household_id = p_household_id;
END;
$$ LANGUAGE plpgsql;

-- Create calendar templates table for Pro features
CREATE TABLE IF NOT EXISTS calendar_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  template_type text NOT NULL CHECK (template_type IN ('school_term', 'sports_training', 'custom')),
  rrule text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for calendar templates
ALTER TABLE calendar_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar templates
CREATE POLICY "Users can view templates for their household" ON calendar_templates
  FOR SELECT USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "Users can manage templates for their household" ON calendar_templates
  FOR ALL USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

-- Insert default Pro templates
INSERT INTO calendar_templates (household_id, name, description, template_type, rrule, events) VALUES
  (NULL, 'Australian School Term 2025', 'Standard Australian school year with terms and holidays', 'school_term', 
   'FREQ=YEARLY;BYMONTH=1,4,7,10', 
   '[
     {"title": "Term 1", "start": "2025-01-28", "end": "2025-04-11", "color": "#3B82F6"},
     {"title": "Term 2", "start": "2025-04-28", "end": "2025-07-04", "color": "#10B981"},
     {"title": "Term 3", "start": "2025-07-21", "end": "2025-09-26", "color": "#F59E0B"},
     {"title": "Term 4", "start": "2025-10-13", "end": "2025-12-19", "color": "#EF4444"}
   ]'::jsonb),
  (NULL, 'Sports Training - Weekly', 'Weekly sports training sessions', 'sports_training',
   'FREQ=WEEKLY;BYDAY=TU,TH',
   '[
     {"title": "Training Session", "start": "18:00", "end": "19:30", "color": "#8B5CF6", "recurring": true}
   ]'::jsonb);

-- Create quiet hours table for Pro feature
CREATE TABLE IF NOT EXISTS quiet_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id)
);

-- Enable RLS for quiet hours
ALTER TABLE quiet_hours ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quiet hours
CREATE POLICY "Users can view quiet hours for their household" ON quiet_hours
  FOR SELECT USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "Users can manage quiet hours for their household" ON quiet_hours
  FOR ALL USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

-- Create conflict detection table for Pro feature
CREATE TABLE IF NOT EXISTS calendar_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  event1_id uuid NOT NULL,
  event2_id uuid NOT NULL,
  conflict_type text NOT NULL CHECK (conflict_type IN ('same_time', 'same_title', 'overlap')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for calendar conflicts
ALTER TABLE calendar_conflicts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar conflicts
CREATE POLICY "Users can view conflicts for their household" ON calendar_conflicts
  FOR SELECT USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "Users can manage conflicts for their household" ON calendar_conflicts
  FOR ALL USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

-- Create Google Calendar import tracking table
CREATE TABLE IF NOT EXISTS google_calendar_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,
  last_import_at timestamptz,
  last_successful_import_at timestamptz,
  import_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  last_error text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, google_calendar_id)
);

-- Enable RLS for Google Calendar imports
ALTER TABLE google_calendar_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Google Calendar imports
CREATE POLICY "Users can view imports for their household" ON google_calendar_imports
  FOR SELECT USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "Users can manage imports for their household" ON google_calendar_imports
  FOR ALL USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

-- Create daily digest tracking table
CREATE TABLE IF NOT EXISTS daily_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  digest_date date NOT NULL,
  sent_at timestamptz,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, digest_date)
);

-- Enable RLS for daily digests
ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily digests
CREATE POLICY "Users can view digests for their household" ON daily_digests
  FOR SELECT USING (household_id IN (
    SELECT household_id FROM household_members 
    WHERE user_id = auth.uid()::text
  ));

-- Only system can insert/update digests
CREATE POLICY "System can manage digests" ON daily_digests
  FOR ALL WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS calendar_templates_household_idx ON calendar_templates (household_id);
CREATE INDEX IF NOT EXISTS quiet_hours_household_idx ON quiet_hours (household_id);
CREATE INDEX IF NOT EXISTS calendar_conflicts_household_idx ON calendar_conflicts (household_id);
CREATE INDEX IF NOT EXISTS google_calendar_imports_household_idx ON google_calendar_imports (household_id);
CREATE INDEX IF NOT EXISTS daily_digests_household_date_idx ON daily_digests (household_id, digest_date);

-- Add comments for documentation
COMMENT ON TABLE entitlements IS 'Manages feature access per household based on subscription tier';
COMMENT ON TABLE calendar_templates IS 'Pro feature: Pre-built calendar templates for school terms, sports, etc.';
COMMENT ON TABLE quiet_hours IS 'Pro feature: Notification quiet hours per household';
COMMENT ON TABLE calendar_conflicts IS 'Pro feature: Tracks calendar conflicts for resolution';
COMMENT ON TABLE google_calendar_imports IS 'Pro feature: Tracks Google Calendar import status and history';
COMMENT ON TABLE daily_digests IS 'Pro feature: Daily email digest tracking and content';
