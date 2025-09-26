#!/usr/bin/env tsx
/**
 * Test script to verify triggers are working
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

async function testTriggers() {
  console.log('🧪 Testing triggers...');
  
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
      .like('title', 'Trigger Test%');
    
    // Create first test event
    console.log('📅 Creating first test event...');
    const now = new Date();
    const baseTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    
    const { data: event1, error: create1Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Trigger Test Event 1',
        description: 'Test event for trigger testing',
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
    
    console.log(`✅ Created first event: ${event1.title} (${event1.id})`);
    
    // Wait a moment for trigger
    console.log('⏳ Waiting for trigger...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check for conflicts (should be 0)
    const { data: conflicts1, error: conflicts1Error } = await supabase
      .from('calendar_conflicts')
      .select('*')
      .eq('household_id', household.id)
      .eq('is_resolved', false);
    
    if (conflicts1Error) {
      console.error('❌ Error checking conflicts after first event:', conflicts1Error);
    } else {
      console.log(`📊 Conflicts after first event: ${conflicts1?.length || 0}`);
    }
    
    // Create second overlapping event
    console.log('📅 Creating second overlapping event...');
    const { data: event2, error: create2Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Trigger Test Event 2',
        description: 'Test event for trigger testing',
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
    
    console.log(`✅ Created second event: ${event2.title} (${event2.id})`);
    
    // Wait a moment for trigger
    console.log('⏳ Waiting for trigger...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for conflicts (should be 1)
    const { data: conflicts2, error: conflicts2Error } = await supabase
      .from('calendar_conflicts')
      .select('*')
      .eq('household_id', household.id)
      .eq('is_resolved', false);
    
    if (conflicts2Error) {
      console.error('❌ Error checking conflicts after second event:', conflicts2Error);
    } else {
      console.log(`📊 Conflicts after second event: ${conflicts2?.length || 0}`);
      
      if (conflicts2 && conflicts2.length > 0) {
        console.log('✅ Triggers are working! Conflicts detected automatically.');
        conflicts2.forEach((conflict, index) => {
          console.log(`   ${index + 1}. ${conflict.conflict_type} (${conflict.severity})`);
        });
      } else {
        console.log('❌ Triggers may not be working - no conflicts detected');
      }
    }
    
    // Clean up test events
    console.log('\n🧹 Cleaning up test events...');
    await supabase
      .from('events')
      .delete()
      .eq('household_id', household.id)
      .like('title', 'Trigger Test%');
    
    console.log('✅ Test completed and cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTriggers()
  .then(() => {
    console.log('🎉 Trigger test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Trigger test failed:', error);
    process.exit(1);
  });
