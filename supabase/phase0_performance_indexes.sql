-- Phase 0: Performance Indexes and Recurrence Support
-- Run this in your Supabase SQL Editor
-- This script safely adds indexes and handles missing columns gracefully

-- First, let's check what tables and columns actually exist
DO $$
DECLARE
    table_exists boolean;
    column_exists boolean;
BEGIN
    -- Check if shopping_items table exists and has the expected columns
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'shopping_items'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Check if list_id and is_complete columns exist
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'shopping_items' AND column_name = 'list_id'
        ) INTO column_exists;
        
        IF column_exists THEN
            CREATE INDEX IF NOT EXISTS shopping_items_list_complete_idx ON shopping_items (list_id, is_complete);
            RAISE NOTICE 'Created index: shopping_items_list_complete_idx';
        ELSE
            RAISE NOTICE 'Column list_id does not exist in shopping_items table';
        END IF;
        
        -- Check if created_at column exists
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'shopping_items' AND column_name = 'created_at'
        ) INTO column_exists;
        
        IF column_exists THEN
            CREATE INDEX IF NOT EXISTS shopping_items_created_idx ON shopping_items (created_at);
            RAISE NOTICE 'Created index: shopping_items_created_idx';
        ELSE
            RAISE NOTICE 'Column created_at does not exist in shopping_items table';
        END IF;
    END IF;
    
    -- Check if shopping_lists table exists and has household_id
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'shopping_lists'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'shopping_lists' AND column_name = 'household_id'
        ) INTO column_exists;
        
        IF column_exists THEN
            CREATE INDEX IF NOT EXISTS shopping_lists_household_idx ON shopping_lists (household_id);
            RAISE NOTICE 'Created index: shopping_lists_household_idx';
        END IF;
        
        -- Check if created_at column exists
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'shopping_lists' AND column_name = 'created_at'
        ) INTO column_exists;
        
        IF column_exists THEN
            CREATE INDEX IF NOT EXISTS shopping_lists_created_idx ON shopping_lists (created_at);
            RAISE NOTICE 'Created index: shopping_lists_created_idx';
        END IF;
    END IF;
    
    -- Check if household_members table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'household_members'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'household_members' AND column_name = 'household_id'
        ) INTO column_exists;
        
        IF column_exists THEN
            CREATE INDEX IF NOT EXISTS household_members_household_user_idx ON household_members (household_id, user_id);
            RAISE NOTICE 'Created index: household_members_household_user_idx';
        END IF;
    END IF;
    
    -- Check if chores table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'chores'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Add recurrence support for chores (safe to run multiple times)
        BEGIN
            ALTER TABLE chores ADD COLUMN IF NOT EXISTS rrule text;
            RAISE NOTICE 'Added rrule column to chores table (or it already existed)';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not add rrule column: %', SQLERRM;
        END;
        
        BEGIN
            ALTER TABLE chores ADD COLUMN IF NOT EXISTS dtstart timestamptz;
            RAISE NOTICE 'Added dtstart column to chores table (or it already existed)';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not add dtstart column: %', SQLERRM;
        END;
        
        -- Create indexes for chores
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'chores' AND column_name = 'household_id'
        ) INTO column_exists;
        
        IF column_exists THEN
            CREATE INDEX IF NOT EXISTS chores_household_rrule_idx ON chores (household_id);
            RAISE NOTICE 'Created index: chores_household_rrule_idx';
            
            CREATE INDEX IF NOT EXISTS chores_household_status_idx ON chores (household_id, status);
            RAISE NOTICE 'Created index: chores_household_status_idx';
        END IF;
        
        -- Check if assigned_to column exists
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'chores' AND column_name = 'assigned_to'
        ) INTO column_exists;
        
        IF column_exists THEN
            CREATE INDEX IF NOT EXISTS chores_assigned_to_idx ON chores (assigned_to);
            RAISE NOTICE 'Created index: chores_assigned_to_idx';
        END IF;
    END IF;
    
    -- Check if bills table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'bills'
    ) INTO table_exists;
    
    IF table_exists THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'bills' AND column_name = 'household_id'
        ) INTO column_exists;
        
        IF column_exists THEN
            CREATE INDEX IF NOT EXISTS bills_household_due_idx ON bills (household_id, due_date);
            RAISE NOTICE 'Created index: bills_household_due_idx';
        END IF;
    END IF;
    
    -- Check if meal_plans table exists and what columns it has
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'meal_plans'
    ) INTO table_exists;
    
    IF table_exists THEN
        -- Check what date column exists (it might be named differently)
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'meal_plans' AND column_name = 'week_start'
        ) INTO column_exists;
        
        IF column_exists THEN
            CREATE INDEX IF NOT EXISTS meal_plans_household_week_idx ON meal_plans (household_id, week_start);
            RAISE NOTICE 'Created index: meal_plans_household_week_idx';
        ELSE
            -- Check for alternative date column names
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = 'meal_plans' AND column_name = 'week'
            ) INTO column_exists;
            
            IF column_exists THEN
                CREATE INDEX IF NOT EXISTS meal_plans_household_week_idx ON meal_plans (household_id, week);
                RAISE NOTICE 'Created index: meal_plans_household_week_idx using week column';
            END IF;
        END IF;
    END IF;
    
END $$;

-- Verify indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('shopping_items', 'shopping_lists', 'household_members', 'chores', 'bills', 'meal_plans')
  AND schemaname = 'public'
ORDER BY tablename, indexname;
