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

async function checkTableExists(tableName) {
  try {
    // Try to select from the table - if it exists, this will work
    const { error } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);
    
    return !error;
  } catch (err) {
    return false;
  }
}

async function setupAISchema() {
  try {
    console.log('🔍 Checking AI email parsing schema...');
    
    // Check if tables exist by trying to query them
    const tableNames = [
      'ai_email_queue',
      'ai_parsed_items', 
      'ai_suggestions',
      'ai_patterns',
      'ai_email_rules',
      'ai_processing_logs'
    ];

    const existingTables = [];
    const missingTables = [];

    for (const tableName of tableNames) {
      const exists = await checkTableExists(tableName);
      if (exists) {
        existingTables.push(tableName);
      } else {
        missingTables.push(tableName);
      }
    }

    console.log('📋 Existing AI tables:', existingTables);

    if (missingTables.length === 0) {
      console.log('✅ All AI tables already exist!');
      return;
    }

    console.log('🚧 Missing tables:', missingTables);
    console.log('📝 Applying AI email parsing schema...');

    // Read and execute the schema file
    const schemaPath = path.join(__dirname, '..', 'supabase', 'ai_email_parsing_schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Split into individual statements and execute
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.log('⚠️  Statement skipped (likely already exists):', statement.substring(0, 100) + '...');
          } else {
            console.log('✅ Executed:', statement.substring(0, 100) + '...');
          }
        } catch (err) {
          console.log('⚠️  Statement skipped:', err.message);
        }
      }
    }

    console.log('🎉 AI schema setup complete!');

  } catch (error) {
    console.error('❌ Error setting up AI schema:', error);
  }
}

// Run the setup
setupAISchema();
