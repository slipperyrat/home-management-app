-- Phase 0: Audit Logging System
-- This file creates a minimal audit logging system for compliance and trust
-- Logs critical user actions for privacy compliance and security monitoring

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor_id text NOT NULL,             -- clerk user id
  household_id uuid,                  -- optional, for household-scoped actions
  action text NOT NULL,               -- 'role.change' | 'reward.redeem' | 'delete' | 'data.export'
  target_table text,                  -- which table was affected
  target_id text,                     -- which record was affected
  meta jsonb NOT NULL DEFAULT '{}',  -- additional context data
  ip_address inet,                    -- IP address for security monitoring
  user_agent text                     -- User agent for debugging
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS audit_household_time_idx ON audit_log (household_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_actor_time_idx ON audit_log (actor_id, at DESC);
CREATE INDEX IF NOT EXISTS audit_action_time_idx ON audit_log (action, at DESC);
CREATE INDEX IF NOT EXISTS audit_target_idx ON audit_log (target_table, target_id);

-- Add comments for documentation
COMMENT ON TABLE audit_log IS 'Audit log for compliance and security monitoring';
COMMENT ON COLUMN audit_log.actor_id IS 'Clerk user ID who performed the action';
COMMENT ON COLUMN audit_log.action IS 'Type of action performed (e.g., role.change, data.delete)';
COMMENT ON COLUMN audit_log.meta IS 'Additional context data in JSON format';

-- Create function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_actor_id text,
  p_action text,
  p_household_id uuid DEFAULT NULL,
  p_target_table text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  audit_id uuid;
BEGIN
  INSERT INTO audit_log (
    actor_id,
    household_id,
    action,
    target_table,
    target_id,
    meta,
    ip_address,
    user_agent
  ) VALUES (
    p_actor_id,
    p_household_id,
    p_action,
    p_target_table,
    p_target_id,
    p_meta,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;

-- Create function to get user audit trail
CREATE OR REPLACE FUNCTION get_user_audit_trail(
  p_user_id text,
  p_limit integer DEFAULT 100
) RETURNS TABLE (
  action text,
  target_table text,
  target_id text,
  at timestamptz,
  meta jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.action,
    al.target_table,
    al.target_id,
    al.at,
    al.meta
  FROM audit_log al
  WHERE al.actor_id = p_user_id
  ORDER BY al.at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get household audit trail
CREATE OR REPLACE FUNCTION get_household_audit_trail(
  p_household_id uuid,
  p_limit integer DEFAULT 100
) RETURNS TABLE (
  actor_id text,
  action text,
  target_table text,
  target_id text,
  at timestamptz,
  meta jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.actor_id,
    al.action,
    al.target_table,
    al.target_id,
    al.at,
    al.meta
  FROM audit_log al
  WHERE al.household_id = p_household_id
  ORDER BY al.at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to export audit data for privacy compliance
CREATE OR REPLACE FUNCTION export_user_audit_data(
  p_user_id text,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'export_date', now(),
    'audit_events', jsonb_agg(
      jsonb_build_object(
        'action', al.action,
        'target_table', al.target_table,
        'target_id', al.target_id,
        'timestamp', al.at,
        'context', al.meta
      )
    )
  ) INTO result
  FROM audit_log al
  WHERE al.actor_id = p_user_id
    AND (p_start_date IS NULL OR al.at >= p_start_date)
    AND (p_end_date IS NULL OR al.at <= p_end_date);
  
  RETURN COALESCE(result, jsonb_build_object('user_id', p_user_id, 'audit_events', '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_audit_trail TO authenticated;
GRANT EXECUTE ON FUNCTION get_household_audit_trail TO authenticated;
GRANT EXECUTE ON FUNCTION export_user_audit_data TO authenticated;

-- Create RLS policies for audit_log table
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own audit trail
CREATE POLICY audit_log_user_policy ON audit_log
  FOR SELECT USING (actor_id = auth.uid()::text);

-- Users can only insert their own audit events
CREATE POLICY audit_log_insert_policy ON audit_log
  FOR INSERT WITH CHECK (actor_id = auth.uid()::text);

-- Household members can see household audit trail
CREATE POLICY audit_log_household_policy ON audit_log
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id = auth.uid()::text
    )
  );

-- Create some example audit events for testing
-- Note: These are just examples, remove in production
INSERT INTO audit_log (actor_id, action, target_table, meta) VALUES
  ('example_user_123', 'system.test', 'audit_log', '{"test": true, "description": "Example audit event"}')
ON CONFLICT DO NOTHING;

-- Verify the audit system is set up correctly
SELECT 
  'audit_log' as table_name,
  COUNT(*) as total_events,
  MIN(at) as earliest_event,
  MAX(at) as latest_event
FROM audit_log;

-- Show recent audit events
SELECT 
  actor_id,
  action,
  target_table,
  at
FROM audit_log 
ORDER BY at DESC 
LIMIT 5;
