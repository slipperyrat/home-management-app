-- Check actual table schemas to see what columns exist
-- Run this in your Supabase SQL editor first

-- Check households table
SELECT 
  'households' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'households' 
ORDER BY ordinal_position;

-- Check users table
SELECT 
  'users' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check shopping_lists table
SELECT 
  'shopping_lists' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'shopping_lists' 
ORDER BY ordinal_position;

-- Check shopping_items table
SELECT 
  'shopping_items' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'shopping_items' 
ORDER BY ordinal_position;

-- Check chores table
SELECT 
  'chores' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'chores' 
ORDER BY ordinal_position;

-- Check meal_plans table
SELECT 
  'meal_plans' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'meal_plans' 
ORDER BY ordinal_position;

-- Check recipes table
SELECT 
  'recipes' as table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'recipes' 
ORDER BY ordinal_position;
