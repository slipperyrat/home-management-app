const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAISuggestions() {
  console.log('🔍 Debugging AI Suggestions...\n');

  try {
    // Check AI suggestions table
    console.log('📊 Checking AI Suggestions table...');
    const { data: suggestions, error: suggestionsError } = await supabase
      .from('ai_suggestions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (suggestionsError) {
      console.error('❌ Error fetching suggestions:', suggestionsError);
    } else {
      console.log(`✅ Found ${suggestions.length} AI suggestions:`);
      suggestions.forEach((s, i) => {
        console.log(`  ${i + 1}. ID: ${s.id}`);
        console.log(`     Type: ${s.suggestion_type}`);
        console.log(`     Status: ${s.user_feedback}`);
        console.log(`     Created: ${s.created_at}`);
        console.log(`     Data:`, s.suggestion_data);
        console.log('');
      });
    }

    // Check parsed items table
    console.log('📊 Checking Parsed Items table...');
    const { data: parsedItems, error: parsedError } = await supabase
      .from('ai_parsed_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (parsedError) {
      console.error('❌ Error fetching parsed items:', parsedError);
    } else {
      console.log(`✅ Found ${parsedItems.length} parsed items:`);
      parsedItems.forEach((item, i) => {
        console.log(`  ${i + 1}. ID: ${item.id}`);
        console.log(`     Type: ${item.item_type}`);
        console.log(`     Confidence: ${item.confidence_score}`);
        console.log(`     Review Status: ${item.review_status}`);
        console.log(`     Created: ${item.created_at}`);
        console.log('');
      });
    }

    // Check email queue table
    console.log('📊 Checking Email Queue table...');
    const { data: queueItems, error: queueError } = await supabase
      .from('ai_email_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (queueError) {
      console.error('❌ Error fetching queue items:', queueError);
    } else {
      console.log(`✅ Found ${queueItems.length} queue items:`);
      queueItems.forEach((item, i) => {
        console.log(`  ${i + 1}. ID: ${item.id}`);
        console.log(`     Status: ${item.processing_status}`);
        console.log(`     Subject: ${item.email_subject}`);
        console.log(`     Created: ${item.created_at}`);
        console.log(`     Processed: ${item.processed_at}`);
        console.log('');
      });
    }

    // Check if there are any recent suggestions that might not be showing
    console.log('🔍 Checking for recent activity...');
    const { data: recentActivity, error: activityError } = await supabase
      .from('ai_suggestions')
      .select(`
        *,
        parsed_item:ai_parsed_items(
          item_type,
          confidence_score,
          review_status
        )
      `)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (activityError) {
      console.error('❌ Error fetching recent activity:', activityError);
    } else {
      console.log(`✅ Recent activity (last 24h): ${recentActivity.length} suggestions`);
      if (recentActivity.length > 0) {
        console.log('Latest suggestion details:');
        const latest = recentActivity[0];
        console.log(`  ID: ${latest.id}`);
        console.log(`  Type: ${latest.suggestion_type}`);
        console.log(`  Status: ${latest.user_feedback}`);
        console.log(`  Parsed Item:`, latest.parsed_item);
        console.log(`  Created: ${latest.created_at}`);
      }
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

debugAISuggestions();
