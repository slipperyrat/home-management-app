-- 🔍 SCHEMA VERIFICATION SCRIPT
-- Run this AFTER running the schema fix script to verify all changes

-- =====================================================
-- VERIFY SCHEMA ALIGNMENT
-- =====================================================

-- Check if duplicate 'completed' column was removed
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' 
        AND column_name = 'completed'
    ) THEN
        RAISE WARNING '❌ Duplicate "completed" column still exists in shopping_items';
    ELSE
        RAISE NOTICE '✅ Duplicate "completed" column successfully removed from shopping_items';
    END IF;
END $$;

-- =====================================================
-- VERIFY ESSENTIAL COLUMNS EXIST
-- =====================================================

-- Check households table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'households' 
        AND column_name = 'updated_at'
    ) THEN
        RAISE NOTICE '✅ households.updated_at column exists';
    ELSE
        RAISE WARNING '❌ households.updated_at column missing';
    END IF;
END $$;

-- Check meal_plans table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_plans' 
        AND column_name = 'updated_at'
    ) THEN
        RAISE NOTICE '✅ meal_plans.updated_at column exists';
    ELSE
        RAISE WARNING '❌ meal_plans.updated_at column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_plans' 
        AND column_name = 'created_at'
    ) THEN
        RAISE NOTICE '✅ meal_plans.created_at column exists';
    ELSE
        RAISE WARNING '❌ meal_plans.created_at column missing';
    END IF;
END $$;

-- =====================================================
-- VERIFY AI AND FEATURE COLUMNS
-- =====================================================

-- Check shopping_lists table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_lists' 
        AND column_name = 'description'
    ) THEN
        RAISE NOTICE '✅ shopping_lists.description column exists';
    ELSE
        RAISE WARNING '❌ shopping_lists.description column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_lists' 
        AND column_name = 'is_completed'
    ) THEN
        RAISE NOTICE '✅ shopping_lists.is_completed column exists';
    ELSE
        RAISE WARNING '❌ shopping_lists.is_completed column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_lists' 
        AND column_name = 'ai_suggestions_count'
    ) THEN
        RAISE NOTICE '✅ shopping_lists.ai_suggestions_count column exists';
    ELSE
        RAISE WARNING '❌ shopping_lists.ai_suggestions_count column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_lists' 
        AND column_name = 'ai_confidence'
    ) THEN
        RAISE NOTICE '✅ shopping_lists.ai_confidence column exists';
    ELSE
        RAISE WARNING '❌ shopping_lists.ai_confidence column missing';
    END IF;
END $$;

-- Check shopping_items table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' 
        AND column_name = 'category'
    ) THEN
        RAISE NOTICE '✅ shopping_items.category column exists';
    ELSE
        RAISE WARNING '❌ shopping_items.category column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' 
        AND column_name = 'ai_suggested'
    ) THEN
        RAISE NOTICE '✅ shopping_items.ai_suggested column exists';
    ELSE
        RAISE WARNING '❌ shopping_items.ai_suggested column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' 
        AND column_name = 'ai_confidence'
    ) THEN
        RAISE NOTICE '✅ shopping_items.ai_confidence column exists';
    ELSE
        RAISE WARNING '❌ shopping_items.ai_confidence column missing';
    END IF;
END $$;

-- Check chores table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chores' 
        AND column_name = 'points'
    ) THEN
        RAISE NOTICE '✅ chores.points column exists';
    ELSE
        RAISE WARNING '❌ chores.points column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chores' 
        AND column_name = 'frequency'
    ) THEN
        RAISE NOTICE '✅ chores.frequency column exists';
    ELSE
        RAISE WARNING '❌ chores.frequency column missing';
    END IF;
END $$;

-- =====================================================
-- VERIFY USERS TABLE CLERK INTEGRATION
-- =====================================================

-- Check users table
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'household_id'
    ) THEN
        RAISE NOTICE '✅ users.household_id column exists';
    ELSE
        RAISE WARNING '❌ users.household_id column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'onboarding_completed'
    ) THEN
        RAISE NOTICE '✅ users.onboarding_completed column exists';
    ELSE
        RAISE WARNING '❌ users.onboarding_completed column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'created_at'
    ) THEN
        RAISE NOTICE '✅ users.created_at column exists';
    ELSE
        RAISE WARNING '❌ users.created_at column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'updated_at'
    ) THEN
        RAISE NOTICE '✅ users.updated_at column exists';
    ELSE
        RAISE WARNING '❌ users.updated_at column missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'coins'
    ) THEN
        RAISE NOTICE '✅ users.coins column exists';
    ELSE
        RAISE WARNING '❌ users.coins column missing';
    END IF;
END $$;

-- =====================================================
-- VERIFY MISSING TABLES WERE CREATED
-- =====================================================

-- Check AI-related tables
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_suggestions') THEN
        RAISE NOTICE '✅ ai_suggestions table exists';
    ELSE
        RAISE WARNING '❌ ai_suggestions table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_parsed_items') THEN
        RAISE NOTICE '✅ ai_parsed_items table exists';
    ELSE
        RAISE WARNING '❌ ai_parsed_items table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_email_queue') THEN
        RAISE NOTICE '✅ ai_email_queue table exists';
    ELSE
        RAISE WARNING '❌ ai_email_queue table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_rules') THEN
        RAISE NOTICE '✅ automation_rules table exists';
    ELSE
        RAISE WARNING '❌ automation_rules table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_events') THEN
        RAISE NOTICE '✅ household_events table exists';
    ELSE
        RAISE WARNING '❌ household_events table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions') THEN
        RAISE NOTICE '✅ push_subscriptions table exists';
    ELSE
        RAISE WARNING '❌ push_subscriptions table missing';
    END IF;
END $$;

-- =====================================================
-- VERIFY PERFORMANCE INDEXES
-- =====================================================

-- Check indexes
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_users_household_id'
    ) THEN
        RAISE NOTICE '✅ idx_users_household_id index exists';
    ELSE
        RAISE WARNING '❌ idx_users_household_id index missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_shopping_items_list_id'
    ) THEN
        RAISE NOTICE '✅ idx_shopping_items_list_id index exists';
    ELSE
        RAISE WARNING '❌ idx_shopping_items_list_id index missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_chores_household_id'
    ) THEN
        RAISE NOTICE '✅ idx_chores_household_id index exists';
    ELSE
        RAISE WARNING '❌ idx_chores_household_id index missing';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_ai_suggestions_household_id'
    ) THEN
        RAISE NOTICE '✅ idx_ai_suggestions_household_id index exists';
    ELSE
        RAISE WARNING '❌ idx_ai_suggestions_household_id index missing';
    END IF;
END $$;

-- =====================================================
-- FINAL VERIFICATION SUMMARY
-- =====================================================

-- Show final schema status
DO $$ 
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'SCHEMA VERIFICATION COMPLETE';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Check the output above for any ❌ warnings';
    RAISE NOTICE 'All ✅ items indicate successful schema alignment';
    RAISE NOTICE '=====================================================';
    
    -- Count total columns in key tables
    DECLARE
        households_cols integer;
        users_cols integer;
        shopping_lists_cols integer;
        shopping_items_cols integer;
        chores_cols integer;
        meal_plans_cols integer;
    BEGIN
        SELECT COUNT(*) INTO households_cols 
        FROM information_schema.columns 
        WHERE table_name = 'households';
        
        SELECT COUNT(*) INTO users_cols 
        FROM information_schema.columns 
        WHERE table_name = 'users';
        
        SELECT COUNT(*) INTO shopping_lists_cols 
        FROM information_schema.columns 
        WHERE table_name = 'shopping_lists';
        
        SELECT COUNT(*) INTO shopping_items_cols 
        FROM information_schema.columns 
        WHERE table_name = 'shopping_items';
        
        SELECT COUNT(*) INTO chores_cols 
        FROM information_schema.columns 
        WHERE table_name = 'chores';
        
        SELECT COUNT(*) INTO meal_plans_cols 
        FROM information_schema.columns 
        WHERE table_name = 'meal_plans';
        
        RAISE NOTICE 'Final table column counts:';
        RAISE NOTICE '  households: % columns', households_cols;
        RAISE NOTICE '  users: % columns', users_cols;
        RAISE NOTICE '  shopping_lists: % columns', shopping_lists_cols;
        RAISE NOTICE '  shopping_items: % columns', shopping_items_cols;
        RAISE NOTICE '  chores: % columns', chores_cols;
        RAISE NOTICE '  meal_plans: % columns', meal_plans_cols;
    END;
    
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'If all checks passed, your schema is now aligned!';
    RAISE NOTICE '=====================================================';
END $$;





