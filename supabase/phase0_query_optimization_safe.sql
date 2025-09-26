-- Phase 0: Database Query Optimization & Performance Tuning (SAFE VERSION)
-- This script optimizes database queries and adds performance monitoring
-- Works with any PostgreSQL version by checking available columns first

-- 1. CHECK AVAILABLE COLUMNS FIRST

-- Check what columns are available in pg_stat_user_tables
DO $$
DECLARE
    col_names text[];
    col_list text;
BEGIN
    -- Get available column names
    SELECT array_agg(column_name::text) INTO col_names
    FROM information_schema.columns 
    WHERE table_name = 'pg_stat_user_tables' 
      AND table_schema = 'pg_catalog';
    
    -- Create dynamic column list for the view
    col_list := array_to_string(col_names, ', ');
    
    -- Create the view dynamically
    EXECUTE format('
        CREATE OR REPLACE VIEW table_access_stats AS
        SELECT %s
        FROM pg_stat_user_tables
        ORDER BY seq_scan DESC NULLS LAST
    ', col_list);
    
    RAISE NOTICE 'Created table_access_stats view with columns: %', col_list;
END $$;

-- Check what columns are available in pg_stat_user_indexes
DO $$
DECLARE
    col_names text[];
    col_list text;
BEGIN
    -- Get available column names
    SELECT array_agg(column_name::text) INTO col_names
    FROM information_schema.columns 
    WHERE table_name = 'pg_stat_user_indexes' 
      AND table_schema = 'pg_catalog';
    
    -- Create dynamic column list for the view
    col_list := array_to_string(col_names, ', ');
    
    -- Create the view dynamically
    EXECUTE format('
        CREATE OR REPLACE VIEW index_usage_stats AS
        SELECT %s
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC NULLS LAST
    ', col_list);
    
    RAISE NOTICE 'Created index_usage_stats view with columns: %', col_list;
END $$;

-- 2. CREATE SIMPLE PERFORMANCE VIEWS

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

-- 3. ADDITIONAL PERFORMANCE INDEXES

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS shopping_items_household_list_complete_idx 
ON shopping_items (household_id, list_id, is_complete);

CREATE INDEX IF NOT EXISTS chores_household_assigned_status_idx 
ON chores (household_id, assigned_to, status);

CREATE INDEX IF NOT EXISTS bills_household_due_status_idx 
ON bills (household_id, due_date, status);

-- Partial indexes for active/incomplete items
CREATE INDEX IF NOT EXISTS shopping_items_active_idx 
ON shopping_items (list_id, created_at) 
WHERE is_complete = false;

CREATE INDEX IF NOT EXISTS chores_pending_idx 
ON chores (household_id, created_at) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS bills_overdue_idx 
ON bills (household_id, due_date) 
WHERE due_date < now() AND status != 'paid';

-- 4. QUERY OPTIMIZATION FUNCTIONS

-- Function to get household data efficiently (reduces multiple queries)
CREATE OR REPLACE FUNCTION get_household_summary(p_household_id uuid)
RETURNS TABLE (
    household_name text,
    member_count bigint,
    active_chores bigint,
    pending_bills bigint,
    shopping_lists bigint,
    last_activity timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.name,
        COUNT(hm.user_id)::bigint,
        COUNT(CASE WHEN c.status = 'pending' THEN 1 END)::bigint,
        COUNT(CASE WHEN b.status != 'paid' THEN 1 END)::bigint,
        COUNT(sl.id)::bigint,
        GREATEST(
            COALESCE(MAX(c.created_at), '1970-01-01'::timestamptz),
            COALESCE(MAX(b.created_at), '1970-01-01'::timestamptz),
            COALESCE(MAX(sl.created_at), '1970-01-01'::timestamptz)
        ) as last_activity
    FROM households h
    LEFT JOIN household_members hm ON h.id = hm.household_id
    LEFT JOIN chores c ON h.id = c.household_id
    LEFT JOIN bills b ON h.id = b.household_id
    LEFT JOIN shopping_lists sl ON h.id = sl.household_id
    WHERE h.id = p_household_id
    GROUP BY h.id, h.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get user dashboard data efficiently
CREATE OR REPLACE FUNCTION get_user_dashboard_data(p_user_id text)
RETURNS TABLE (
    household_id uuid,
    household_name text,
    user_role text,
    pending_chores bigint,
    upcoming_bills bigint,
    active_shopping_lists bigint,
    total_xp integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        h.name,
        hm.role,
        COUNT(CASE WHEN c.status = 'pending' THEN 1 END)::bigint,
        COUNT(CASE WHEN b.due_date <= (now() + interval '7 days') AND b.status != 'paid' THEN 1 END)::bigint,
        COUNT(CASE WHEN sl.id IS NOT NULL THEN 1 END)::bigint,
        COALESCE(u.xp, 0)
    FROM household_members hm
    JOIN households h ON hm.household_id = h.id
    LEFT JOIN chores c ON h.id = c.household_id AND c.assigned_to = p_user_id
    LEFT JOIN bills b ON h.id = b.household_id
    LEFT JOIN shopping_lists sl ON h.id = sl.household_id
    LEFT JOIN users u ON u.id = p_user_id
    WHERE hm.user_id = p_user_id
    GROUP BY h.id, h.name, hm.role, u.xp;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. CONNECTION POOLING OPTIMIZATION

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

-- 6. PERFORMANCE MONITORING TRIGGERS

-- Function to log performance events (if audit_log is available)
CREATE OR REPLACE FUNCTION log_performance_event()
RETURNS trigger AS $$
BEGIN
    -- Log performance events to audit_log if available
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
        INSERT INTO audit_log (actor_id, action, target_table, target_id, meta)
        VALUES (
            current_user,
            'performance_event',
            TG_TABLE_NAME,
            COALESCE(NEW.id::text, OLD.id::text),
            jsonb_build_object(
                'operation', TG_OP,
                'timestamp', now()
            )
        );
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. AUTOMATIC VACUUM AND ANALYZE SETTINGS

-- Update table statistics for better query planning (only if tables exist)
DO $$
DECLARE
    table_name text;
BEGIN
    FOR table_name IN 
        SELECT unnest(ARRAY['shopping_items', 'shopping_lists', 'chores', 'bills', 'meal_plans', 'recipes', 'users', 'households'])
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name) THEN
            EXECUTE format('ANALYZE %I', table_name);
            RAISE NOTICE 'Analyzed table: %', table_name;
        ELSE
            RAISE NOTICE 'Table does not exist, skipping: %', table_name;
        END IF;
    END LOOP;
END $$;

-- 8. QUERY CACHING OPTIMIZATION

-- Create materialized view for frequently accessed household data
CREATE MATERIALIZED VIEW IF NOT EXISTS household_summary_cache AS
SELECT 
    h.id as household_id,
    h.name,
    COUNT(hm.user_id) as member_count,
    COUNT(CASE WHEN c.status = 'pending' THEN 1 END) as pending_chores,
    COUNT(CASE WHEN b.status != 'paid' THEN 1 END) as unpaid_bills,
    COUNT(sl.id) as shopping_list_count,
    GREATEST(
        COALESCE(MAX(c.created_at), '1970-01-01'::timestamptz),
        COALESCE(MAX(b.created_at), '1970-01-01'::timestamptz),
        COALESCE(MAX(sl.created_at), '1970-01-01'::timestamptz)
    ) as last_activity
FROM households h
LEFT JOIN household_members hm ON h.id = hm.household_id
LEFT JOIN chores c ON h.id = c.household_id
LEFT JOIN bills b ON h.id = b.household_id
LEFT JOIN shopping_lists sl ON h.id = sl.household_id
GROUP BY h.id, h.name;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS household_summary_cache_id_idx 
ON household_summary_cache (household_id);

-- 9. SIMPLE PERFORMANCE RECOMMENDATIONS

-- Create a simple recommendations view that doesn't depend on complex joins
CREATE OR REPLACE VIEW simple_performance_recommendations AS
SELECT 
    'Check table sizes and consider partitioning large tables' as recommendation,
    'Medium' as priority,
    'Large tables can impact query performance' as reason

UNION ALL

SELECT 
    'Monitor index usage and remove unused indexes' as recommendation,
    'Low' as priority,
    'Unused indexes waste space and slow writes' as reason

UNION ALL

SELECT 
    'Regular VACUUM and ANALYZE for optimal performance' as recommendation,
    'High' as priority,
    'Keeps table statistics current and reclaims space' as reason;

-- 10. GRANT PERMISSIONS

GRANT SELECT ON table_access_stats TO authenticated;
GRANT SELECT ON index_usage_stats TO authenticated;
GRANT SELECT ON database_activity TO authenticated;
GRANT SELECT ON household_summary_cache TO authenticated;
GRANT SELECT ON simple_performance_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION get_household_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_dashboard_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_connection_stats() TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database performance optimization completed successfully!';
    RAISE NOTICE 'Performance monitoring views and optimization functions created.';
    RAISE NOTICE 'Run: SELECT * FROM simple_performance_recommendations; to see optimization suggestions.';
    RAISE NOTICE 'Run: SELECT * FROM table_access_stats; to monitor table performance.';
    RAISE NOTICE 'Run: REFRESH MATERIALIZED VIEW household_summary_cache; to update cached data.';
    RAISE NOTICE 'Run: SELECT * FROM database_activity; to check connection status.';
END $$;
