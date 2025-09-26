#!/usr/bin/env tsx
/**
 * Test to create events without triggers to isolate the issue
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

async function testWithoutTriggers() {
  console.log('🧪 Testing event creation without triggers...');
  
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
      .like('title', 'No Trigger Test%');
    
    // Try to create an event with minimal fields first
    console.log('📅 Creating event with minimal fields...');
    const now = new Date();
    const baseTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    
    const { data: events, error: createError } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'No Trigger Test Event',
        start_at: baseTime.toISOString(),
        end_at: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString(),
        created_by: userId
      })
      .select('id, title');
    
    if (createError) {
      console.error('❌ Error creating minimal event:', createError);
      throw new Error(`Failed to create minimal event: ${createError.message}`);
    }
    
    console.log(`✅ Created minimal event successfully!`);
    console.log(`   Events created: ${events?.length || 0}`);
    if (events && events.length > 0) {
      const event = events[0];
      console.log(`   Event: ${event.title} (${event.id})`);
    }
    
    // Now try with attendee_user_id
    console.log('📅 Creating event with attendee_user_id...');
    const { data: events2, error: create2Error } = await supabase
      .from('events')
      .insert({
        household_id: household.id,
        title: 'No Trigger Test Event 2',
        start_at: new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        end_at: new Date(baseTime.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        created_by: userId,
        attendee_user_id: userId
      })
      .select('id, title');
    
    if (create2Error) {
      console.error('❌ Error creating event with attendee:', create2Error);
      console.log('This suggests the issue is with attendee_user_id or triggers');
    } else {
      console.log(`✅ Created event with attendee successfully!`);
      console.log(`   Events created: ${events2?.length || 0}`);
    }
    
    // Clean up test events
    console.log('\n🧹 Cleaning up test events...');
    await supabase
      .from('events')
      .delete()
      .eq('household_id', household.id)
      .like('title', 'No Trigger Test%');
    
    console.log('✅ Test completed and cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testWithoutTriggers()
  .then(() => {
    console.log('🎉 No trigger test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 No trigger test failed:', error);
    process.exit(1);
  });
