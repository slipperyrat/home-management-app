-- Check the structure of all key tables to identify any remaining issues

-- 1. Check households table structure
SELECT 'HOUSEHOLDS TABLE:' as table_info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'households' 
ORDER BY ordinal_position;

-- 2. Check household_members table structure  
SELECT 'HOUSEHOLD_MEMBERS TABLE:' as table_info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'household_members' 
ORDER BY ordinal_position;

-- 3. Check if specific columns exist in households
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'households' AND column_name = 'plan'
    ) THEN '✅ plan exists' ELSE '❌ plan missing' END as plan_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'households' AND column_name = 'game_mode'
    ) THEN '✅ game_mode exists' ELSE '❌ game_mode missing' END as game_mode_status;

-- 4. Check if household_members has the correct structure
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'household_members' AND column_name = 'id'
    ) THEN '⚠️ id column exists (should be removed)' ELSE '✅ No id column (correct)' END as id_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'household_members' AND column_name = 'user_id'
    ) THEN '✅ user_id exists' ELSE '❌ user_id missing' END as user_id_status,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'household_members' AND column_name = 'household_id'
    ) THEN '✅ household_id exists' ELSE '❌ household_id missing' END as household_id_status;

-- 5. Show sample data from each table
SELECT 'SAMPLE HOUSEHOLDS:' as sample_info;
SELECT * FROM households LIMIT 3;

SELECT 'SAMPLE HOUSEHOLD_MEMBERS:' as sample_info;
SELECT * FROM household_members LIMIT 3;
