-- Migrate existing households to have free tier entitlements
-- This script should be run after creating the entitlements table

-- Insert free entitlements for all existing households that don't have them
INSERT INTO entitlements (household_id, tier, history_months, advanced_rrule, conflict_detection, google_import, digest_max_per_day, quiet_hours, quota_actions_per_month)
SELECT 
  h.id,
  'free',
  12,
  false,
  'none',
  false,
  0,
  false,
  400
FROM households h
LEFT JOIN entitlements e ON h.id = e.household_id
WHERE e.household_id IS NULL;

-- Update any existing households that might have old entitlement data
-- (This handles cases where entitlements might have been partially created)
UPDATE entitlements 
SET 
  tier = 'free',
  history_months = 12,
  advanced_rrule = false,
  conflict_detection = 'none',
  google_import = false,
  digest_max_per_day = 0,
  quiet_hours = false,
  quota_actions_per_month = 400,
  updated_at = now()
WHERE tier IS NULL OR tier NOT IN ('free', 'pro');

-- Verify the migration
SELECT 
  COUNT(*) as total_households,
  COUNT(e.household_id) as households_with_entitlements,
  COUNT(CASE WHEN e.tier = 'free' THEN 1 END) as free_tier_households,
  COUNT(CASE WHEN e.tier = 'pro' THEN 1 END) as pro_tier_households
FROM households h
LEFT JOIN entitlements e ON h.id = e.household_id;
