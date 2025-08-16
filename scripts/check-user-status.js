#!/usr/bin/env node

/**
 * Check User Status in Database
 * This script helps diagnose user data issues
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserStatus() {
  console.log('🔍 Checking database status...\n');

  try {
    // 1. Check if users table exists and has data
    console.log('1️⃣ Checking users table...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5);

    if (usersError) {
      console.error('   ❌ Error accessing users table:', usersError.message);
    } else {
      console.log(`   ✅ Users table accessible, found ${users?.length || 0} users`);
      if (users && users.length > 0) {
        console.log('   📋 Sample user data:');
        users.forEach((user, index) => {
          console.log(`      User ${index + 1}:`, {
            id: user.id,
            email: user.email,
            onboarding_completed: user.onboarding_completed,
            household_id: user.household_id,
            has_onboarded: user.has_onboarded // Check if old field still exists
          });
        });
      }
    }

    // 2. Check if households table exists and has data
    console.log('\n2️⃣ Checking households table...');
    const { data: households, error: householdsError } = await supabase
      .from('households')
      .select('*')
      .limit(5);

    if (householdsError) {
      console.error('   ❌ Error accessing households table:', householdsError.message);
    } else {
      console.log(`   ✅ Households table accessible, found ${households?.length || 0} households`);
      if (households && households.length > 0) {
        console.log('   📋 Sample household data:');
        households.forEach((household, index) => {
          console.log(`      Household ${index + 1}:`, {
            id: household.id,
            name: household.name,
            game_mode: household.game_mode,
            created_by: household.created_by
          });
        });
      }
    }

    // 3. Check if household_members table exists and has data
    console.log('\n3️⃣ Checking household_members table...');
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select('*')
      .limit(5);

    if (membersError) {
      console.error('   ❌ Error accessing household_members table:', membersError.message);
    } else {
      console.log(`   ✅ Household_members table accessible, found ${members?.length || 0} memberships`);
      if (members && members.length > 0) {
        console.log('   📋 Sample membership data:');
        members.forEach((member, index) => {
          console.log(`      Membership ${index + 1}:`, {
            user_id: member.user_id,
            household_id: member.household_id,
            role: member.role
          });
        });
      }
    }

    // 4. Check table structure
    console.log('\n4️⃣ Checking table structure...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_info', { table_name: 'users' });

    if (columnsError) {
      console.log('   ℹ️  Could not get table structure (this is normal)');
    } else {
      console.log('   📋 Users table columns:', columns);
    }

    console.log('\n🎯 Summary:');
    console.log('   - If users table is empty, you need to create a user record');
    console.log('   - If users exist but no household_id, you need to complete onboarding');
    console.log('   - If field names don\'t match, the schema migration may not have run completely');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the check
checkUserStatus();
