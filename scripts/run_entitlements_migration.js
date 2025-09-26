#!/usr/bin/env node

/**
 * Run entitlements migration
 * This script applies the entitlements table and related changes to the database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Starting entitlements migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250116_create_entitlements_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing entitlements table creation...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      console.error('❌ Error creating entitlements table:', error);
      throw error;
    }
    
    console.log('✅ Entitlements table created successfully');
    
    // Read the migration script for existing households
    const migratePath = path.join(__dirname, '..', 'supabase', 'migrations', '20250116_migrate_existing_households.sql');
    const migrateSQL = fs.readFileSync(migratePath, 'utf8');
    
    console.log('📄 Migrating existing households...');
    
    // Execute the migration for existing households
    const { data: migrateData, error: migrateError } = await supabase.rpc('exec_sql', {
      sql: migrateSQL
    });
    
    if (migrateError) {
      console.error('❌ Error migrating existing households:', migrateError);
      throw migrateError;
    }
    
    console.log('✅ Existing households migrated successfully');
    
    // Run the test script to verify everything works
    console.log('🧪 Running verification tests...');
    
    const testPath = path.join(__dirname, 'test_entitlements.sql');
    const testSQL = fs.readFileSync(testPath, 'utf8');
    
    const { data: testData, error: testError } = await supabase.rpc('exec_sql', {
      sql: testSQL
    });
    
    if (testError) {
      console.error('❌ Error running tests:', testError);
      throw testError;
    }
    
    console.log('✅ All tests passed successfully');
    
    // Get final statistics
    const { data: stats, error: statsError } = await supabase
      .from('entitlements')
      .select('tier')
      .then(result => {
        if (result.error) throw result.error;
        const counts = result.data.reduce((acc, row) => {
          acc[row.tier] = (acc[row.tier] || 0) + 1;
          return acc;
        }, {});
        return { data: counts, error: null };
      });
    
    if (statsError) {
      console.error('❌ Error getting statistics:', statsError);
    } else {
      console.log('📊 Final statistics:');
      console.log(`   Free tier households: ${stats.free || 0}`);
      console.log(`   Pro tier households: ${stats.pro || 0}`);
    }
    
    console.log('🎉 Entitlements migration completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Check if we're running this script directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
