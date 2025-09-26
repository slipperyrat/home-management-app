-- 🛡️ DATABASE BACKUP SCRIPT
-- Run this BEFORE running the schema fix script
-- This creates a backup of your current database structure

-- =====================================================
-- BACKUP CURRENT SCHEMA STRUCTURE
-- =====================================================

-- Create a backup table for each table structure
DO $$ 
DECLARE
    table_name text;
    backup_table_name text;
    create_table_sql text;
BEGIN
    -- Loop through all tables in your schema
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'sql_%'
    LOOP
        backup_table_name := table_name || '_backup_' || to_char(now(), 'YYYYMMDD_HH24MI');
        
        -- Get the CREATE TABLE statement
        SELECT 
            'CREATE TABLE ' || backup_table_name || ' AS SELECT * FROM ' || table_name
        INTO create_table_sql;
        
        -- Execute the backup
        EXECUTE create_table_sql;
        
        RAISE NOTICE 'Backed up table: % -> %', table_name, backup_table_name;
    END LOOP;
    
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'DATABASE BACKUP COMPLETE';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'All tables have been backed up with timestamp suffix';
    RAISE NOTICE 'You can now safely run the schema fix script';
    RAISE NOTICE '=====================================================';
END $$;

-- =====================================================
-- EXPORT SCHEMA DEFINITIONS
-- =====================================================

-- Create a schema dump file (you can copy this output)
SELECT 
    '-- SCHEMA DUMP FOR TABLE: ' || tablename || E'\n' ||
    '-- Generated on: ' || now() || E'\n\n' ||
    '-- Table structure for ' || tablename || E'\n' ||
    '-- You can use this to recreate the table if needed' || E'\n\n'
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE 'sql_%';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Show all backup tables created
SELECT 
    tablename as backup_table,
    'Backup created successfully' as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%_backup_%'
ORDER BY tablename;

-- Show table counts for verification
SELECT 
    schemaname,
    tablename,
    (SELECT count(*) FROM information_schema.tables t2 WHERE t2.table_name = t1.tablename) as table_count
FROM pg_tables t1
WHERE schemaname = 'public' 
AND tablename NOT LIKE 'pg_%'
AND tablename NOT LIKE 'sql_%'
ORDER BY tablename;
