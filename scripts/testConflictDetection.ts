#!/usr/bin/env tsx
/**
 * Test script for conflict detection
 * Creates sample events with conflicts and verifies detection works
 * 
 * Usage: tsx scripts/testConflictDetection.ts
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

async function testConflictDetection() {
  console.log('🧪 Testing conflict detection...');
  
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
      .like('title', 'Test Event%');
    
    // Create test events with conflicts
    console.log('📅 Creating test events...');
    
    const now = new Date();
    const baseTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    
    const testEvents = [
      {
        household_id: household.id,
        title: 'Test Event 1 - Morning Meeting',
        description: 'Test event for conflict detection',
        start_at: new Date(baseTime.getTime() + 9 * 60 * 60 * 1000).toISOString(), // 9 AM
        end_at: new Date(baseTime.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10 AM
        timezone: 'Australia/Melbourne',
        is_all_day: false,
        attendee_user_id: userId,
        created_by: userId,
        source: 'first_party'
      },
      {
        household_id: household.id,
        title: 'Test Event 2 - Overlapping Meeting',
        description: 'Test event for conflict detection',
        start_at: new Date(baseTime.getTime() + 9 * 30 * 60 * 1000).toISOString(), // 9:30 AM
        end_at: new Date(baseTime.getTime() + 10 * 30 * 60 * 1000).toISOString(), // 10:30 AM
        timezone: 'Australia/Melbourne',
        is_all_day: false,
        attendee_user_id: userId,
        created_by: userId,
        source: 'first_party'
      },
      {
        household_id: household.id,
        title: 'Test Event 3 - Same Title',
        description: 'Test event for conflict detection',
        start_at: new Date(baseTime.getTime() + 14 * 60 * 60 * 1000).toISOString(), // 2 PM
        end_at: new Date(baseTime.getTime() + 15 * 60 * 60 * 1000).toISOString(), // 3 PM
        timezone: 'Australia/Melbourne',
        is_all_day: false,
        attendee_user_id: userId,
        created_by: userId,
        source: 'first_party'
      },
      {
        household_id: household.id,
        title: 'Test Event 3 - Same Title',
        description: 'Test event for conflict detection',
        start_at: new Date(baseTime.getTime() + 14 * 30 * 60 * 1000).toISOString(), // 2:30 PM
        end_at: new Date(baseTime.getTime() + 15 * 30 * 60 * 1000).toISOString(), // 3:30 PM
        timezone: 'Australia/Melbourne',
        is_all_day: false,
        attendee_user_id: userId,
        created_by: userId,
        source: 'first_party'
      },
      {
        household_id: household.id,
        title: 'Test Event 4 - No Conflict',
        description: 'Test event for conflict detection',
        start_at: new Date(baseTime.getTime() + 16 * 60 * 60 * 1000).toISOString(), // 4 PM
        end_at: new Date(baseTime.getTime() + 17 * 60 * 60 * 1000).toISOString(), // 5 PM
        timezone: 'Australia/Melbourne',
        is_all_day: false,
        attendee_user_id: userId,
        created_by: userId,
        source: 'first_party'
      }
    ];
    
    const { data: createdEvents, error: createError } = await supabase
      .from('events')
      .insert(testEvents)
      .select('id, title');
    
    if (createError) {
      throw new Error(`Failed to create test events: ${createError.message}`);
    }
    
    console.log(`✅ Created ${createdEvents.length} test events`);
    
    // Wait a moment for triggers to process
    console.log('⏳ Waiting for conflict detection...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for conflicts
    console.log('🔍 Checking for conflicts...');
    const { data: conflicts, error: conflictsError } = await supabase
      .from('calendar_conflicts')
      .select('*')
      .eq('household_id', household.id)
      .eq('is_resolved', false);
    
    if (conflictsError) {
      throw new Error(`Failed to fetch conflicts: ${conflictsError.message}`);
    }
    
    console.log(`\n📊 Test Results:`);
    console.log(`   Expected conflicts: 3 (2 time overlaps + 1 same title)`);
    console.log(`   Actual conflicts: ${conflicts.length}`);
    
    if (conflicts.length > 0) {
      console.log(`\n⚠️  Detected conflicts:`);
      for (const conflict of conflicts) {
        // Fetch event details separately
        const { data: event1 } = await supabase
          .from('events')
          .select('title, start_at, end_at')
          .eq('id', conflict.event1_id)
          .single();
        
        const { data: event2 } = await supabase
          .from('events')
          .select('title, start_at, end_at')
          .eq('id', conflict.event2_id)
          .single();
        
        console.log(`   ${conflicts.indexOf(conflict) + 1}. ${conflict.conflict_type} (${conflict.severity})`);
        console.log(`      "${event1?.title || 'Unknown'}" vs "${event2?.title || 'Unknown'}"`);
      }
    }
    
    // Verify specific conflicts
    const timeOverlaps = conflicts.filter(c => c.conflict_type === 'time_overlap');
    const sameTitles = conflicts.filter(c => c.conflict_type === 'same_title');
    
    console.log(`\n✅ Verification:`);
    console.log(`   Time overlaps: ${timeOverlaps.length} (expected: 2)`);
    console.log(`   Same titles: ${sameTitles.length} (expected: 1)`);
    
    if (timeOverlaps.length === 2 && sameTitles.length === 1) {
      console.log(`\n🎉 Conflict detection is working correctly!`);
    } else {
      console.log(`\n❌ Conflict detection may have issues`);
    }
    
    // Clean up test events
    console.log('\n🧹 Cleaning up test events...');
    await supabase
      .from('events')
      .delete()
      .eq('household_id', household.id)
      .like('title', 'Test Event%');
    
    console.log('✅ Test completed and cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testConflictDetection()
  .then(() => {
    console.log('🎉 Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test script failed:', error);
    process.exit(1);
  });
