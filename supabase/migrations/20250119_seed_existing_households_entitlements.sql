-- Seed free entitlements for existing households that don't have them
-- This ensures all existing households have proper entitlements for MVP

-- Insert free entitlements for households that don't have them yet
INSERT INTO entitlements (
  household_id, 
  tier, 
  history_months, 
  advanced_rrule, 
  conflict_detection, 
  google_import, 
  digest_max_per_day, 
  quiet_hours, 
  quota_actions_per_month
)
SELECT 
  h.id as household_id,
  'free' as tier,
  12 as history_months,
  false as advanced_rrule,
  'none' as conflict_detection,
  false as google_import,
  0 as digest_max_per_day,
  false as quiet_hours,
  400 as quota_actions_per_month
FROM households h
LEFT JOIN entitlements e ON h.id = e.household_id
WHERE e.household_id IS NULL;

-- Add comment for documentation
COMMENT ON TABLE entitlements IS 'Manages feature access per household based on subscription tier - MVP structure with Free/Pro tiers';

