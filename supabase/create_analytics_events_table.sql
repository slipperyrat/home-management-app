-- Create analytics events table for tracking feature usage and business metrics
-- This table stores all analytics events for reporting and analysis

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  user_id TEXT,
  household_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_household_id ON analytics_events(household_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_timestamp ON analytics_events(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_household_timestamp ON analytics_events(household_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_timestamp ON analytics_events(event_type, timestamp);

-- Add RLS policies
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own analytics events
CREATE POLICY "Users can view their own analytics events" ON analytics_events
    FOR SELECT USING (
        user_id = auth.uid()::text
    );

-- Users can insert their own analytics events
CREATE POLICY "Users can insert their own analytics events" ON analytics_events
    FOR INSERT WITH CHECK (
        user_id = auth.uid()::text
    );

-- Add comments for documentation
COMMENT ON TABLE analytics_events IS 'Stores analytics events for feature usage tracking and business metrics';
COMMENT ON COLUMN analytics_events.event_type IS 'Type of analytics event (feature_used, subscription_created, etc.)';
COMMENT ON COLUMN analytics_events.properties IS 'Event-specific properties and data';
COMMENT ON COLUMN analytics_events.user_id IS 'ID of the user who triggered the event';
COMMENT ON COLUMN analytics_events.household_id IS 'ID of the household associated with the event';
COMMENT ON COLUMN analytics_events.timestamp IS 'When the event occurred';
COMMENT ON COLUMN analytics_events.metadata IS 'Additional metadata about the event';

-- Create a function to get analytics summary for a household
CREATE OR REPLACE FUNCTION get_analytics_summary(household_id_param UUID, days INTEGER DEFAULT 30)
RETURNS TABLE(
    event_type TEXT,
    event_count BIGINT,
    unique_users BIGINT,
    first_event TIMESTAMPTZ,
    last_event TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ae.event_type,
        COUNT(*) as event_count,
        COUNT(DISTINCT ae.user_id) as unique_users,
        MIN(ae.timestamp) as first_event,
        MAX(ae.timestamp) as last_event
    FROM analytics_events ae
    WHERE ae.household_id = household_id_param
      AND ae.timestamp >= NOW() - INTERVAL '1 day' * days
    GROUP BY ae.event_type
    ORDER BY event_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get feature usage statistics
CREATE OR REPLACE FUNCTION get_feature_usage_stats(household_id_param UUID, days INTEGER DEFAULT 30)
RETURNS TABLE(
    feature TEXT,
    usage_count BIGINT,
    unique_users BIGINT,
    last_used TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ae.properties->>'feature' as feature,
        COUNT(*) as usage_count,
        COUNT(DISTINCT ae.user_id) as unique_users,
        MAX(ae.timestamp) as last_used
    FROM analytics_events ae
    WHERE ae.household_id = household_id_param
      AND ae.event_type = 'feature_used'
      AND ae.timestamp >= NOW() - INTERVAL '1 day' * days
    GROUP BY ae.properties->>'feature'
    ORDER BY usage_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON FUNCTION get_analytics_summary(UUID, INTEGER) IS 'Returns analytics summary for a household over specified days';
COMMENT ON FUNCTION get_feature_usage_stats(UUID, INTEGER) IS 'Returns feature usage statistics for a household over specified days';
