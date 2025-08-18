const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createMissingTable() {
  try {
    console.log('🔍 Creating missing ai_processing_logs table...');
    
    // First, let's check if the table already exists
    try {
      const { error } = await supabase
        .from('ai_processing_logs')
        .select('id')
        .limit(1);
      
      if (!error) {
        console.log('✅ ai_processing_logs table already exists!');
        return;
      }
    } catch (err) {
      // Table doesn't exist, continue with creation
    }

    // Create the table using raw SQL through the REST API
    // We'll need to use the Supabase dashboard or CLI for this
    console.log('📝 Table creation requires manual setup in Supabase dashboard');
    console.log('📋 Please run this SQL in your Supabase SQL Editor:');
    console.log('');
    console.log(`
CREATE TABLE IF NOT EXISTS ai_processing_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_queue_id UUID REFERENCES ai_email_queue(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
  log_message TEXT NOT NULL,
  log_data JSONB,
  processing_step TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_processing_logs_household_level ON ai_processing_logs(household_id, log_level);

COMMENT ON TABLE ai_processing_logs IS 'Detailed logs of AI processing for debugging';
    `);
    console.log('');
    console.log('🔗 Go to: https://supabase.com/dashboard');
    console.log('📁 Navigate to SQL Editor and run the above SQL');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the setup
createMissingTable();
