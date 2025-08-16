-- Check the current structure of the users table
-- Run this in your Supabase SQL Editor to see what columns exist

-- Show table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Show sample data (first 3 rows)
SELECT * FROM users LIMIT 3;

-- Check if specific columns exist
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'email'
    ) THEN '✅ email exists' ELSE '❌ email missing' END as email_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN '✅ role exists' ELSE '❌ role missing' END as role_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'xp'
    ) THEN '✅ xp exists' ELSE '❌ xp missing' END as xp_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'coins'
    ) THEN '✅ coins exists' ELSE '❌ coins missing' END as coins_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'has_onboarded'
    ) THEN '✅ has_onboarded exists' ELSE '❌ has_onboarded missing' END as has_onboarded_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'household_id'
    ) THEN '✅ household_id exists' ELSE '❌ household_id missing' END as household_id_status;
