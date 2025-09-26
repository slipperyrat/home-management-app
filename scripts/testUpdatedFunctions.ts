#!/usr/bin/env tsx
/**
 * Test the updated conflict detection functions
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

async function testUpdatedFunctions() {
  console.log('🧪 Testing updated conflict detection functions...');
  
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
      .like('title', 'Updated Test%');
    
    // Create overlapping events without triggers (by using minimal fields first, then updating)
    console.log('📅 Creating overlapping events...');
    const now = new Date();
    const baseTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    
    // Create first event with minimal fields
    const { data: event1, error: create1Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Updated Test Event 1',
        start_at: baseTime.toISOString(),
        end_at: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString(),
        created_by: userId
      })
      .select('id, title')
      .single();
    
    if (create1Error) {
      throw new Error(`Failed to create first event: ${create1Error.message}`);
    }
    
    // Create second event with minimal fields
    const { data: event2, error: create2Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Updated Test Event 2',
        start_at: new Date(baseTime.getTime() + 30 * 60 * 1000).toISOString(), // +30 minutes
        end_at: new Date(baseTime.getTime() + 90 * 60 * 1000).toISOString(), // +90 minutes
        created_by: userId
      })
      .select('id, title')
      .single();
    
    if (create2Error) {
      throw new Error(`Failed to create second event: ${create2Error.message}`);
    }
    
    console.log(`✅ Created events: ${event1.title} and ${event2.title}`);
    
    // Now update them to add attendee_user_id (this should trigger the conflict detection)
    console.log('📅 Adding attendee_user_id to events...');
    
    const { error: update1Error } = await supabase
      .from('events')
      .update({ attendee_user_id: userId })
      .eq('id', event1.id);
    
    if (update1Error) {
      console.error('❌ Error updating first event:', update1Error);
    } else {
      console.log('✅ Updated first event with attendee_user_id');
    }
    
    const { error: update2Error } = await supabase
      .from('events')
      .update({ attendee_user_id: userId })
      .eq('id', event2.id);
    
    if (update2Error) {
      console.error('❌ Error updating second event:', update2Error);
    } else {
      console.log('✅ Updated second event with attendee_user_id');
    }
    
    // Wait for triggers
    console.log('⏳ Waiting for triggers...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
        console.log('✅ Conflicts detected!');
        conflicts.forEach((conflict, index) => {
          console.log(`   ${index + 1}. ${conflict.conflict_type} (${conflict.severity})`);
          console.log(`      Event 1: ${conflict.event1_id}`);
          console.log(`      Event 2: ${conflict.event2_id}`);
        });
      } else {
        console.log('❌ No conflicts detected');
      }
    }
    
    // Clean up test events
    console.log('\n🧹 Cleaning up test events...');
    await supabase
      .from('events')
      .delete()
      .eq('household_id', household.id)
      .like('title', 'Updated Test%');
    
    console.log('✅ Test completed and cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testUpdatedFunctions()
  .then(() => {
    console.log('🎉 Updated functions test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Updated functions test failed:', error);
    process.exit(1);
  });
