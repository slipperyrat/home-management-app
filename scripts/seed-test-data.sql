-- Test Data Seeding Script for E2E Tests
-- Run this in your Supabase SQL editor before running E2E tests

-- Create test household
INSERT INTO households (id, name, created_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Household for E2E',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

-- Create test user (if users table exists)
-- Note: You may need to adjust this based on your actual users table structure
INSERT INTO users (id, clerk_id, household_id, role, onboarding_completed, created_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'test-clerk-123',
  '550e8400-e29b-41d4-a716-446655440001',
  'owner',
  true,
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  household_id = EXCLUDED.household_id,
  role = EXCLUDED.role,
  onboarding_completed = EXCLUDED.onboarding_completed;

-- Create test shopping list
INSERT INTO shopping_lists (id, household_id, name, description, created_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Shopping List',
  'List for E2E testing',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Create test shopping items
INSERT INTO shopping_items (id, list_id, name, is_complete, created_at) VALUES 
  ('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 'Milk', false, NOW()),
  ('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'Bread', false, NOW()),
  ('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'Eggs', false, NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_complete = EXCLUDED.is_complete;

-- Create test chore
INSERT INTO chores (id, household_id, title, description, assigned_to, created_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440007',
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Chore',
  'Chore for E2E testing',
  '550e8400-e29b-41d4-a716-446655440002',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description;

-- Create test meal plan
INSERT INTO meal_plans (id, household_id, week_start_date, meals, created_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440008',
  '550e8400-e29b-41d4-a716-446655440001',
  '2025-01-20',
  '{"monday": {"breakfast": "550e8400-e29b-41d4-a716-446655440009", "lunch": null, "dinner": null}}',
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  meals = EXCLUDED.meals;

-- Create test recipe
INSERT INTO recipes (id, household_id, title, description, prep_time, cook_time, servings, created_at) VALUES (
  '550e8400-e29b-41d4-a716-446655440009',
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Recipe',
  'Recipe for E2E testing',
  15,
  30,
  4,
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
WHERE id = '550e8400-e29b-41d4-a716-446655440002'

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
