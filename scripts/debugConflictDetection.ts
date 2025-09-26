#!/usr/bin/env tsx
/**
 * Debug script to see what the conflict detection function returns
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

async function debugConflictDetection() {
  console.log('🔍 Debugging conflict detection...');
  
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
      .like('title', 'Debug Test%');
    
    // Create two overlapping events
    console.log('📅 Creating overlapping test events...');
    const now = new Date();
    const baseTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    
    // Create events with explicit UTC times to ensure overlap
    // Use the same base time and add minutes to ensure they overlap
    const startTime1 = new Date(baseTime.getTime() + 0 * 60 * 1000); // Base time
    const endTime1 = new Date(baseTime.getTime() + 60 * 60 * 1000); // +1 hour
    const startTime2 = new Date(baseTime.getTime() + 30 * 60 * 1000); // +30 minutes
    const endTime2 = new Date(baseTime.getTime() + 90 * 60 * 1000); // +90 minutes
    
    const { data: event1, error: create1Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Debug Test Event 1',
        description: 'Test event for debugging',
        start_at: startTime1.toISOString(),
        end_at: endTime1.toISOString(),
        timezone: 'Australia/Melbourne',
        is_all_day: false,
        attendee_user_id: userId,
        created_by: userId,
        source: 'first_party'
      })
      .select('id, title, start_at, end_at, attendee_user_id')
      .single();
    
    if (create1Error) {
      throw new Error(`Failed to create first event: ${create1Error.message}`);
    }
    
    const { data: event2, error: create2Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Debug Test Event 2',
        description: 'Test event for debugging',
        start_at: startTime2.toISOString(),
        end_at: endTime2.toISOString(),
        timezone: 'Australia/Melbourne',
        is_all_day: false,
        attendee_user_id: userId,
        created_by: userId,
        source: 'first_party'
      })
      .select('id, title, start_at, end_at, attendee_user_id')
      .single();
    
    if (create2Error) {
      throw new Error(`Failed to create second event: ${create2Error.message}`);
    }
    
    console.log(`✅ Created events:`);
    console.log(`   Event 1: ${event1.title} (${event1.id})`);
    console.log(`   Start: ${event1.start_at}, End: ${event1.end_at}`);
    console.log(`   Attendee: ${event1.attendee_user_id}`);
    console.log(`   Event 2: ${event2.title} (${event2.id})`);
    console.log(`   Start: ${event2.start_at}, End: ${event2.end_at}`);
    console.log(`   Attendee: ${event2.attendee_user_id}`);
    
    // Check if events actually overlap
    const event1Start = new Date(event1.start_at);
    const event1End = new Date(event1.end_at);
    const event2Start = new Date(event2.start_at);
    const event2End = new Date(event2.end_at);
    
    const overlap = event1Start < event2End && event2Start < event1End;
    console.log(`🔍 Overlap check: ${overlap ? 'YES' : 'NO'}`);
    console.log(`   Event 1: ${event1Start.toISOString()} - ${event1End.toISOString()}`);
    console.log(`   Event 2: ${event2Start.toISOString()} - ${event2End.toISOString()}`);
    console.log(`   Condition: ${event1Start.toISOString()} < ${event2End.toISOString()} = ${event1Start < event2End}`);
    console.log(`   Condition: ${event2Start.toISOString()} < ${event1End.toISOString()} = ${event2Start < event1End}`);
    
    // Check if events have attendee_user_id
    if (!event1.attendee_user_id || !event2.attendee_user_id) {
      console.log('❌ Events don\'t have attendee_user_id - this is the problem!');
    } else {
      console.log('✅ Both events have attendee_user_id');
    }
    
    // Test the detect_calendar_conflicts function directly
    console.log('🔍 Testing detect_calendar_conflicts function...');
    const { data: detectedConflicts, error: detectError } = await supabase
      .rpc('detect_calendar_conflicts', { p_household_id: household.id });
    
    if (detectError) {
      console.error('❌ Error calling detect_calendar_conflicts:', detectError);
    } else {
      console.log(`📊 detect_calendar_conflicts returned ${detectedConflicts?.length || 0} conflicts:`);
      if (detectedConflicts && detectedConflicts.length > 0) {
        detectedConflicts.forEach((conflict, index) => {
          console.log(`   ${index + 1}. ${conflict.conflict_type} (${conflict.severity})`);
          console.log(`      Event A: ${conflict.event_id_a}`);
          console.log(`      Event B: ${conflict.event_id_b}`);
          console.log(`      Attendee: ${conflict.attendee_user_id}`);
        });
      } else {
        console.log('   No conflicts detected by the function');
      }
    }
    
    // Check what events exist in the database
    console.log('🔍 Checking all events in household...');
    const { data: allEvents, error: allEventsError } = await supabase
      .from('events')
      .select('id, title, start_at, end_at, attendee_user_id')
      .eq('household_id', household.id)
      .like('title', 'Debug Test%');
    
    if (allEventsError) {
      console.error('❌ Error fetching events:', allEventsError);
    } else {
      console.log(`📊 Found ${allEvents?.length || 0} events in household:`);
      allEvents?.forEach((event, index) => {
        console.log(`   ${index + 1}. ${event.title} (${event.id})`);
        console.log(`      Start: ${event.start_at}, End: ${event.end_at}`);
        console.log(`      Attendee: ${event.attendee_user_id}`);
      });
    }
    
    // Clean up test events
    console.log('\n🧹 Cleaning up test events...');
    await supabase
      .from('events')
      .delete()
      .eq('household_id', household.id)
      .like('title', 'Debug Test%');
    
    console.log('✅ Debug completed and cleaned up');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

// Run the debug
debugConflictDetection()
  .then(() => {
    console.log('🎉 Debug completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Debug failed:', error);
    process.exit(1);
  });
