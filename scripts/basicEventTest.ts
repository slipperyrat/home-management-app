#!/usr/bin/env tsx
/**
 * Basic test to create a single event and see what happens
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

async function basicEventTest() {
  console.log('🧪 Basic event creation test...');
  
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
      .like('title', 'Basic Test%');
    
    // Create a single event without .single()
    console.log('📅 Creating a single event...');
    const now = new Date();
    const baseTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    
    const { data: events, error: createError } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'Basic Test Event',
        description: 'Test event',
        start_at: new Date(baseTime.getTime() + 0 * 60 * 1000).toISOString(),
        end_at: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString(),
        timezone: 'Australia/Melbourne',
        is_all_day: false,
        attendee_user_id: userId,
        created_by: userId,
        source: 'first_party'
      })
      .select('id, title, start_at, end_at, attendee_user_id');
    
    if (createError) {
      console.error('❌ Error creating event:', createError);
      throw new Error(`Failed to create event: ${createError.message}`);
    }
    
    console.log(`✅ Created event successfully!`);
    console.log(`   Events created: ${events?.length || 0}`);
    if (events && events.length > 0) {
      const event = events[0];
      console.log(`   Event: ${event.title} (${event.id})`);
      console.log(`   Start: ${event.start_at}, End: ${event.end_at}`);
      console.log(`   Attendee: ${event.attendee_user_id}`);
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
    }
    
    // Clean up test events
    console.log('\n🧹 Cleaning up test events...');
    await supabase
      .from('events')
      .delete()
      .eq('household_id', household.id)
      .like('title', 'Basic Test%');
    
    console.log('✅ Test completed and cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
basicEventTest()
  .then(() => {
    console.log('🎉 Basic event test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Basic event test failed:', error);
    process.exit(1);
  });
