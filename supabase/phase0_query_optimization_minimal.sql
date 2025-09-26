-- Phase 0: Database Query Optimization & Performance Tuning (MINIMAL VERSION)
-- This script creates basic performance monitoring without assuming table schemas
-- Only creates infrastructure that will definitely work

-- 1. BASIC PERFORMANCE VIEWS (NO TABLE DEPENDENCIES)

-- Simple database activity view
CREATE OR REPLACE VIEW database_activity AS
SELECT 
    'active_connections' as metric,
    COUNT(*) as value,
    'Currently active database connections' as description
FROM pg_stat_activity 
WHERE state = 'active'

UNION ALL

SELECT 
    'idle_connections' as metric,
    COUNT(*) as value,
    'Currently idle database connections' as description
FROM pg_stat_activity 
WHERE state = 'idle'

UNION ALL

SELECT 
    'total_connections' as metric,
    COUNT(*) as value,
    'Total database connections' as description
FROM pg_stat_activity;

-- 2. BASIC PERFORMANCE FUNCTIONS (NO TABLE DEPENDENCIES)

-- Function to check connection pool status
CREATE OR REPLACE FUNCTION get_connection_stats()
RETURNS TABLE (
    metric text,
    value bigint,
    description text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'active_connections'::text,
        COUNT(*)::bigint,
        'Currently active database connections'::text
    FROM pg_stat_activity 
    WHERE state = 'active'
    
    UNION ALL
    
    SELECT 
        'idle_connections'::text,
        COUNT(*)::bigint,
        'Currently idle database connections'::text
    FROM pg_stat_activity 
    WHERE state = 'idle'
    
    UNION ALL
    
    SELECT 
        'max_connections'::text,
        setting::bigint,
        'Maximum allowed connections'::text
    FROM pg_settings 
    WHERE name = 'max_connections';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get basic database info
CREATE OR REPLACE FUNCTION get_database_info()
RETURNS TABLE (
    info_type text,
    info_value text,
    description text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'database_name'::text,
        current_database()::text,
        'Current database name'::text
    
    UNION ALL
    
    SELECT 
        'postgres_version'::text,
        version()::text,
        'PostgreSQL version'::text
    
    UNION ALL
    
    SELECT 
        'current_user'::text,
        current_user::text,
        'Current database user'::text;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. SIMPLE PERFORMANCE RECOMMENDATIONS

-- Create a basic recommendations view
CREATE OR REPLACE VIEW basic_performance_recommendations AS
SELECT 
    'Regular VACUUM and ANALYZE for optimal performance' as recommendation,
    'High' as priority,
    'Keeps table statistics current and reclaims space' as reason

UNION ALL

SELECT 
    'Monitor connection pool usage' as recommendation,
    'Medium' as priority,
    'Prevents connection exhaustion' as reason

UNION ALL

SELECT 
    'Check for long-running queries' as recommendation,
    'Medium' as priority,
    'Long queries can block other operations' as reason;

-- 4. GRANT PERMISSIONS

GRANT SELECT ON database_activity TO authenticated;
GRANT SELECT ON basic_performance_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION get_connection_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_info() TO authenticated;

-- 5. SUCCESS MESSAGE

DO $$
BEGIN
    RAISE NOTICE 'Basic database performance infrastructure created successfully!';
    RAISE NOTICE 'Run: SELECT * FROM basic_performance_recommendations; to see optimization suggestions.';
    RAISE NOTICE 'Run: SELECT * FROM database_activity; to check connection status.';
    RAISE NOTICE 'Run: SELECT * FROM get_database_info(); to see database information.';
    RAISE NOTICE 'Run: SELECT * FROM get_connection_stats(); to check connection pool status.';
END $$;
