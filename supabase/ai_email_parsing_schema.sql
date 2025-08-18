-- AI Email Parsing System Schema
-- This system will automatically parse emails to extract bills, receipts, and events

-- 1. Email processing queue and status
CREATE TABLE IF NOT EXISTS ai_email_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  email_from TEXT,
  email_date TIMESTAMPTZ,
  email_attachments JSONB, -- Store attachment metadata
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  ai_analysis_result JSONB, -- Store AI parsing results
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  priority INTEGER DEFAULT 1 -- Higher number = higher priority
);

-- 2. AI parsing results and extracted data
CREATE TABLE IF NOT EXISTS ai_parsed_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_queue_id UUID NOT NULL REFERENCES ai_email_queue(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('bill', 'receipt', 'event', 'appointment', 'delivery', 'other')),
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Extracted data fields
  extracted_data JSONB NOT NULL, -- Flexible structure for different item types
  
  -- Bill-specific fields
  bill_amount DECIMAL(10,2),
  bill_due_date DATE,
  bill_provider TEXT,
  bill_category TEXT,
  
  -- Receipt-specific fields
  receipt_total DECIMAL(10,2),
  receipt_date DATE,
  receipt_store TEXT,
  receipt_items JSONB, -- Array of purchased items
  
  -- Event-specific fields
  event_title TEXT,
  event_date TIMESTAMPTZ,
  event_location TEXT,
  event_description TEXT,
  
  -- Processing metadata
  ai_model_used TEXT,
  processing_time_ms INTEGER,
  user_confirmed BOOLEAN DEFAULT FALSE,
  user_modified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AI learning and pattern storage
CREATE TABLE IF NOT EXISTS ai_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('email_sender', 'bill_provider', 'receipt_store', 'event_type')),
  pattern_data JSONB NOT NULL, -- Store the actual pattern
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  usage_count INTEGER DEFAULT 1,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AI suggestions and user feedback
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  parsed_item_id UUID REFERENCES ai_parsed_items(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('bill_action', 'shopping_list_update', 'calendar_event', 'chore_creation')),
  suggestion_data JSONB NOT NULL, -- What the AI suggests
  ai_reasoning TEXT, -- Why the AI made this suggestion
  user_feedback TEXT CHECK (user_feedback IN ('accepted', 'rejected', 'modified', 'pending')),
  user_notes TEXT, -- User's feedback or modifications
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Email parsing rules and templates
CREATE TABLE IF NOT EXISTS ai_email_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('sender_pattern', 'subject_pattern', 'content_pattern', 'attachment_pattern')),
  rule_pattern TEXT NOT NULL, -- Regex or pattern to match
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. AI processing logs for debugging and improvement
CREATE TABLE IF NOT EXISTS ai_processing_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_queue_id UUID REFERENCES ai_email_queue(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
  log_message TEXT NOT NULL,
  log_data JSONB, -- Additional context data
  processing_step TEXT, -- Which step in the pipeline
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_email_queue_household_status ON ai_email_queue(household_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_ai_email_queue_priority ON ai_email_queue(priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_parsed_items_household_type ON ai_parsed_items(household_id, item_type);
CREATE INDEX IF NOT EXISTS idx_ai_parsed_items_confidence ON ai_parsed_items(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_patterns_household_type ON ai_patterns(household_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_household_feedback ON ai_suggestions(household_id, user_feedback);
CREATE INDEX IF NOT EXISTS idx_ai_processing_logs_household_level ON ai_processing_logs(household_id, log_level);

-- Add comments for documentation
COMMENT ON TABLE ai_email_queue IS 'Queue of emails waiting to be processed by AI';
COMMENT ON TABLE ai_parsed_items IS 'Items extracted from emails by AI (bills, receipts, events)';
COMMENT ON TABLE ai_patterns IS 'AI-learned patterns for better email parsing';
COMMENT ON TABLE ai_suggestions IS 'AI suggestions based on parsed email data';
COMMENT ON TABLE ai_email_rules IS 'Custom rules for email parsing and categorization';
COMMENT ON TABLE ai_processing_logs IS 'Detailed logs of AI processing for debugging';

-- Note: Default rules will be created per household when needed
-- You can add custom rules for your household through the AI Email Dashboard
