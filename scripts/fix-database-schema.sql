-- 🚨 CRITICAL: Database Schema Fix Script
-- Run this script to align your database with your codebase expectations
-- ⚠️  BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT ⚠️

-- =====================================================
-- PHASE 1: Remove Duplicate Columns
-- =====================================================

-- Remove duplicate 'completed' column from shopping_items (keep 'is_complete')
-- This prevents data inconsistency issues
DO $$ 
BEGIN
    -- Check if the duplicate column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' 
        AND column_name = 'completed'
    ) THEN
        -- Remove the duplicate column
        ALTER TABLE shopping_items DROP COLUMN completed;
        RAISE NOTICE 'Removed duplicate "completed" column from shopping_items';
    ELSE
        RAISE NOTICE 'Column "completed" does not exist in shopping_items';
    END IF;
END $$;

-- =====================================================
-- PHASE 2: Add Missing Essential Columns
-- =====================================================

-- Add missing updated_at columns to core tables
DO $$ 
BEGIN
    -- Add updated_at to households
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'households' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE households ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to households table';
    END IF;

    -- Add updated_at to meal_plans
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_plans' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE meal_plans ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to meal_plans table';
    END IF;

    -- Add created_at to meal_plans
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meal_plans' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE meal_plans ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added created_at column to meal_plans table';
    END IF;
END $$;

-- =====================================================
-- PHASE 3: Add Missing AI and Feature Columns
-- =====================================================

-- Add missing columns to shopping_lists
DO $$ 
BEGIN
    -- Add description column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_lists' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE shopping_lists ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column to shopping_lists table';
    END IF;

    -- Add is_completed column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_lists' 
        AND column_name = 'is_completed'
    ) THEN
        ALTER TABLE shopping_lists ADD COLUMN is_completed BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_completed column to shopping_lists table';
    END IF;

    -- Add ai_suggestions_count column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_lists' 
        AND column_name = 'ai_suggestions_count'
    ) THEN
        ALTER TABLE shopping_lists ADD COLUMN ai_suggestions_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added ai_suggestions_count column to shopping_lists table';
    END IF;

    -- Add ai_confidence column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_lists' 
        AND column_name = 'ai_confidence'
    ) THEN
        ALTER TABLE shopping_lists ADD COLUMN ai_confidence INTEGER DEFAULT 0;
        RAISE NOTICE 'Added ai_confidence column to shopping_lists table';
    END IF;
END $$;

-- Add missing columns to shopping_items
DO $$ 
BEGIN
    -- Add category column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' 
        AND column_name = 'category'
    ) THEN
        ALTER TABLE shopping_items ADD COLUMN category TEXT;
        RAISE NOTICE 'Added category column to shopping_items table';
    END IF;

    -- Add ai_suggested column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' 
        AND column_name = 'ai_suggested'
    ) THEN
        ALTER TABLE shopping_items ADD COLUMN ai_suggested BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added ai_suggested column to shopping_items table';
    END IF;

    -- Add ai_confidence column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'shopping_items' 
        AND column_name = 'ai_confidence'
    ) THEN
        ALTER TABLE shopping_items ADD COLUMN ai_confidence INTEGER DEFAULT 0;
        RAISE NOTICE 'Added ai_confidence column to shopping_items table';
    END IF;
END $$;

-- Add missing columns to chores
DO $$ 
BEGIN
    -- Add points column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chores' 
        AND column_name = 'points'
    ) THEN
        ALTER TABLE chores ADD COLUMN points INTEGER DEFAULT 10;
        RAISE NOTICE 'Added points column to chores table';
    END IF;

    -- Add frequency column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chores' 
        AND column_name = 'frequency'
    ) THEN
        ALTER TABLE chores ADD COLUMN frequency TEXT DEFAULT 'once';
        RAISE NOTICE 'Added frequency column to chores table';
    END IF;
END $$;

-- =====================================================
-- PHASE 4: Fix Users Table for Clerk Integration
-- =====================================================

-- Add missing columns to users table for proper Clerk integration
DO $$ 
BEGIN
    -- Add household_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'household_id'
    ) THEN
        ALTER TABLE users ADD COLUMN household_id UUID;
        RAISE NOTICE 'Added household_id column to users table';
    END IF;

    -- Add onboarding_completed column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'onboarding_completed'
    ) THEN
        ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added onboarding_completed column to users table';
    END IF;

    -- Add created_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added created_at column to users table';
    END IF;

    -- Add updated_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to users table';
    END IF;

    -- Add coins column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'coins'
    ) THEN
        ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0;
        RAISE NOTICE 'Added coins column to users table';
    END IF;
END $$;

-- =====================================================
-- PHASE 5: Create Missing Tables
-- =====================================================

-- Create missing AI-related tables if they don't exist
DO $$ 
BEGIN
    -- Create ai_suggestions table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_suggestions') THEN
        CREATE TABLE ai_suggestions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            household_id UUID NOT NULL,
            parsed_item_id UUID,
            suggestion_type TEXT NOT NULL,
            suggestion_data JSONB NOT NULL DEFAULT '{}',
            ai_reasoning TEXT,
            user_feedback TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created ai_suggestions table';
    END IF;

    -- Create ai_parsed_items table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_parsed_items') THEN
        CREATE TABLE ai_parsed_items (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            email_queue_id UUID,
            household_id UUID NOT NULL,
            item_type TEXT NOT NULL,
            confidence_score DECIMAL(3,2) NOT NULL,
            review_status TEXT DEFAULT 'needs_review',
            review_reason TEXT,
            extracted_data JSONB NOT NULL DEFAULT '{}',
            bill_amount DECIMAL(10,2),
            bill_due_date DATE,
            bill_provider TEXT,
            bill_category TEXT,
            receipt_total DECIMAL(10,2),
            receipt_date DATE,
            receipt_store TEXT,
            receipt_items JSONB,
            event_title TEXT,
            event_date TIMESTAMPTZ,
            event_location TEXT,
            event_description TEXT,
            delivery_date TIMESTAMPTZ,
            delivery_provider TEXT,
            delivery_tracking_number TEXT,
            delivery_status TEXT,
            ai_model_used TEXT,
            processing_time_ms INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created ai_parsed_items table';
    END IF;

    -- Create ai_email_queue table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_email_queue') THEN
        CREATE TABLE ai_email_queue (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            household_id UUID NOT NULL,
            email_subject TEXT NOT NULL,
            email_body TEXT NOT NULL,
            email_from TEXT,
            email_date TIMESTAMPTZ,
            email_attachments JSONB DEFAULT '[]',
            processing_status TEXT DEFAULT 'pending',
            priority INTEGER DEFAULT 1,
            ai_analysis_result JSONB,
            error_message TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            processed_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created ai_email_queue table';
    END IF;

    -- Create automation_rules table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_rules') THEN
        CREATE TABLE automation_rules (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            household_id UUID NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            trigger_types TEXT[] NOT NULL DEFAULT '{}',
            actions JSONB NOT NULL DEFAULT '[]',
            enabled BOOLEAN DEFAULT true,
            created_by TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created automation_rules table';
    END IF;

    -- Create household_events table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'household_events') THEN
        CREATE TABLE household_events (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            household_id UUID NOT NULL,
            event_type TEXT NOT NULL,
            event_data JSONB NOT NULL DEFAULT '{}',
            source TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created household_events table';
    END IF;

    -- Create push_subscriptions table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions') THEN
        CREATE TABLE push_subscriptions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            p256dh_key TEXT NOT NULL,
            auth_key TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created push_subscriptions table';
    END IF;
END $$;

-- =====================================================
-- PHASE 6: Add Indexes for Performance
-- =====================================================

-- Add performance indexes
DO $$ 
BEGIN
    -- Indexes for users table
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_household_id') THEN
        CREATE INDEX idx_users_household_id ON users(household_id);
        RAISE NOTICE 'Created index on users(household_id)';
    END IF;

    -- Indexes for shopping_items table
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_shopping_items_list_id') THEN
        CREATE INDEX idx_shopping_items_list_id ON shopping_items(list_id);
        RAISE NOTICE 'Created index on shopping_items(list_id)';
    END IF;

    -- Indexes for chores table
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chores_household_id') THEN
        CREATE INDEX idx_chores_household_id ON chores(household_id);
        RAISE NOTICE 'Created index on chores(household_id)';
    END IF;

    -- Indexes for ai_suggestions table
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_suggestions_household_id') THEN
        CREATE INDEX idx_ai_suggestions_household_id ON ai_suggestions(household_id);
        RAISE NOTICE 'Created index on ai_suggestions(household_id)';
    END IF;
END $$;

-- =====================================================
-- PHASE 7: Update Existing Data
-- =====================================================

-- Update existing records to have proper timestamps
UPDATE households SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE meal_plans SET updated_at = NOW() WHERE updated_at IS NULL;
UPDATE meal_plans SET created_at = NOW() WHERE created_at IS NULL;

-- Update shopping lists to use is_completed instead of checking for completion
UPDATE shopping_lists 
SET is_completed = true 
WHERE id IN (
    SELECT DISTINCT sl.id 
    FROM shopping_lists sl
    JOIN shopping_items si ON sl.id = si.list_id
    WHERE si.is_complete = true
);

-- =====================================================
-- PHASE 8: Verify Schema Alignment
-- =====================================================

-- Display summary of changes
DO $$ 
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'DATABASE SCHEMA FIX COMPLETE';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE '✅ Removed duplicate columns';
    RAISE NOTICE '✅ Added missing essential columns';
    RAISE NOTICE '✅ Added AI and feature columns';
    RAISE NOTICE '✅ Fixed users table for Clerk integration';
    RAISE NOTICE '✅ Created missing AI-related tables';
    RAISE NOTICE '✅ Added performance indexes';
    RAISE NOTICE '✅ Updated existing data';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Your database schema is now aligned with your codebase!';
    RAISE NOTICE '=====================================================';
END $$;
