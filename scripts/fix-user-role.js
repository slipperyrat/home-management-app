#!/usr/bin/env node

/**
 * Fix User Role to Owner
 * This script changes the user role from 'member' to 'owner' to allow automation rule creation
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

async function fixUserRole() {
  console.log('🔧 Fixing user role to owner...\n');

  try {
    // 1. Update user role in household_members table
    console.log('1️⃣ Updating user role in household_members...');
    const { data: updatedMembership, error: membershipError } = await supabase
      .from('household_members')
      .update({ 
        role: 'owner'
      })
      .eq('user_id', 'user_30XWmoPhv9I3BmwBYdlLUv192TT')
      .select()
      .single();

    if (membershipError) {
      console.error('   ❌ Error updating membership:', membershipError.message);
      return;
    }

    console.log('   ✅ Membership updated successfully!');
    console.log('   📋 Updated membership data:', {
      user_id: updatedMembership.user_id,
      household_id: updatedMembership.household_id,
      role: updatedMembership.role
    });

    // 2. Update user role in users table
    console.log('\n2️⃣ Updating user role in users table...');
    const { data: updatedUser, error: userError } = await supabase
      .from('users')
      .update({ 
        role: 'owner',
        updated_at: new Date().toISOString()
      })
      .eq('id', 'user_30XWmoPhv9I3BmwBYdlLUv192TT')
      .select()
      .single();

    if (userError) {
      console.error('   ❌ Error updating user:', userError.message);
      return;
    }

    console.log('   ✅ User updated successfully!');
    console.log('   📋 Updated user data:', {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      household_id: updatedUser.household_id
    });

    // 3. Verify the fix
    console.log('\n3️⃣ Verifying the fix...');
    const { data: verifyMembership, error: verifyError } = await supabase
      .from('household_members')
      .select('*')
      .eq('user_id', 'user_30XWmoPhv9I3BmwBYdlLUv192TT')
      .single();

    if (verifyError) {
      console.error('   ❌ Error verifying membership:', verifyError.message);
      return;
    }

    console.log('   ✅ Verification successful!');
    console.log('   📋 Final membership data:', {
      user_id: verifyMembership.user_id,
      household_id: verifyMembership.household_id,
      role: verifyMembership.role
    });

    console.log('\n🎉 User role fixed successfully!');
    console.log('   - You now have "owner" role');
    console.log('   - You can create automation rules');
    console.log('   - Try "Create Test Rule" again');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the fix
fixUserRole();
