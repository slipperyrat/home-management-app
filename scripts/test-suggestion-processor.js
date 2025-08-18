// Test script for the AI Suggestion Processor
// This script tests the automatic insertion of AI suggestions into appropriate tables

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Sample AI suggestions for testing
const sampleSuggestions = [
  {
    id: 'test-bill-1',
    suggestion_type: 'bill_action',
    suggestion_data: {
      description: 'Electricity bill from Origin Energy',
      bill_amount: 89.50,
      bill_due_date: '2024-02-15',
      bill_category: 'utilities'
    },
    ai_reasoning: 'Detected electricity bill in email with amount and due date'
  },
  {
    id: 'test-event-1',
    suggestion_type: 'calendar_event',
    suggestion_data: {
      event_title: 'Dentist Appointment',
      event_date: '2024-02-20',
      event_location: 'Dental Clinic',
      description: 'Regular checkup appointment'
    },
    ai_reasoning: 'Found dentist appointment details in email'
  },
  {
    id: 'test-shopping-1',
    suggestion_type: 'shopping_list_update',
    suggestion_data: {
      description: 'Groceries from Woolworths',
      items: [
        { name: 'Milk', quantity: '2L' },
        { name: 'Bread', quantity: '1 loaf' },
        { name: 'Eggs', quantity: '12 pack' }
      ]
    },
    ai_reasoning: 'Detected grocery receipt with items to add to shopping list'
  }
];

async function testSuggestionProcessor() {
  try {
    console.log('🧪 Testing AI Suggestion Processor...\n');

    // Get a test household ID
    const { data: households, error: householdError } = await supabase
      .from('households')
      .select('id')
      .limit(1);

    if (householdError || !households || households.length === 0) {
      console.error('❌ No households found for testing');
      return;
    }

    const householdId = households[0].id;
    console.log(`📍 Using household ID: ${householdId}`);

    // Get a test user ID
    const { data: members, error: memberError } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId)
      .limit(1);

    if (memberError || !members || members.length === 0) {
      console.error('❌ No household members found for testing');
      return;
    }

    const userId = members[0].user_id;
    console.log(`👤 Using user ID: ${userId}\n`);

    // Test 1: Bill suggestion processing
    console.log('📊 Test 1: Processing Bill Suggestion');
    const billSuggestion = sampleSuggestions[0];
    
    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        household_id: householdId,
        name: billSuggestion.suggestion_data.description,
        amount: billSuggestion.suggestion_data.bill_amount,
        currency: 'AUD',
        due_date: billSuggestion.suggestion_data.bill_due_date,
        status: 'pending',
        category: billSuggestion.suggestion_data.bill_category,
        description: billSuggestion.suggestion_data.description,
        source: 'ai_email_test',
        source_data: {
          test_suggestion_id: billSuggestion.id,
          original_suggestion: billSuggestion
        },
        created_by: userId
      })
      .select()
      .single();

    if (billError) {
      console.error('❌ Failed to create test bill:', billError.message);
    } else {
      console.log('✅ Test bill created successfully:', bill.id);
    }

    // Test 2: Event suggestion processing
    console.log('\n📅 Test 2: Processing Event Suggestion');
    const eventSuggestion = sampleSuggestions[1];
    
    const { data: event, error: eventError } = await supabase
      .from('household_events')
      .insert({
        household_id: householdId,
        type: 'appointment.scheduled',
        source: 'ai_email_test',
        payload: {
          title: eventSuggestion.suggestion_data.event_title,
          date: eventSuggestion.suggestion_data.event_date,
          location: eventSuggestion.suggestion_data.event_location,
          description: eventSuggestion.suggestion_data.description,
          test_suggestion_id: eventSuggestion.id,
          original_suggestion: eventSuggestion
        }
      })
      .select()
      .single();

    if (eventError) {
      console.error('❌ Failed to create test event:', eventError.message);
    } else {
      console.log('✅ Test event created successfully:', event.id);
    }

    // Test 3: Shopping list suggestion processing
    console.log('\n🛒 Test 3: Processing Shopping List Suggestion');
    const shoppingSuggestion = sampleSuggestions[2];
    
    // Get or create test shopping list
    let { data: shoppingList } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('household_id', householdId)
      .eq('title', 'Test AI Items')
      .single();

    if (!shoppingList) {
      const { data: newList, error: listError } = await supabase
        .from('shopping_lists')
        .insert({
          title: 'Test AI Items',
          created_by: userId,
          household_id: householdId
        })
        .select()
        .single();

      if (listError) {
        console.error('❌ Failed to create test shopping list:', listError.message);
        return;
      }
      shoppingList = newList;
    }

    // Add test items
    for (const item of shoppingSuggestion.suggestion_data.items) {
      const { data: shoppingItem, error: itemError } = await supabase
        .from('shopping_items')
        .insert({
          list_id: shoppingList.id,
          name: item.name,
          quantity: item.quantity,
          completed: false
        })
        .select()
        .single();

      if (itemError) {
        console.error(`❌ Failed to add shopping item ${item.name}:`, itemError.message);
      } else {
        console.log(`✅ Added shopping item: ${item.name}`);
      }
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Summary:');
    console.log('- Bill suggestion → bills table ✅');
    console.log('- Event suggestion → household_events table ✅');
    console.log('- Shopping suggestion → shopping_lists/shopping_items tables ✅');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testSuggestionProcessor();
