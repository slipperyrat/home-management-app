-- Working Test Data Seeding Script for E2E Tests
-- Based on ACTUAL database schema from Supabase inspection
-- Run this in your Supabase SQL Editor before running E2E tests

-- Create test household (using actual schema)
INSERT INTO households (id, name, created_at, plan, game_mode, created_by) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Household for E2E',
  NOW(),
  'free',
  'default',
  'test-user-123'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  plan = EXCLUDED.plan,
  game_mode = EXCLUDED.game_mode,
  created_by = EXCLUDED.created_by;

-- Create test user (using actual Clerk schema)
INSERT INTO users (id, email, role, xp) VALUES (
  'test-user-123',
  'test@example.com',
  'owner',
  0
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  xp = EXCLUDED.xp;

-- Create test shopping list (using actual schema - 'title' not 'name')
INSERT INTO shopping_lists (id, title, household_id, created_by, created_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440003',
  'Test Shopping List',
  '550e8400-e29b-41d4-a716-446655440001',
  'test-user-123',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  household_id = EXCLUDED.household_id,
  created_by = EXCLUDED.created_by;

-- Create test shopping items (using actual schema - 'is_complete' not 'completed')
INSERT INTO shopping_items (id, list_id, name, is_complete, created_at) VALUES 
  ('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 'Milk', false, NOW()),
  ('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'Bread', false, NOW()),
  ('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'Eggs', false, NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_complete = EXCLUDED.is_complete;

-- Create test chore (using actual schema with AI columns)
INSERT INTO chores (id, household_id, title, description, assigned_to, created_by, created_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440007',
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Chore',
  'Chore for E2E testing',
  'test-user-123',
  'test-user-123',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  assigned_to = EXCLUDED.assigned_to;

-- Create test meal plan (using actual schema)
INSERT INTO meal_plans (id, household_id, week_start_date, meals) VALUES (
  '550e8400-e29b-41d4-a716-446655440008',
  '550e8400-e29b-41d4-a716-446655440001',
  '2025-01-20',
  '{"monday": {"breakfast": "550e8400-e29b-41d4-a716-446655440009", "lunch": null, "dinner": null}}'
) ON CONFLICT (id) DO UPDATE SET
  meals = EXCLUDED.meals;

-- Create test recipe (using actual schema - 'title' not 'name')
INSERT INTO recipes (id, household_id, title, description, ingredients, prep_time, cook_time, servings, created_by, created_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440009',
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Recipe',
  'Recipe for E2E testing',
  '[]',
  15,
  30,
  4,
  'test-user-123',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description;

-- Verify test data was created
SELECT 
  'households' as table_name,
  COUNT(*) as record_count
FROM households 
WHERE id = '550e8400-e29b-41d4-a716-446655440001'

UNION ALL

SELECT 
  'users' as table_name,
  COUNT(*) as record_count
FROM users 
WHERE id = 'test-user-123'

UNION ALL

SELECT 
  'shopping_lists' as table_name,
  COUNT(*) as record_count
FROM shopping_lists 
WHERE id = '550e8400-e29b-41d4-a716-446655440003'

UNION ALL

SELECT 
  'shopping_items' as table_name,
  COUNT(*) as record_count
FROM shopping_items 
WHERE list_id = '550e8400-e29b-41d4-a716-446655440003'

UNION ALL

SELECT 
  'chores' as table_name,
  COUNT(*) as record_count
FROM chores 
WHERE id = '550e8400-e29b-41d4-a716-446655440007'

UNION ALL

SELECT 
  'meal_plans' as table_name,
  COUNT(*) as record_count
FROM meal_plans 
WHERE id = '550e8400-e29b-41d4-a716-446655440008'

UNION ALL

SELECT 
  'recipes' as table_name,
  COUNT(*) as record_count
FROM recipes 
WHERE id = '550e8400-e29b-41d4-a716-446655440009';
