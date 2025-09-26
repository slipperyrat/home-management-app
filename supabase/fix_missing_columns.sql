-- Fix missing database columns for Phase 1 features
-- Run this to fix ALL database column errors

-- Add missing meal_type column to meal_plans table
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS meal_type TEXT DEFAULT 'dinner';

-- Add missing recipe_name column to meal_plans table
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS recipe_name TEXT;

-- Add missing planned_for column to meal_plans table
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS planned_for DATE;

-- Fix the shopping_lists alias issue by ensuring the name column exists
ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS name TEXT;

-- Add missing columns for auto-added items functionality
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS auto_added BOOLEAN DEFAULT FALSE;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS pending_confirmation BOOLEAN DEFAULT FALSE;

-- Fix chores table - add missing columns
ALTER TABLE chores ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS xp_reward INTEGER DEFAULT 10;

-- Update any existing shopping items to have proper defaults
UPDATE shopping_items SET auto_added = FALSE WHERE auto_added IS NULL;
UPDATE shopping_items SET pending_confirmation = FALSE WHERE pending_confirmation IS NULL;

-- Update any existing chores to have proper defaults
UPDATE chores SET xp_reward = 10 WHERE xp_reward IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN meal_plans.meal_type IS 'Type of meal (breakfast, lunch, dinner, snack)';
COMMENT ON COLUMN meal_plans.recipe_name IS 'Name of the recipe for this meal plan entry';
COMMENT ON COLUMN meal_plans.planned_for IS 'Date this meal is planned for';
COMMENT ON COLUMN shopping_items.auto_added IS 'Whether this item was automatically added from meal planning';
COMMENT ON COLUMN shopping_items.pending_confirmation IS 'Whether this auto-added item is pending user confirmation';
COMMENT ON COLUMN chores.due_date IS 'Due date for the chore';
COMMENT ON COLUMN chores.xp_reward IS 'XP reward for completing this chore';
