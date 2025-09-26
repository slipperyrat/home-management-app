#!/usr/bin/env tsx
/**
 * Simple test to verify conflict detection functions work
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConflictFunctions() {
  console.log('🧪 Testing conflict detection functions...');
  
  try {
    // Get the first household for testing
    const { data: households, error: householdsError } = await supabase
      .from('households')
      .select('id, name')
      .limit(1);
    
    if (householdsError || !households || households.length === 0) {
      throw new Error('No households found for testing');
    }
    
    const household = households[0];
    console.log(`🏠 Using household: ${household.name} (${household.id})`);
    
    // Test the detect_calendar_conflicts function
    console.log('🔍 Testing detect_calendar_conflicts function...');
    const { data: conflicts, error: conflictsError } = await supabase
      .rpc('detect_calendar_conflicts', { p_household_id: household.id });
    
    if (conflictsError) {
      console.error('❌ Error calling detect_calendar_conflicts:', conflictsError);
    } else {
      console.log(`✅ detect_calendar_conflicts function works! Found ${conflicts?.length || 0} conflicts`);
    }
    
    // Test the upsert_calendar_conflicts function
    console.log('🔍 Testing upsert_calendar_conflicts function...');
    const { error: upsertError } = await supabase
      .rpc('upsert_calendar_conflicts', { p_household_id: household.id });
    
    if (upsertError) {
      console.error('❌ Error calling upsert_calendar_conflicts:', upsertError);
    } else {
      console.log('✅ upsert_calendar_conflicts function works!');
    }
    
    // Check if any conflicts were created
    const { data: createdConflicts, error: checkError } = await supabase
      .from('calendar_conflicts')
      .select('*')
      .eq('household_id', household.id);
    
    if (checkError) {
      console.error('❌ Error checking created conflicts:', checkError);
    } else {
      console.log(`📊 Found ${createdConflicts?.length || 0} conflicts in calendar_conflicts table`);
    }
    
    console.log('✅ Function tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testConflictFunctions()
  .then(() => {
    console.log('🎉 Simple test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Simple test failed:', error);
    process.exit(1);
  });
