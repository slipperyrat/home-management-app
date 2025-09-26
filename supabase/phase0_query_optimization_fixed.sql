-- Phase 0: Database Query Optimization & Performance Tuning (FIXED VERSION)
-- This script optimizes database queries and adds performance monitoring
-- Works with standard PostgreSQL views (no extensions required)

-- 1. QUERY PERFORMANCE ANALYSIS VIEWS

-- View to monitor table access patterns (standard PostgreSQL)
CREATE OR REPLACE VIEW table_access_stats AS
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;

-- View to monitor index usage (standard PostgreSQL)
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- View to monitor database activity (standard PostgreSQL)
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

-- 2. ADDITIONAL PERFORMANCE INDEXES

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

-- 3. QUERY OPTIMIZATION FUNCTIONS

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

-- 4. CONNECTION POOLING OPTIMIZATION

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

-- 5. QUERY PLAN ANALYSIS

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION analyze_query_performance(p_query text)
RETURNS TABLE (
    plan_node text,
    operation text,
    estimated_cost numeric,
    estimated_rows numeric,
    actual_time numeric,
    actual_rows bigint
) AS $$
BEGIN
    -- This function would use EXPLAIN (ANALYZE, BUFFERS) in practice
    -- For now, return a placeholder structure
    RETURN QUERY
    SELECT 
        'placeholder'::text,
        'placeholder'::text,
        0::numeric,
        0::numeric,
        0::numeric,
        0::bigint;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. PERFORMANCE MONITORING TRIGGERS

-- Function to log slow operations (if audit_log is available)
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

-- Update table statistics for better query planning
ANALYZE shopping_items;
ANALYZE shopping_lists;
ANALYZE chores;
ANALYZE bills;
ANALYZE meal_plans;
ANALYZE recipes;
ANALYZE users;
ANALYZE households;

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

-- 9. PERFORMANCE RECOMMENDATIONS VIEW

CREATE OR REPLACE VIEW performance_recommendations AS
SELECT 
    'Add index on ' || tablename || '(' || column_name || ')' as recommendation,
    'High' as priority,
    'Missing index for frequent queries' as reason
FROM information_schema.columns c
JOIN pg_stat_user_tables t ON c.table_name = t.tablename
WHERE c.column_name IN ('household_id', 'user_id', 'status', 'due_date')
  AND c.table_schema = 'public'
  AND NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = c.table_name 
        AND indexdef LIKE '%' || c.column_name || '%'
  )

UNION ALL

SELECT 
    'Consider partitioning ' || tablename || ' by date' as recommendation,
    'Medium' as priority,
    'Large table with time-based queries' as reason
FROM pg_stat_user_tables
WHERE n_live_tup > 10000
  AND tablename IN ('chores', 'bills', 'shopping_items');

-- 10. GRANT PERMISSIONS

GRANT SELECT ON table_access_stats TO authenticated;
GRANT SELECT ON index_usage_stats TO authenticated;
GRANT SELECT ON database_activity TO authenticated;
GRANT SELECT ON household_summary_cache TO authenticated;
GRANT SELECT ON performance_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION get_household_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_dashboard_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_connection_stats() TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database performance optimization completed successfully!';
    RAISE NOTICE 'Performance monitoring views and optimization functions created.';
    RAISE NOTICE 'Run: SELECT * FROM performance_recommendations; to see optimization suggestions.';
    RAISE NOTICE 'Run: SELECT * FROM table_access_stats; to monitor table performance.';
    RAISE NOTICE 'Run: REFRESH MATERIALIZED VIEW household_summary_cache; to update cached data.';
    RAISE NOTICE 'Run: SELECT * FROM database_activity; to check connection status.';
END $$;
