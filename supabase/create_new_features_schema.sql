-- Create new tables for meal planner and collaborative planner features

-- 1. Add household_id column to users table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'household_id'
  ) THEN
    ALTER TABLE users ADD COLUMN household_id UUID REFERENCES households(id);
  END IF;
END $$;

-- 2. Update users table to link existing users to their households
-- This updates users who are in household_members but don't have household_id set
UPDATE users 
SET household_id = hm.household_id
FROM household_members hm 
WHERE users.id = hm.user_id 
AND users.household_id IS NULL;

-- 3. Recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  ingredients JSONB NOT NULL DEFAULT '[]',
  instructions TEXT[] NOT NULL DEFAULT '{}',
  prep_time INTEGER NOT NULL DEFAULT 0,
  cook_time INTEGER NOT NULL DEFAULT 0,
  servings INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Meal plans table
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  meals JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, week_start_date)
);

-- 5. Planner items table
CREATE TABLE IF NOT EXISTS planner_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_household_id ON recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_plans_household_week ON meal_plans(household_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_planner_items_household_id ON planner_items(household_id);
CREATE INDEX IF NOT EXISTS idx_planner_items_category ON planner_items(category);
CREATE INDEX IF NOT EXISTS idx_planner_items_status ON planner_items(status);
CREATE INDEX IF NOT EXISTS idx_planner_items_created_at ON planner_items(created_at DESC);

-- Table comments
COMMENT ON TABLE recipes IS 'Stores household recipes with ingredients and instructions';
COMMENT ON TABLE meal_plans IS 'Stores weekly meal plans with assigned recipes for each day/meal';
COMMENT ON TABLE planner_items IS 'Stores collaborative planning items for trips, renovations, goals, etc.';
