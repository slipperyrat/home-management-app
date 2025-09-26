-- Fix remaining database issues for meal assignment
-- Run this to fix the missing created_by column and add_audit_log function

-- 1. Fix shopping_items table - add missing created_by column
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id);

-- 2. Create the add_audit_log function
CREATE OR REPLACE FUNCTION public.add_audit_log(
  p_action TEXT,
  p_meta JSONB,
  p_target_id TEXT,
  p_target_table TEXT,
  p_user_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  -- Generate a new UUID for the log entry
  log_id := gen_random_uuid();
  
  -- Insert the audit log entry
  INSERT INTO audit_logs (
    id,
    action,
    metadata,
    target_id,
    target_table,
    user_id,
    created_at
  ) VALUES (
    log_id,
    p_action,
    p_meta,
    p_target_id,
    p_target_table,
    p_user_id,
    NOW()
  );
  
  RETURN log_id;
END;
$$;

-- 3. Ensure audit_logs table exists with correct schema
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  metadata JSONB,
  target_id TEXT,
  target_table TEXT,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.add_audit_log(TEXT, JSONB, TEXT, TEXT, TEXT) TO authenticated;
GRANT ALL ON audit_logs TO authenticated;

-- 5. Add comments for documentation
COMMENT ON FUNCTION public.add_audit_log IS 'Creates an audit log entry for tracking user actions';
COMMENT ON TABLE audit_logs IS 'Audit log entries for tracking user actions and system events';
COMMENT ON COLUMN audit_logs.action IS 'The action that was performed';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional metadata about the action';
COMMENT ON COLUMN audit_logs.target_id IS 'ID of the target resource';
COMMENT ON COLUMN audit_logs.target_table IS 'Table name of the target resource';
COMMENT ON COLUMN audit_logs.user_id IS 'User who performed the action';
