-- Create shopping lists and shopping items tables for Smart Shopping Lists
-- This file should be run in your Supabase SQL editor

-- 1. Create shopping_lists table
CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT false,
  ai_suggestions_count INTEGER DEFAULT 0,
  ai_confidence INTEGER DEFAULT 75,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create shopping_items table
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add missing columns to users table if they don't exist
DO $$ 
BEGIN
    -- Add household_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'household_id'
    ) THEN
        ALTER TABLE users ADD COLUMN household_id UUID REFERENCES households(id);
    END IF;
    
    -- Add clerk_id column if it doesn't exist (for compatibility)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'clerk_id'
    ) THEN
        ALTER TABLE users ADD COLUMN clerk_id TEXT;
    END IF;
END $$;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shopping_lists_household_id ON shopping_lists(household_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_created_by ON shopping_lists(created_by);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_created_at ON shopping_lists(created_at);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_is_completed ON shopping_lists(is_completed);

CREATE INDEX IF NOT EXISTS idx_shopping_items_list_id ON shopping_items(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_category ON shopping_items(category);
CREATE INDEX IF NOT EXISTS idx_shopping_items_completed ON shopping_items(completed);
CREATE INDEX IF NOT EXISTS idx_shopping_items_ai_suggested ON shopping_items(ai_suggested);

-- 5. Add Row Level Security (RLS) policies
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for shopping_lists
CREATE POLICY "Users can view shopping lists in their household" ON shopping_lists
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can create shopping lists in their household" ON shopping_lists
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can update shopping lists in their household" ON shopping_lists
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can delete shopping lists in their household" ON shopping_lists
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM household_members 
      WHERE user_id = auth.jwt() ->> 'sub'
    )
  );

-- 7. Create RLS policies for shopping_items
CREATE POLICY "Users can view shopping items in their household" ON shopping_items
  FOR SELECT USING (
    list_id IN (
      SELECT id FROM shopping_lists 
      WHERE household_id IN (
        SELECT household_id FROM household_members 
        WHERE user_id = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Users can create shopping items in their household" ON shopping_items
  FOR INSERT WITH CHECK (
    list_id IN (
      SELECT id FROM shopping_lists 
      WHERE household_id IN (
        SELECT household_id FROM household_members 
        WHERE user_id = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Users can update shopping items in their household" ON shopping_items
  FOR UPDATE USING (
    list_id IN (
      SELECT id FROM shopping_lists 
      WHERE household_id IN (
        SELECT household_id FROM household_members 
        WHERE user_id = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Users can delete shopping items in their household" ON shopping_items
  FOR DELETE USING (
    list_id IN (
      SELECT id FROM shopping_lists 
      WHERE household_id IN (
        SELECT household_id FROM household_members 
        WHERE user_id = auth.jwt() ->> 'sub'
      )
    )
  );

-- 8. Add comments to document the structure
COMMENT ON TABLE shopping_lists IS 'Shopping lists created by household members';
COMMENT ON TABLE shopping_items IS 'Individual items within shopping lists';

COMMENT ON COLUMN shopping_lists.title IS 'Name/title of the shopping list';
COMMENT ON COLUMN shopping_lists.description IS 'Optional description of the shopping list';
COMMENT ON COLUMN shopping_lists.household_id IS 'Household this list belongs to';
COMMENT ON COLUMN shopping_lists.created_by IS 'User who created the list';
COMMENT ON COLUMN shopping_lists.is_completed IS 'Whether all items in the list are completed';
COMMENT ON COLUMN shopping_lists.ai_suggestions_count IS 'Number of AI suggestions applied to this list';
COMMENT ON COLUMN shopping_lists.ai_confidence IS 'AI confidence score for this list (0-100)';

COMMENT ON COLUMN shopping_items.name IS 'Name of the shopping item';
COMMENT ON COLUMN shopping_items.quantity IS 'Quantity needed';
COMMENT ON COLUMN shopping_items.category IS 'Category of the item (e.g., Food, Household, etc.)';
COMMENT ON COLUMN shopping_items.completed IS 'Whether this item has been purchased';
COMMENT ON COLUMN shopping_items.completed_by IS 'User who marked the item as completed';
COMMENT ON COLUMN shopping_items.completed_at IS 'When the item was marked as completed';
COMMENT ON COLUMN shopping_items.ai_suggested IS 'Whether this item was suggested by AI';
COMMENT ON COLUMN shopping_items.ai_confidence IS 'AI confidence score for this item (0-100)';

-- 9. Grant necessary permissions
GRANT ALL ON shopping_lists TO authenticated;
GRANT ALL ON shopping_items TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
