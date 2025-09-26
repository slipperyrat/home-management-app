# Entitlements System - MVP Pricing Implementation

This document describes the entitlements system that manages feature access per household based on subscription tier for the MVP pricing structure.

## Overview

The entitlements system provides:
- **Feature Gating**: Control access to Pro features based on subscription tier
- **Quota Management**: Track and enforce usage limits per household
- **Subscription Management**: Handle upgrades/downgrades between Free and Pro tiers
- **Audit Logging**: Track subscription changes and feature usage

## Database Schema

### Core Tables

#### `entitlements`
Primary table storing feature access per household:
```sql
CREATE TABLE entitlements (
  household_id uuid PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('free','pro')),
  history_months int NOT NULL DEFAULT 12,
  advanced_rrule boolean NOT NULL DEFAULT false,
  conflict_detection text NOT NULL DEFAULT 'none',
  google_import boolean NOT NULL DEFAULT false,
  digest_max_per_day int NOT NULL DEFAULT 0,
  quiet_hours boolean NOT NULL DEFAULT false,
  quota_actions_per_month int NOT NULL DEFAULT 400,
  quota_actions_used int NOT NULL DEFAULT 0,
  quota_reset_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### Supporting Tables
- `calendar_templates`: Pro feature for pre-built calendar templates
- `quiet_hours`: Pro feature for notification quiet hours
- `calendar_conflicts`: Pro feature for conflict detection
- `google_calendar_imports`: Pro feature for Google Calendar import tracking
- `daily_digests`: Pro feature for daily email digests

## Feature Gates

### Free Tier Features
- Basic calendar and events
- Basic recurrence patterns (daily, weekly, monthly)
- Manual meal planning → grocery list
- Shopping lists
- Chores
- ICS export
- 12 months history
- 400 actions per month

### Pro Tier Features
- Advanced recurrence (RRULE/EXDATE/RDATE with DST safety)
- Conflict detection (basic same-title/same-time)
- Calendar templates (school term, sports training)
- Google Calendar read-only import
- Daily digest (1 per day max)
- Quiet hours (single window)
- 24 months history
- 4,000 actions per month

## API Endpoints

### Entitlements
- `GET /api/entitlements/[householdId]` - Get entitlements for household
- `POST /api/entitlements/[householdId]/can-perform-action` - Check quota
- `POST /api/entitlements/[householdId]/increment-quota` - Increment usage
- `POST /api/entitlements/[householdId]/update-subscription` - Update tier

### Pro Features
- `GET /api/calendar-templates` - Get calendar templates
- `GET /api/quiet-hours` - Get quiet hours settings
- `POST /api/quiet-hours` - Update quiet hours
- `GET /api/calendar-conflicts` - Get calendar conflicts
- `POST /api/calendar-conflicts/[id]/resolve` - Resolve conflict
- `GET /api/google-calendar-imports` - Get import status
- `GET /api/daily-digests` - Get digest history

## Usage Examples

### Check Feature Access
```typescript
import { canAccessFeature, getEntitlements } from '@/lib/entitlements';

const entitlements = await getEntitlements(householdId);
const canUseAdvancedRRule = canAccessFeature(entitlements, 'advanced_rrule');
```

### Check Quota Before Action
```typescript
import { canPerformAction, incrementQuotaUsage } from '@/lib/entitlements';

const canPerform = await canPerformAction(householdId);
if (canPerform) {
  // Perform the action
  await performSomeAction();
  await incrementQuotaUsage(householdId);
} else {
  // Show quota exceeded message
}
```

### Update Subscription
```typescript
import { updateEntitlementsForSubscription } from '@/lib/entitlements';

// Upgrade to Pro
await updateEntitlementsForSubscription(householdId, 'pro', 'sub_123');

// Downgrade to Free
await updateEntitlementsForSubscription(householdId, 'free');
```

## Database Functions

### `create_free_entitlements()`
Automatically creates free tier entitlements when a new household is created.

### `update_entitlements_for_subscription(household_id, tier, stripe_subscription_id)`
Updates entitlements when subscription changes.

### `can_perform_action(household_id)`
Checks if household can perform an action based on quota.

### `increment_quota_usage(household_id)`
Increments quota usage counter.

## Migration

### Running the Migration
```bash
# Run the migration script
node scripts/run_entitlements_migration.js

# Or run SQL directly
psql -d your_database -f supabase/migrations/20250116_create_entitlements_table.sql
psql -d your_database -f supabase/migrations/20250116_migrate_existing_households.sql
```

### Testing the Migration
```bash
# Run the test script
psql -d your_database -f scripts/test_entitlements.sql
```

## Security

### Row Level Security (RLS)
All tables have RLS policies that ensure users can only access data for their household.

### API Authentication
All API endpoints verify user authentication and household membership.

### Audit Logging
Subscription changes are logged in the `audit_log` table for compliance.

## Monitoring

### Quota Usage
- Track quota usage percentage
- Alert when approaching limits (80%+)
- Block actions when quota exceeded

### Feature Adoption
- Monitor Pro feature usage
- Track upgrade/downgrade patterns
- Analyze conversion rates

## Troubleshooting

### Common Issues

1. **Entitlements not created for new household**
   - Check if trigger is properly installed
   - Verify RLS policies allow inserts

2. **Quota not incrementing**
   - Check if `increment_quota_usage` function is called
   - Verify quota reset date logic

3. **Feature gates not working**
   - Verify entitlements are loaded correctly
   - Check feature gate mapping

### Debug Queries
```sql
-- Check entitlements for a household
SELECT * FROM entitlements WHERE household_id = 'your-household-id';

-- Check quota usage
SELECT 
  household_id,
  quota_actions_used,
  quota_actions_per_month,
  ROUND((quota_actions_used::float / quota_actions_per_month) * 100, 2) as usage_percentage
FROM entitlements;

-- Check recent subscription changes
SELECT * FROM audit_log 
WHERE action = 'subscription.change' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Future Enhancements

### Post-MVP Features
- Multi-household support
- Advanced analytics
- Custom quota limits
- Usage-based pricing tiers

### Performance Optimizations
- Caching entitlements in Redis
- Batch quota updates
- Async audit logging

## Support

For issues with the entitlements system:
1. Check the audit log for errors
2. Verify RLS policies are correct
3. Test with the provided SQL scripts
4. Review API endpoint logs
