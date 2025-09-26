#!/usr/bin/env tsx
/**
 * Simple test to create overlapping events one at a time
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

async function simpleOverlapTest() {
  console.log('🧪 Simple overlap test...');
  
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
      .like('title', 'Simple Test%');
    
    // Create first event
    console.log('📅 Creating first event...');
    const now = new Date();
    const baseTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    
    const { data: event1, error: create1Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Simple Test Event 1',
        description: 'Test event 1',
        start_at: new Date(baseTime.getTime() + 0 * 60 * 1000).toISOString(), // Base time
        end_at: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString(), // +1 hour
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
    
    console.log(`✅ Created first event: ${event1.title} (${event1.id})`);
    console.log(`   Start: ${event1.start_at}, End: ${event1.end_at}`);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create second overlapping event
    console.log('📅 Creating second overlapping event...');
    const { data: event2, error: create2Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Simple Test Event 2',
        description: 'Test event 2',
        start_at: new Date(baseTime.getTime() + 30 * 60 * 1000).toISOString(), // +30 minutes
        end_at: new Date(baseTime.getTime() + 90 * 60 * 1000).toISOString(), // +90 minutes
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
    
    console.log(`✅ Created second event: ${event2.title} (${event2.id})`);
    console.log(`   Start: ${event2.start_at}, End: ${event2.end_at}`);
    
    // Check if events actually overlap
    const event1Start = new Date(event1.start_at);
    const event1End = new Date(event1.end_at);
    const event2Start = new Date(event2.start_at);
    const event2End = new Date(event2.end_at);
    
    const overlap = event1Start < event2End && event2Start < event1End;
    console.log(`🔍 Overlap check: ${overlap ? 'YES' : 'NO'}`);
    console.log(`   Event 1: ${event1Start.toISOString()} - ${event1End.toISOString()}`);
    console.log(`   Event 2: ${event2Start.toISOString()} - ${event2End.toISOString()}`);
    
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
      .like('title', 'Simple Test%');
    
    console.log('✅ Test completed and cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
simpleOverlapTest()
  .then(() => {
    console.log('🎉 Simple overlap test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Simple overlap test failed:', error);
    process.exit(1);
  });
