-- Check current user's onboarding status and related fields
-- Replace 'YOUR_CLERK_USER_ID' with your actual Clerk user ID

-- Check users table
SELECT 
    clerk_id,
    email,
    role,
    has_onboarded,
    household_id,
    created_at,
    updated_at
FROM users 
WHERE clerk_id = 'YOUR_CLERK_USER_ID';  -- Replace with your actual Clerk user ID

-- Check households table
SELECT 
    id,
    name,
    plan,
    game_mode,
    created_at
FROM households 
WHERE id = (
    SELECT household_id FROM users WHERE clerk_id = 'YOUR_CLERK_USER_ID'
);

-- Check household_members table
SELECT 
    user_id,
    household_id,
    role,
    created_at
FROM household_members 
WHERE user_id = 'YOUR_CLERK_USER_ID';

-- Check if there are any users with has_onboarded = true
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN has_onboarded = true THEN 1 END) as onboarded_users,
    COUNT(CASE WHEN has_onboarded = false THEN 1 END) as not_onboarded_users,
    COUNT(CASE WHEN has_onboarded IS NULL THEN 1 END) as null_onboarded_users
FROM users;
