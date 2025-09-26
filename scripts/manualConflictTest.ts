#!/usr/bin/env tsx
/**
 * Manual test to verify conflict detection functions work
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

async function manualConflictTest() {
  console.log('🧪 Manual conflict detection test...');
  
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
    
    // Get a user from this household
    const { data: members, error: membersError } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', household.id)
      .limit(1);
    
    if (membersError || !members || members.length === 0) {
      throw new Error('No household members found for testing');
    }
    
    const userId = members[0].user_id;
    console.log(`👤 Using user: ${userId}`);
    
    // Clean up any existing test events
    console.log('🧹 Cleaning up existing test events...');
    await supabase
      .from('events')
      .delete()
      .eq('household_id', household.id)
      .like('title', 'Manual Test%');
    
    // Create two overlapping events manually
    console.log('📅 Creating overlapping test events...');
    const now = new Date();
    const baseTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    
    const { data: event1, error: create1Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Manual Test Event 1',
        description: 'Test event for manual testing',
        start_at: new Date(baseTime.getTime() + 9 * 60 * 60 * 1000).toISOString(), // 9 AM
        end_at: new Date(baseTime.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10 AM
        timezone: 'Australia/Melbourne',
        is_all_day: false,
        attendee_user_id: userId,
        created_by: userId,
        source: 'first_party'
      })
      .select('id, title')
      .single();
    
    if (create1Error) {
      throw new Error(`Failed to create first event: ${create1Error.message}`);
    }
    
    const { data: event2, error: create2Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Manual Test Event 2',
        description: 'Test event for manual testing',
        start_at: new Date(baseTime.getTime() + 9 * 30 * 60 * 1000).toISOString(), // 9:30 AM
        end_at: new Date(baseTime.getTime() + 10 * 30 * 60 * 1000).toISOString(), // 10:30 AM
        timezone: 'Australia/Melbourne',
        is_all_day: false,
        attendee_user_id: userId,
        created_by: userId,
        source: 'first_party'
      })
      .select('id, title')
      .single();
    
    if (create2Error) {
      throw new Error(`Failed to create second event: ${create2Error.message}`);
    }
    
    console.log(`✅ Created events: ${event1.title} and ${event2.title}`);
    
    // Manually run conflict detection
    console.log('🔍 Manually running conflict detection...');
    const { error: detectionError } = await supabase
      .rpc('upsert_calendar_conflicts', { p_household_id: household.id });
    
    if (detectionError) {
      console.error('❌ Error running conflict detection:', detectionError);
    } else {
      console.log('✅ Conflict detection function ran successfully');
    }
    
    // Check for conflicts
    const { data: conflicts, error: conflictsError } = await supabase
      .from('calendar_conflicts')
      .select('*')
      .eq('household_id', household.id)
      .eq('is_resolved', false);
    
    if (conflictsError) {
      console.error('❌ Error checking conflicts:', conflictsError);
    } else {
      console.log(`📊 Found ${conflicts?.length || 0} conflicts`);
      
      if (conflicts && conflicts.length > 0) {
        console.log('✅ Conflict detection is working!');
        conflicts.forEach((conflict, index) => {
          console.log(`   ${index + 1}. ${conflict.conflict_type} (${conflict.severity})`);
          console.log(`      Event 1: ${conflict.event1_id}`);
          console.log(`      Event 2: ${conflict.event2_id}`);
        });
      } else {
        console.log('❌ No conflicts detected - there may be an issue with the detection logic');
      }
    }
    
    // Clean up test events
    console.log('\n🧹 Cleaning up test events...');
    await supabase
      .from('events')
      .delete()
      .eq('household_id', household.id)
      .like('title', 'Manual Test%');
    
    console.log('✅ Test completed and cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
manualConflictTest()
  .then(() => {
    console.log('🎉 Manual test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Manual test failed:', error);
    process.exit(1);
  });
