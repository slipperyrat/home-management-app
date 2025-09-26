-- Phase 0: Performance Indexes for Home Management App
-- This file adds critical performance indexes for hot paths

-- Hot paths for performance (most critical)
CREATE INDEX IF NOT EXISTS shopping_items_list_complete_idx ON shopping_items (list_id, is_complete);
CREATE INDEX IF NOT EXISTS shopping_lists_household_idx ON shopping_lists (household_id);
CREATE INDEX IF NOT EXISTS household_members_household_user_idx ON household_members (household_id, user_id);

-- Timestamps for sorting and analytics
CREATE INDEX IF NOT EXISTS shopping_items_created_idx ON shopping_items (created_at);
CREATE INDEX IF NOT EXISTS shopping_lists_created_idx ON shopping_lists (created_at);
CREATE INDEX IF NOT EXISTS chores_created_idx ON chores (created_at);
CREATE INDEX IF NOT EXISTS meal_plans_created_idx ON meal_plans (created_at);

-- Additional performance indexes for common queries
CREATE INDEX IF NOT EXISTS chores_household_status_idx ON chores (household_id, status);
CREATE INDEX IF NOT EXISTS chores_assigned_to_idx ON chores (assigned_to);
CREATE INDEX IF NOT EXISTS bills_household_due_idx ON bills (household_id, due_date);
CREATE INDEX IF NOT EXISTS bills_household_paid_idx ON bills (household_id, paid_date);
CREATE INDEX IF NOT EXISTS recipes_household_idx ON recipes (household_id);
CREATE INDEX IF NOT EXISTS rewards_household_idx ON rewards (household_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_household_idx ON notifications (household_id);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS chores_household_assigned_status_idx ON chores (household_id, assigned_to, status);
CREATE INDEX IF NOT EXISTS shopping_items_list_complete_created_idx ON shopping_items (list_id, is_complete, created_at);

-- Text search indexes for better performance
CREATE INDEX IF NOT EXISTS shopping_items_name_gin_idx ON shopping_items USING gin (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS chores_title_gin_idx ON chores USING gin (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS recipes_title_gin_idx ON recipes USING gin (to_tsvector('english', title));

-- Partial indexes for active/incomplete items
CREATE INDEX IF NOT EXISTS chores_active_idx ON chores (household_id, status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS shopping_items_incomplete_idx ON shopping_items (list_id) WHERE is_complete = false;

-- Indexes for foreign key lookups
CREATE INDEX IF NOT EXISTS shopping_items_list_id_idx ON shopping_items (list_id);
CREATE INDEX IF NOT EXISTS chores_household_id_idx ON chores (household_id);
CREATE INDEX IF NOT EXISTS meal_plans_household_idx ON meal_plans (household_id);
CREATE INDEX IF NOT EXISTS calendar_events_household_idx ON calendar_events (household_id);

-- Performance monitoring: Add slow query logging
-- Note: This requires superuser privileges in Supabase
-- ALTER SYSTEM SET log_min_duration_statement = '1000'; -- Log queries taking >1 second
-- ALTER SYSTEM SET log_statement = 'all'; -- Log all statements (development only)

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND tablename IN ('shopping_items', 'shopping_lists', 'chores', 'bills', 'recipes', 'meal_plans')
ORDER BY tablename, indexname;
