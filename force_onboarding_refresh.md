# Force Onboarding Refresh - Troubleshooting Steps

## Option 1: Force Middleware Cache Refresh
Add this query parameter to any URL to force the middleware to refresh the onboarding cache:
```
https://your-app.vercel.app/inbox?refresh-onboarding=true
```

## Option 2: Manually Set Onboarding Status in Database
Run this SQL in your Supabase SQL Editor:

```sql
-- Replace 'YOUR_CLERK_USER_ID' with your actual Clerk user ID
UPDATE users 
SET has_onboarded = true, 
    updated_at = NOW()
WHERE clerk_id = 'YOUR_CLERK_USER_ID';

-- Verify the update
SELECT clerk_id, email, has_onboarded, updated_at 
FROM users 
WHERE clerk_id = 'YOUR_CLERK_USER_ID';
```

## Option 3: Check Current Status First
Before updating, check your current status:

```sql
-- Check your current user data
SELECT 
    clerk_id,
    email,
    role,
    has_onboarded,
    household_id,
    created_at,
    updated_at
FROM users 
WHERE clerk_id = 'YOUR_CLERK_USER_ID';
```

## Option 4: Complete Onboarding Flow
If you want to go through the proper flow:
1. Go to `/onboarding` 
2. Complete the onboarding steps
3. This should call `/api/onboarding/complete` and set `has_onboarded = true`

## Debug Steps:
1. **Check browser console** for any middleware errors
2. **Check Network tab** to see if `/api/onboarding/complete` is being called
3. **Verify database** that `has_onboarded` is actually `true`
4. **Clear browser cache** and try again
