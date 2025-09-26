-- Fix missing completed column in shopping_items table
-- Run this to ensure the completed column exists

-- First, ensure the shopping_items table exists with the correct schema
CREATE TABLE IF NOT EXISTS shopping_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  category TEXT,
  completed BOOLEAN DEFAULT false,
  completed_by TEXT REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  ai_suggested BOOLEAN DEFAULT false,
  ai_confidence INTEGER DEFAULT 75,
  auto_added BOOLEAN DEFAULT FALSE,
  pending_confirmation BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add the completed column if it doesn't exist
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;

-- Add other missing columns that might be needed
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS completed_by TEXT REFERENCES users(id);
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS auto_added BOOLEAN DEFAULT FALSE;
ALTER TABLE shopping_items ADD COLUMN IF NOT EXISTS pending_confirmation BOOLEAN DEFAULT FALSE;

-- Update any existing rows to have proper defaults
UPDATE shopping_items SET completed = false WHERE completed IS NULL;
UPDATE shopping_items SET auto_added = FALSE WHERE auto_added IS NULL;
UPDATE shopping_items SET pending_confirmation = FALSE WHERE pending_confirmation IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN shopping_items.completed IS 'Whether this item has been purchased';
COMMENT ON COLUMN shopping_items.completed_by IS 'User who marked the item as completed';
COMMENT ON COLUMN shopping_items.completed_at IS 'When the item was marked as completed';
COMMENT ON COLUMN shopping_items.auto_added IS 'Whether this item was automatically added from meal planning';
COMMENT ON COLUMN shopping_items.pending_confirmation IS 'Whether this auto-added item is pending user confirmation';
