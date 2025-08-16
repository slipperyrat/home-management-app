#!/usr/bin/env node

/**
 * Fix User Household ID
 * This script fixes the missing household_id field in the users table
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

async function fixUserHousehold() {
  console.log('🔧 Fixing user household ID...\n');

  try {
    // 1. Get the user's household membership
    console.log('1️⃣ Getting user household membership...');
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', 'user_30XWmoPhv9I3BmwBYdlLUv192TT')
      .single();

    if (membershipError) {
      console.error('   ❌ Error getting membership:', membershipError.message);
      return;
    }

    console.log(`   ✅ Found household ID: ${membership.household_id}`);

    // 2. Update the user record with the household_id
    console.log('\n2️⃣ Updating user record...');
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ 
        household_id: membership.household_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'user_30XWmoPhv9I3BmwBYdlLUv192TT')
      .select()
      .single();

    if (updateError) {
      console.error('   ❌ Error updating user:', updateError.message);
      return;
    }

    console.log('   ✅ User updated successfully!');
    console.log('   📋 Updated user data:', {
      id: updatedUser.id,
      email: updatedUser.email,
      household_id: updatedUser.household_id,
      onboarding_completed: updatedUser.onboarding_completed
    });

    // 3. Verify the fix
    console.log('\n3️⃣ Verifying the fix...');
    const { data: verifyUser, error: verifyError } = await supabase
      .from('users')
      .select('*')
      .eq('id', 'user_30XWmoPhv9I3BmwBYdlLUv192TT')
      .single();

    if (verifyError) {
      console.error('   ❌ Error verifying user:', verifyError.message);
      return;
    }

    console.log('   ✅ Verification successful!');
    console.log('   📋 Final user data:', {
      id: verifyUser.id,
      email: verifyUser.email,
      household_id: verifyUser.household_id,
      onboarding_completed: verifyUser.onboarding_completed
    });

    console.log('\n🎉 User household ID fixed successfully!');
    console.log('   - You should now be able to access the inbox without redirects');
    console.log('   - The onboarding system should work properly');
    console.log('   - Try visiting /inbox again');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the fix
fixUserHousehold();
