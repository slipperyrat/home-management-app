-- Attachments + OCR Lite System Schema
-- This system handles file uploads, OCR processing, and receipt scanning

-- 1. File attachments and storage metadata
CREATE TABLE IF NOT EXISTS attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL, -- Size in bytes
  file_type TEXT NOT NULL, -- MIME type (e.g., 'image/jpeg', 'application/pdf')
  file_extension TEXT NOT NULL, -- e.g., 'jpg', 'pdf'
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  storage_bucket TEXT NOT NULL DEFAULT 'attachments',
  
  -- OCR and processing status
  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  ocr_confidence FLOAT CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
  ocr_text TEXT, -- Raw OCR extracted text
  ocr_data JSONB, -- Structured OCR results
  
  -- Receipt-specific data
  receipt_total DECIMAL(10,2),
  receipt_date DATE,
  receipt_store TEXT,
  receipt_items JSONB, -- Array of extracted items with prices
  
  -- Processing metadata
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  processing_error TEXT,
  ai_model_used TEXT,
  
  -- User interaction
  user_confirmed BOOLEAN DEFAULT FALSE,
  user_modified BOOLEAN DEFAULT FALSE,
  user_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. OCR processing queue for background jobs
CREATE TABLE IF NOT EXISTS ocr_processing_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  processing_type TEXT NOT NULL CHECK (processing_type IN ('receipt_ocr', 'document_ocr', 'text_extraction')),
  priority INTEGER DEFAULT 1, -- Higher number = higher priority
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Extracted receipt items for shopping list integration
CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_price DECIMAL(10,2) NOT NULL,
  item_quantity INTEGER DEFAULT 1,
  item_category TEXT,
  item_brand TEXT,
  item_unit TEXT, -- e.g., 'lb', 'kg', 'each'
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  
  -- Shopping list integration
  added_to_shopping_list BOOLEAN DEFAULT FALSE,
  shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE SET NULL,
  shopping_item_id UUID REFERENCES shopping_items(id) ON DELETE SET NULL,
  
  -- User interaction
  user_confirmed BOOLEAN DEFAULT FALSE,
  user_modified BOOLEAN DEFAULT FALSE,
  user_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Price tracking and history
CREATE TABLE IF NOT EXISTS price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_brand TEXT,
  store_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  receipt_date DATE NOT NULL,
  attachment_id UUID REFERENCES attachments(id) ON DELETE SET NULL,
  receipt_item_id UUID REFERENCES receipt_items(id) ON DELETE SET NULL,
  
  -- Price analysis
  price_per_unit DECIMAL(10,2),
  unit_type TEXT,
  is_sale_price BOOLEAN DEFAULT FALSE,
  regular_price DECIMAL(10,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. OCR patterns and learning (for better extraction)
CREATE TABLE IF NOT EXISTS ocr_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('store_name', 'total_pattern', 'date_pattern', 'item_pattern')),
  pattern_regex TEXT NOT NULL,
  pattern_description TEXT,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  usage_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 1,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Store recognition and categorization
CREATE TABLE IF NOT EXISTS store_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  store_category TEXT, -- e.g., 'grocery', 'pharmacy', 'electronics'
  common_items JSONB, -- Array of frequently purchased items
  receipt_patterns JSONB, -- Store-specific receipt patterns
  average_receipt_total DECIMAL(10,2),
  receipt_count INTEGER DEFAULT 0,
  last_receipt_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attachments_household_status ON attachments(household_id, ocr_status);
CREATE INDEX IF NOT EXISTS idx_attachments_file_type ON attachments(file_type);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_receipt_date ON attachments(receipt_date DESC);

CREATE INDEX IF NOT EXISTS idx_ocr_queue_status_priority ON ocr_processing_queue(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_household ON ocr_processing_queue(household_id, status);

CREATE INDEX IF NOT EXISTS idx_receipt_items_attachment ON receipt_items(attachment_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_household ON receipt_items(household_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_shopping_list ON receipt_items(shopping_list_id);

CREATE INDEX IF NOT EXISTS idx_price_history_item_store ON price_history(item_name, store_name);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_household ON price_history(household_id);

CREATE INDEX IF NOT EXISTS idx_ocr_patterns_household_type ON ocr_patterns(household_id, pattern_type);
CREATE INDEX IF NOT EXISTS idx_store_profiles_household ON store_profiles(household_id);

-- Add Row Level Security (RLS) policies
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for attachments
CREATE POLICY "Users can view attachments in their household" ON attachments
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments to their household" ON attachments
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM users WHERE id = auth.uid()
    ) AND uploaded_by = auth.uid()
  );

CREATE POLICY "Users can update attachments in their household" ON attachments
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments in their household" ON attachments
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM users WHERE id = auth.uid()
    )
  );

-- RLS Policies for other tables (similar pattern)
CREATE POLICY "Users can view OCR queue in their household" ON ocr_processing_queue
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view receipt items in their household" ON receipt_items
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update receipt items in their household" ON receipt_items
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view price history in their household" ON price_history
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert price history in their household" ON price_history
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM users WHERE id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE attachments IS 'File attachments with OCR processing status and results';
COMMENT ON TABLE ocr_processing_queue IS 'Queue for background OCR processing jobs';
COMMENT ON TABLE receipt_items IS 'Individual items extracted from receipts';
COMMENT ON TABLE price_history IS 'Historical price tracking for items across stores';
COMMENT ON TABLE ocr_patterns IS 'Learned patterns for better OCR extraction';
COMMENT ON TABLE store_profiles IS 'Store-specific information and patterns';

-- Create Supabase Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);

-- Storage policies for attachments bucket
CREATE POLICY "Users can upload attachments to their household folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'attachments' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view attachments in their household" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'attachments' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own attachments" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'attachments' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
