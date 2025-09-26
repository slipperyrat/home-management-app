-- Phase 0: Security Hardening & Advanced Features
-- This script enhances security, adds rate limiting, and strengthens RLS policies

-- 1. ENHANCED RLS POLICIES FOR BETTER SECURITY

-- Shopping Lists: Enhanced household isolation
DROP POLICY IF EXISTS "Users can view shopping lists in their household" ON shopping_lists;
CREATE POLICY "Users can view shopping lists in their household" ON shopping_lists
    FOR SELECT USING (
        household_id IN (
            SELECT household_id FROM household_members 
            WHERE user_id = auth.jwt() ->> 'sub'
        )
    );

DROP POLICY IF EXISTS "Users can create shopping lists in their household" ON shopping_lists;
CREATE POLICY "Users can create shopping lists in their household" ON shopping_lists
    FOR INSERT WITH CHECK (
        household_id IN (
            SELECT household_id FROM household_members 
            WHERE user_id = auth.jwt() ->> 'sub'
        )
    );

-- Shopping Items: Enhanced security with household validation
DROP POLICY IF EXISTS "Users can view shopping items in their household" ON shopping_items;
CREATE POLICY "Users can view shopping items in their household" ON shopping_items
    FOR SELECT USING (
        list_id IN (
            SELECT id FROM shopping_lists 
            WHERE household_id IN (
                SELECT household_id FROM household_members 
                WHERE user_id = auth.jwt() ->> 'sub'
            )
        )
    );

-- Chores: Enhanced assignment and status policies
DROP POLICY IF EXISTS "Users can view chores in their household" ON chores;
CREATE POLICY "Users can view chores in their household" ON chores
    FOR SELECT USING (
        household_id IN (
            SELECT household_id FROM household_members 
            WHERE user_id = auth.jwt() ->> 'sub'
        )
    );

-- Bills: Enhanced due date and payment policies
DROP POLICY IF EXISTS "Users can view bills in their household" ON bills;
CREATE POLICY "Users can view bills in their household" ON bills
    FOR SELECT USING (
        household_id IN (
            SELECT household_id FROM household_members 
            WHERE user_id = auth.jwt() ->> 'sub'
        )
    );

-- 2. RATE LIMITING TABLE FOR API PROTECTION
CREATE TABLE IF NOT EXISTS rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    endpoint text NOT NULL,
    request_count integer NOT NULL DEFAULT 1,
    window_start timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast rate limit lookups
CREATE INDEX IF NOT EXISTS rate_limits_user_endpoint_window_idx 
ON rate_limits (user_id, endpoint, window_start);

-- 3. SUSPICIOUS ACTIVITY DETECTION
CREATE TABLE IF NOT EXISTS security_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text,
    event_type text NOT NULL, -- 'failed_login', 'rate_limit_exceeded', 'suspicious_query'
    severity text NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    details jsonb NOT NULL DEFAULT '{}',
    ip_address inet,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for security monitoring
CREATE INDEX IF NOT EXISTS security_events_user_created_idx 
ON security_events (user_id, created_at);
CREATE INDEX IF NOT EXISTS security_events_type_severity_idx 
ON security_events (event_type, severity);

-- 4. ENHANCED USER SESSION TRACKING
CREATE TABLE IF NOT EXISTS user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL,
    session_token text NOT NULL UNIQUE,
    ip_address inet,
    user_agent text,
    last_activity timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Index for session management
CREATE INDEX IF NOT EXISTS user_sessions_user_token_idx 
ON user_sessions (user_id, session_token);
CREATE INDEX IF NOT EXISTS user_sessions_expires_idx 
ON user_sessions (expires_at);

-- 5. FUNCTION TO CLEAN UP EXPIRED SESSIONS
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < now();
    DELETE FROM rate_limits WHERE window_start < (now() - interval '1 hour');
END;
$$ LANGUAGE plpgsql;

-- 6. FUNCTION TO CHECK RATE LIMITS
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id text,
    p_endpoint text,
    p_max_requests integer DEFAULT 100,
    p_window_minutes integer DEFAULT 60
)
RETURNS boolean AS $$
DECLARE
    current_count integer;
    window_start timestamptz;
BEGIN
    -- Set window start
    window_start := date_trunc('hour', now()) + 
                   (date_part('minute', now())::integer / p_window_minutes) * 
                   (p_window_minutes || ' minutes')::interval;
    
    -- Get current count for this window
    SELECT COALESCE(SUM(request_count), 0) INTO current_count
    FROM rate_limits 
    WHERE user_id = p_user_id 
      AND endpoint = p_endpoint 
      AND window_start = window_start;
    
    -- If under limit, increment and allow
    IF current_count < p_max_requests THEN
        INSERT INTO rate_limits (user_id, endpoint, window_start, request_count)
        VALUES (p_user_id, p_endpoint, window_start, 1)
        ON CONFLICT (user_id, endpoint, window_start)
        DO UPDATE SET 
            request_count = rate_limits.request_count + 1,
            updated_at = now();
        RETURN true;
    ELSE
        -- Log security event
        INSERT INTO security_events (user_id, event_type, severity, details)
        VALUES (p_user_id, 'rate_limit_exceeded', 'medium', 
                jsonb_build_object('endpoint', p_endpoint, 'limit', p_max_requests));
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. ENHANCED AUDIT LOGGING TRIGGERS
-- Trigger for tracking user login attempts
CREATE OR REPLACE FUNCTION log_user_activity()
RETURNS trigger AS $$
BEGIN
    -- Log successful logins
    IF TG_OP = 'INSERT' AND NEW.event_type = 'login_success' THEN
        INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent)
        VALUES (NEW.user_id, NEW.session_token, NEW.ip_address, NEW.user_agent);
    END IF;
    
    -- Log failed logins
    IF TG_OP = 'INSERT' AND NEW.event_type = 'login_failed' THEN
        INSERT INTO security_events (user_id, event_type, severity, details)
        VALUES (NEW.user_id, 'failed_login', 'medium', 
                jsonb_build_object('ip_address', NEW.ip_address, 'user_agent', NEW.user_agent));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. SECURITY VIEWS FOR MONITORING
CREATE OR REPLACE VIEW security_dashboard AS
SELECT 
    'rate_limits' as metric,
    COUNT(*) as count,
    'Rate limit violations in last hour' as description
FROM security_events 
WHERE event_type = 'rate_limit_exceeded' 
  AND created_at > (now() - interval '1 hour')

UNION ALL

SELECT 
    'failed_logins' as metric,
    COUNT(*) as count,
    'Failed login attempts in last hour' as description
FROM security_events 
WHERE event_type = 'failed_login' 
  AND created_at > (now() - interval '1 hour')

UNION ALL

SELECT 
    'active_sessions' as metric,
    COUNT(*) as count,
    'Currently active user sessions' as description
FROM user_sessions 
WHERE expires_at > now();

-- 9. GRANT PERMISSIONS
GRANT SELECT ON security_dashboard TO authenticated;
GRANT SELECT ON security_events TO authenticated;
GRANT SELECT ON user_sessions TO authenticated;

-- 10. CREATE CLEANUP JOB (runs every hour)
SELECT cron.schedule(
    'cleanup-expired-sessions',
    '0 * * * *', -- Every hour
    'SELECT cleanup_expired_sessions();'
);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Security hardening completed successfully!';
    RAISE NOTICE 'Enhanced RLS policies, rate limiting, and security monitoring enabled.';
    RAISE NOTICE 'Run: SELECT * FROM security_dashboard; to monitor security metrics.';
END $$;
