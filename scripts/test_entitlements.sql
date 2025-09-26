-- Test script for entitlements system
-- Run this to verify the entitlements table and functions work correctly

-- Test 1: Check if entitlements table exists and has data
SELECT 'Test 1: Entitlements table structure' as test_name;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'entitlements' 
ORDER BY ordinal_position;

-- Test 2: Check if all households have entitlements
SELECT 'Test 2: Household entitlements coverage' as test_name;
SELECT 
  COUNT(h.id) as total_households,
  COUNT(e.household_id) as households_with_entitlements,
  COUNT(CASE WHEN e.tier = 'free' THEN 1 END) as free_tier_count,
  COUNT(CASE WHEN e.tier = 'pro' THEN 1 END) as pro_tier_count
FROM households h
LEFT JOIN entitlements e ON h.id = e.household_id;

-- Test 3: Test quota functions
SELECT 'Test 3: Quota functions' as test_name;

-- Test can_perform_action function
SELECT 
  h.id as household_id,
  e.tier,
  e.quota_actions_per_month,
  e.quota_actions_used,
  can_perform_action(h.id) as can_perform_action
FROM households h
JOIN entitlements e ON h.id = e.household_id
LIMIT 5;

-- Test 4: Test subscription upgrade function
SELECT 'Test 4: Subscription upgrade function' as test_name;

-- Create a test household for upgrade testing (if needed)
-- This is just to show how the function would work
DO $$
DECLARE
  test_household_id uuid;
BEGIN
  -- Get a random household for testing
  SELECT id INTO test_household_id FROM households LIMIT 1;
  
  IF test_household_id IS NOT NULL THEN
    -- Test upgrading to Pro
    PERFORM update_entitlements_for_subscription(test_household_id, 'pro', 'test_subscription_123');
    
    -- Check the result
    RAISE NOTICE 'Upgraded household % to Pro tier', test_household_id;
    
    -- Test downgrading to Free
    PERFORM update_entitlements_for_subscription(test_household_id, 'free');
    
    -- Check the result
    RAISE NOTICE 'Downgraded household % to Free tier', test_household_id;
  ELSE
    RAISE NOTICE 'No households found for testing';
  END IF;
END $$;

-- Test 5: Check RLS policies
SELECT 'Test 5: RLS policies' as test_name;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('entitlements', 'calendar_templates', 'quiet_hours', 'calendar_conflicts', 'google_calendar_imports', 'daily_digests')
ORDER BY tablename, policyname;

-- Test 6: Check triggers
SELECT 'Test 6: Triggers' as test_name;
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'households'
ORDER BY trigger_name;

-- Test 7: Sample entitlements data
SELECT 'Test 7: Sample entitlements data' as test_name;
SELECT 
  h.name as household_name,
  e.tier,
  e.history_months,
  e.advanced_rrule,
  e.conflict_detection,
  e.google_import,
  e.digest_max_per_day,
  e.quiet_hours,
  e.quota_actions_per_month,
  e.quota_actions_used
FROM households h
JOIN entitlements e ON h.id = e.household_id
LIMIT 10;

-- Test 8: Check calendar templates
SELECT 'Test 8: Calendar templates' as test_name;
SELECT 
  name,
  template_type,
  rrule,
  jsonb_array_length(events) as event_count
FROM calendar_templates
WHERE household_id IS NULL; -- Default templates

-- Test 9: Verify all MVP tables exist
SELECT 'Test 9: MVP tables verification' as test_name;
SELECT 
  table_name,
  CASE WHEN table_name IN (
    'entitlements',
    'calendar_templates', 
    'quiet_hours',
    'calendar_conflicts',
    'google_calendar_imports',
    'daily_digests'
  ) THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'entitlements',
  'calendar_templates', 
  'quiet_hours',
  'calendar_conflicts',
  'google_calendar_imports',
  'daily_digests'
)
ORDER BY table_name;

-- Test 10: Check function definitions
SELECT 'Test 10: Function definitions' as test_name;
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'create_free_entitlements',
  'update_entitlements_for_subscription',
  'can_perform_action',
  'increment_quota_usage'
)
ORDER BY routine_name;
