-- Corrected Test Data Seeding Script for E2E Tests
-- Based on actual database schemas from the codebase
-- Run this in your Supabase SQL editor before running E2E tests

-- Create test household
INSERT INTO households (id, name, created_at, updated_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Household for E2E',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- Create test user (using correct schema)
INSERT INTO users (id, email, role, xp, coins, household_id, onboarding_completed, created_at, updated_at) VALUES (
  'test-user-123',
  'test@example.com',
  'owner',
  0,
  0,
  '550e8400-e29b-41d4-a716-446655440001',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  household_id = EXCLUDED.household_id,
  role = EXCLUDED.role,
  onboarding_completed = EXCLUDED.onboarding_completed,
  updated_at = NOW();

-- Create test shopping list (using 'title' not 'name')
INSERT INTO shopping_lists (id, title, description, household_id, created_by, created_at, updated_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440003',
  'Test Shopping List',
  'List for E2E testing',
  '550e8400-e29b-41d4-a716-446655440001',
  'test-user-123',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Create test shopping items (using 'completed' not 'is_complete')
INSERT INTO shopping_items (id, list_id, name, completed, created_at, updated_at) VALUES 
  ('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 'Milk', false, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'Bread', false, NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'Eggs', false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  completed = EXCLUDED.completed,
  updated_at = NOW();

-- Create test chore
INSERT INTO chores (id, household_id, title, description, created_by, created_at, updated_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440007',
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Chore',
  'Chore for E2E testing',
  'test-user-123',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Create test meal plan
INSERT INTO meal_plans (id, household_id, week_start_date, meals, created_at, updated_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440008',
  '550e8400-e29b-41d4-a716-446655440001',
  '2025-01-20',
  '{"monday": {"breakfast": "550e8400-e29b-41d4-a716-446655440009", "lunch": null, "dinner": null}}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  meals = EXCLUDED.meals,
  updated_at = NOW();

-- Create test recipe (using 'name' not 'title')
INSERT INTO recipes (id, household_id, name, ingredients, instructions, prep_time, cook_time, servings, created_by, created_at, updated_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440009',
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Recipe',
  '[]',
  '{}',
  15,
  30,
  4,
  'test-user-123',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

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
