-- Cache system for improved performance
-- This creates the necessary tables for the multi-level caching system

-- Create cache_entries table for persistent caching
CREATE TABLE IF NOT EXISTS cache_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  cache_value JSONB NOT NULL,
  ttl INTEGER NOT NULL, -- Time to live in milliseconds
  tags TEXT[] DEFAULT '{}', -- Cache tags for invalidation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cache_entries_key ON cache_entries(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_entries_tags ON cache_entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_cache_entries_created_at ON cache_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_cache_entries_ttl ON cache_entries(ttl);

-- Create cache_statistics table for monitoring
CREATE TABLE IF NOT EXISTS cache_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('hit', 'miss', 'set', 'delete')),
  response_time INTEGER, -- Response time in milliseconds
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  context JSONB DEFAULT '{}'
);

-- Create indexes for cache statistics
CREATE INDEX IF NOT EXISTS idx_cache_statistics_key ON cache_statistics(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_statistics_operation ON cache_statistics(operation);
CREATE INDEX IF NOT EXISTS idx_cache_statistics_timestamp ON cache_statistics(timestamp);

-- Create cache_invalidation_log table for tracking cache operations
CREATE TABLE IF NOT EXISTS cache_invalidation_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation TEXT NOT NULL CHECK (operation IN ('invalidate_by_tag', 'invalidate_by_key', 'clear_all')),
  target TEXT, -- Tag or key that was invalidated
  affected_entries INTEGER DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  context JSONB DEFAULT '{}'
);

-- Create indexes for invalidation log
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_operation ON cache_invalidation_log(operation);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_timestamp ON cache_invalidation_log(timestamp);

-- Create function to automatically clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cache_entries 
  WHERE (EXTRACT(EPOCH FROM (NOW() - created_at)) * 1000) > ttl;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup operation
  INSERT INTO cache_invalidation_log (operation, target, affected_entries, context)
  VALUES ('cleanup_expired', 'automatic', deleted_count, '{"reason": "TTL expired"}');
  
  RETURN deleted_count;
END;
$$;

-- Create function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_statistics(
  time_window_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
  total_hits INTEGER,
  total_misses INTEGER,
  hit_rate NUMERIC,
  avg_response_time NUMERIC,
  total_operations INTEGER,
  most_used_keys TEXT[],
  tag_usage JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE operation = 'hit') as hits,
      COUNT(*) FILTER (WHERE operation = 'miss') as misses,
      AVG(response_time) FILTER (WHERE response_time IS NOT NULL) as avg_time,
      COUNT(*) as total_ops
    FROM cache_statistics 
    WHERE timestamp > NOW() - INTERVAL '1 hour' * time_window_hours
  ),
  key_usage AS (
    SELECT cache_key, COUNT(*) as usage_count
    FROM cache_statistics 
    WHERE timestamp > NOW() - INTERVAL '1 hour' * time_window_hours
    GROUP BY cache_key
    ORDER BY usage_count DESC
    LIMIT 10
  ),
  tag_stats AS (
    SELECT 
      unnest(tags) as tag,
      COUNT(*) as usage_count
    FROM cache_entries
    GROUP BY tag
    ORDER BY usage_count DESC
  )
  SELECT 
    s.hits::INTEGER,
    s.misses::INTEGER,
    CASE 
      WHEN (s.hits + s.misses) > 0 
      THEN ROUND((s.hits::NUMERIC / (s.hits + s.misses) * 100), 2)
      ELSE 0 
    END as hit_rate,
    ROUND(s.avg_time, 2) as avg_response_time,
    s.total_ops::INTEGER,
    ARRAY_AGG(ku.cache_key) as most_used_keys,
    jsonb_object_agg(ts.tag, ts.usage_count) as tag_usage
  FROM stats s
  CROSS JOIN key_usage ku
  CROSS JOIN tag_stats ts
  GROUP BY s.hits, s.misses, s.avg_time, s.total_ops;
END;
$$;

-- Create function to invalidate cache by tags
CREATE OR REPLACE FUNCTION invalidate_cache_by_tags(tags_to_invalidate TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
  affected_tags TEXT[];
BEGIN
  -- Find all cache keys that match any of the tags
  WITH keys_to_delete AS (
    SELECT DISTINCT cache_key
    FROM cache_entries
    WHERE tags && tags_to_invalidate
  )
  DELETE FROM cache_entries 
  WHERE cache_key IN (SELECT cache_key FROM keys_to_delete);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Get the tags that were actually affected
  SELECT ARRAY_AGG(DISTINCT unnest(tags)) INTO affected_tags
  FROM cache_entries
  WHERE tags && tags_to_invalidate;
  
  -- Log the invalidation
  INSERT INTO cache_invalidation_log (operation, target, affected_entries, context)
  VALUES (
    'invalidate_by_tag', 
    array_to_string(tags_to_invalidate, ','), 
    deleted_count,
    jsonb_build_object('affected_tags', affected_tags)
  );
  
  RETURN deleted_count;
END;
$$;

-- Create function to get cache performance metrics
CREATE OR REPLACE FUNCTION get_cache_performance_metrics(
  time_window_hours INTEGER DEFAULT 1
)
RETURNS TABLE (
  metric_name TEXT,
  metric_value NUMERIC,
  metric_unit TEXT,
  timestamp TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'hit_rate'::TEXT as metric_name,
    ROUND(
      (COUNT(*) FILTER (WHERE operation = 'hit')::NUMERIC / 
       NULLIF(COUNT(*), 0) * 100), 2
    ) as metric_value,
    'percentage'::TEXT as metric_unit,
    NOW() as timestamp
  FROM cache_statistics 
  WHERE timestamp > NOW() - INTERVAL '1 hour' * time_window_hours
  
  UNION ALL
  
  SELECT 
    'avg_response_time'::TEXT as metric_name,
    ROUND(AVG(response_time), 2) as metric_value,
    'milliseconds'::TEXT as metric_unit,
    NOW() as timestamp
  FROM cache_statistics 
  WHERE timestamp > NOW() - INTERVAL '1 hour' * time_window_hours
    AND response_time IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'total_operations'::TEXT as metric_name,
    COUNT(*)::NUMERIC as metric_value,
    'count'::TEXT as metric_unit,
    NOW() as timestamp
  FROM cache_statistics 
  WHERE timestamp > NOW() - INTERVAL '1 hour' * time_window_hours
  
  UNION ALL
  
  SELECT 
    'cache_size'::TEXT as metric_name,
    COUNT(*)::NUMERIC as metric_value,
    'entries'::TEXT as metric_unit,
    NOW() as timestamp
  FROM cache_entries;
END;
$$;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cache_entries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_cache_entries_updated_at
  BEFORE UPDATE ON cache_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_cache_entries_updated_at();

-- Create scheduled job to clean up expired cache entries (runs every 5 minutes)
SELECT cron.schedule(
  'cleanup-expired-cache',
  '*/5 * * * *',
  'SELECT cleanup_expired_cache();'
);

-- Insert some sample cache entries for testing
INSERT INTO cache_entries (cache_key, cache_value, ttl, tags) VALUES
  ('test:meal_suggestions:user_123', '{"suggestions": [], "timestamp": "2024-01-15T10:00:00Z"}', 300000, ARRAY['meals', 'user_123']),
  ('test:user_preferences:user_123', '{"theme": "dark", "notifications": true}', 600000, ARRAY['preferences', 'user_123']),
  ('test:household_stats:household_456', '{"member_count": 4, "active_chores": 12}', 1800000, ARRAY['stats', 'household_456'])
ON CONFLICT (cache_key) DO NOTHING;

-- Create view for easy cache monitoring
CREATE OR REPLACE VIEW cache_monitoring_view AS
SELECT 
  ce.cache_key,
  ce.tags,
  ce.created_at,
  ce.updated_at,
  EXTRACT(EPOCH FROM (NOW() - ce.created_at)) * 1000 as age_ms,
  ce.ttl,
  CASE 
    WHEN (EXTRACT(EPOCH FROM (NOW() - ce.created_at)) * 1000) > ce.ttl 
    THEN 'expired' 
    ELSE 'active' 
  END as status,
  jsonb_typeof(ce.cache_value) as value_type,
  jsonb_array_length(ce.cache_value) as array_length
FROM cache_entries ce
ORDER BY ce.created_at DESC;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON cache_entries TO authenticated;
GRANT SELECT, INSERT ON cache_statistics TO authenticated;
GRANT SELECT ON cache_invalidation_log TO authenticated;
GRANT SELECT ON cache_monitoring_view TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION get_cache_statistics(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION invalidate_cache_by_tags(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cache_performance_metrics(INTEGER) TO authenticated;

-- Create RLS policies for security
ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_invalidation_log ENABLE ROW LEVEL SECURITY;

-- RLS policy for cache_entries - users can only see their own cache entries
CREATE POLICY "Users can view their own cache entries" ON cache_entries
  FOR SELECT USING (
    cache_key LIKE 'user_' || auth.uid() || ':%' OR
    cache_key LIKE 'household_' || (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1
    ) || ':%'
  );

CREATE POLICY "Users can insert their own cache entries" ON cache_entries
  FOR INSERT WITH CHECK (
    cache_key LIKE 'user_' || auth.uid() || ':%' OR
    cache_key LIKE 'household_' || (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1
    ) || ':%'
  );

CREATE POLICY "Users can update their own cache entries" ON cache_entries
  FOR UPDATE USING (
    cache_key LIKE 'user_' || auth.uid() || ':%' OR
    cache_key LIKE 'household_' || (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1
    ) || ':%'
  );

CREATE POLICY "Users can delete their own cache entries" ON cache_entries
  FOR DELETE USING (
    cache_key LIKE 'user_' || auth.uid() || ':%' OR
    cache_key LIKE 'household_' || (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1
    ) || ':%'
  );

-- RLS policy for cache_statistics - users can only see their own statistics
CREATE POLICY "Users can view their own cache statistics" ON cache_statistics
  FOR SELECT USING (
    cache_key LIKE 'user_' || auth.uid() || ':%' OR
    cache_key LIKE 'household_' || (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1
    ) || ':%'
  );

CREATE POLICY "Users can insert their own cache statistics" ON cache_statistics
  FOR INSERT WITH CHECK (
    cache_key LIKE 'user_' || auth.uid() || ':%' OR
    cache_key LIKE 'household_' || (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1
    ) || ':%'
  );

-- RLS policy for cache_invalidation_log - users can only see their own logs
CREATE POLICY "Users can view their own cache invalidation logs" ON cache_invalidation_log
  FOR SELECT USING (
    target LIKE 'user_' || auth.uid() || ':%' OR
    target LIKE 'household_' || (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() LIMIT 1
    ) || ':%'
  );

-- Create indexes for better RLS performance
CREATE INDEX IF NOT EXISTS idx_cache_entries_user_key ON cache_entries(cache_key) 
  WHERE cache_key LIKE 'user_%';

CREATE INDEX IF NOT EXISTS idx_cache_entries_household_key ON cache_entries(cache_key) 
  WHERE cache_key LIKE 'household_%';

-- Add comments for documentation
COMMENT ON TABLE cache_entries IS 'Persistent cache storage for application performance optimization';
COMMENT ON TABLE cache_statistics IS 'Cache performance metrics and monitoring data';
COMMENT ON TABLE cache_invalidation_log IS 'Log of cache invalidation operations for debugging';
COMMENT ON FUNCTION cleanup_expired_cache() IS 'Automatically removes expired cache entries';
COMMENT ON FUNCTION get_cache_statistics(INTEGER) IS 'Returns comprehensive cache performance statistics';
COMMENT ON FUNCTION invalidate_cache_by_tags(TEXT[]) IS 'Invalidates all cache entries matching specified tags';
COMMENT ON FUNCTION get_cache_performance_metrics(INTEGER) IS 'Returns real-time cache performance metrics';
