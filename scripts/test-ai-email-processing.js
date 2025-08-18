const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Load environment variables from .env.local
const envPath = require('path').join(__dirname, '..', '.env.local');
if (require('fs').existsSync(envPath)) {
  const envContent = require('fs').readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      const value = valueParts.join('=').trim();
      if (value) {
        process.env[key.trim()] = value;
      }
    }
  });
}

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAIEmailProcessing() {
  try {
    console.log('🧪 Testing AI Email Processing System...');
    console.log('📋 Environment Check:');
    console.log('  - Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('  - Supabase Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
    console.log('  - OpenAI API Key:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('');

    // Test 1: Check if we can connect to Supabase
    console.log('🔍 Test 1: Supabase Connection...');
    try {
      const { data, error } = await supabase
        .from('households')
        .select('id')
        .limit(1);
      
      if (error) {
        console.log('  ❌ Supabase connection failed:', error.message);
        return;
      }
      console.log('  ✅ Supabase connection successful');
    } catch (err) {
      console.log('  ❌ Supabase connection error:', err.message);
      return;
    }

    // Test 2: Check if AI tables exist
    console.log('🔍 Test 2: AI Tables Check...');
    const aiTables = ['ai_email_queue', 'ai_parsed_items', 'ai_suggestions', 'ai_processing_logs'];
    for (const table of aiTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1);
        
        if (error) {
          console.log(`  ❌ Table ${table}: ${error.message}`);
        } else {
          console.log(`  ✅ Table ${table}: exists`);
        }
      } catch (err) {
        console.log(`  ❌ Table ${table}: ${err.message}`);
      }
    }

    // Test 3: Test OpenAI API
    console.log('🔍 Test 3: OpenAI API...');
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Respond with "Hello, I am working!"'
          },
          {
            role: 'user',
            content: 'Say hello'
          }
        ],
        max_tokens: 10,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        console.log('  ✅ OpenAI API working:', content);
      } else {
        console.log('  ❌ OpenAI API returned no content');
      }
    } catch (err) {
      console.log('  ❌ OpenAI API error:', err.message);
      if (err.message.includes('401')) {
        console.log('    💡 This suggests an invalid API key');
      } else if (err.message.includes('429')) {
        console.log('    💡 This suggests rate limiting or quota exceeded');
      }
    }

    // Test 4: Test database operations
    console.log('🔍 Test 4: Database Operations...');
    try {
      // First, get a real household ID
      const { data: households, error: householdError } = await supabase
        .from('households')
        .select('id')
        .limit(1);

      if (householdError || !households || households.length === 0) {
        console.log('  ❌ No households found in database');
        return;
      }

      const realHouseholdId = households[0].id;
      console.log('  📋 Using household ID:', realHouseholdId);

      // Try to insert a test log entry
      const { error: logError } = await supabase
        .from('ai_processing_logs')
        .insert({
          household_id: realHouseholdId,
          log_level: 'info',
          log_message: 'Test log entry',
          log_data: { test: true },
          processing_step: 'test'
        });

      if (logError) {
        console.log('  ❌ Log insertion failed:', logError.message);
      } else {
        console.log('  ✅ Log insertion successful');
        
        // Clean up test data
        await supabase
          .from('ai_processing_logs')
          .delete()
          .eq('log_message', 'Test log entry');
        
        console.log('  ✅ Test data cleaned up');
      }
    } catch (err) {
      console.log('  ❌ Database operation error:', err.message);
    }

    console.log('');
    console.log('🎯 Summary:');
    console.log('  - If all tests pass, the system should work');
    console.log('  - Check the specific error messages above for issues');
    console.log('  - Common issues: missing API keys, database permissions, table structure');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
testAIEmailProcessing();
