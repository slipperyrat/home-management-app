-- Complete Finance Module Schema
-- Extends existing bills schema with budget envelopes and spending tracking

-- 1. Budget Envelopes Table
CREATE TABLE IF NOT EXISTS public.budget_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  
  -- Envelope details
  name TEXT NOT NULL,
  description TEXT,
  allocated_amount DECIMAL(10,2) NOT NULL CHECK (allocated_amount >= 0),
  spent_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
  
  -- Budget period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Categorization
  category TEXT NOT NULL DEFAULT 'general',
  color TEXT DEFAULT '#3B82F6', -- Hex color for UI
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL, -- Clerk user ID
  
  -- Constraints
  CONSTRAINT budget_envelope_period_check CHECK (period_end > period_start),
  CONSTRAINT budget_envelope_spent_check CHECK (spent_amount <= allocated_amount)
);

-- 2. Spending Entries Table
CREATE TABLE IF NOT EXISTS public.spend_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  
  -- Transaction details
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  category TEXT,
  
  -- Optional associations
  envelope_id UUID REFERENCES public.budget_envelopes(id) ON DELETE SET NULL,
  bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  receipt_attachment_id UUID, -- For future receipt integration
  
  -- Transaction metadata
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  merchant TEXT,
  payment_method TEXT, -- 'cash', 'card', 'bank_transfer', 'other'
  
  -- Automation metadata
  source TEXT DEFAULT 'manual', -- 'manual', 'receipt_ocr', 'bill_payment', 'import'
  external_id TEXT, -- for integration with external systems
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL -- Clerk user ID
);

-- 3. Finance Categories Table (for consistent categorization)
CREATE TABLE IF NOT EXISTS public.finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT '💰', -- Emoji icon
  
  -- Category type
  type TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('income', 'expense', 'transfer')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL,
  
  -- Unique constraint per household
  UNIQUE(household_id, name, type)
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS budget_envelopes_household_id_idx ON public.budget_envelopes(household_id);
CREATE INDEX IF NOT EXISTS budget_envelopes_period_idx ON public.budget_envelopes(period_start, period_end);
CREATE INDEX IF NOT EXISTS budget_envelopes_category_idx ON public.budget_envelopes(category);
CREATE INDEX IF NOT EXISTS budget_envelopes_created_by_idx ON public.budget_envelopes(created_by);

CREATE INDEX IF NOT EXISTS spend_entries_household_id_idx ON public.spend_entries(household_id);
CREATE INDEX IF NOT EXISTS spend_entries_transaction_date_idx ON public.spend_entries(transaction_date);
CREATE INDEX IF NOT EXISTS spend_entries_category_idx ON public.spend_entries(category);
CREATE INDEX IF NOT EXISTS spend_entries_envelope_id_idx ON public.spend_entries(envelope_id);
CREATE INDEX IF NOT EXISTS spend_entries_bill_id_idx ON public.spend_entries(bill_id);
CREATE INDEX IF NOT EXISTS spend_entries_created_by_idx ON public.spend_entries(created_by);

CREATE INDEX IF NOT EXISTS finance_categories_household_id_idx ON public.finance_categories(household_id);
CREATE INDEX IF NOT EXISTS finance_categories_type_idx ON public.finance_categories(type);

-- 5. Enable Row Level Security
ALTER TABLE public.budget_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spend_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for budget_envelopes
CREATE POLICY "budget_envelopes_select_in_household" ON public.budget_envelopes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = budget_envelopes.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY "budget_envelopes_insert_in_household" ON public.budget_envelopes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = budget_envelopes.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY "budget_envelopes_update_in_household" ON public.budget_envelopes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = budget_envelopes.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY "budget_envelopes_delete_in_household" ON public.budget_envelopes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = budget_envelopes.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

-- 7. RLS Policies for spend_entries
CREATE POLICY "spend_entries_select_in_household" ON public.spend_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = spend_entries.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY "spend_entries_insert_in_household" ON public.spend_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = spend_entries.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY "spend_entries_update_in_household" ON public.spend_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = spend_entries.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY "spend_entries_delete_in_household" ON public.spend_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = spend_entries.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

-- 8. RLS Policies for finance_categories
CREATE POLICY "finance_categories_select_in_household" ON public.finance_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = finance_categories.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY "finance_categories_insert_in_household" ON public.finance_categories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = finance_categories.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY "finance_categories_update_in_household" ON public.finance_categories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = finance_categories.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY "finance_categories_delete_in_household" ON public.finance_categories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = finance_categories.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

-- 9. Functions for automatic updates
CREATE OR REPLACE FUNCTION update_budget_envelopes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_spend_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_finance_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Triggers for automatic timestamp updates
CREATE TRIGGER budget_envelopes_updated_at_trigger
  BEFORE UPDATE ON public.budget_envelopes
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_envelopes_updated_at();

CREATE TRIGGER spend_entries_updated_at_trigger
  BEFORE UPDATE ON public.spend_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_spend_entries_updated_at();

CREATE TRIGGER finance_categories_updated_at_trigger
  BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_categories_updated_at();

-- 11. Function to update envelope spent amount when spend entry is added
CREATE OR REPLACE FUNCTION update_envelope_spent_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if envelope_id is provided
  IF NEW.envelope_id IS NOT NULL THEN
    UPDATE public.budget_envelopes 
    SET spent_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.spend_entries 
      WHERE envelope_id = NEW.envelope_id
    )
    WHERE id = NEW.envelope_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Trigger to update envelope spent amount
CREATE TRIGGER update_envelope_spent_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.spend_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_envelope_spent_amount();

-- 13. Default finance categories for new households
CREATE OR REPLACE FUNCTION create_default_finance_categories(p_household_id UUID, p_created_by TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.finance_categories (household_id, name, description, type, color, icon, created_by) VALUES
    (p_household_id, 'Groceries', 'Food and household supplies', 'expense', '#10B981', '🛒', p_created_by),
    (p_household_id, 'Utilities', 'Electricity, gas, water, internet', 'expense', '#F59E0B', '⚡', p_created_by),
    (p_household_id, 'Transportation', 'Fuel, public transport, car maintenance', 'expense', '#3B82F6', '🚗', p_created_by),
    (p_household_id, 'Entertainment', 'Movies, dining out, hobbies', 'expense', '#8B5CF6', '🎬', p_created_by),
    (p_household_id, 'Healthcare', 'Medical expenses, prescriptions', 'expense', '#EF4444', '🏥', p_created_by),
    (p_household_id, 'General', 'Miscellaneous expenses', 'expense', '#6B7280', '💰', p_created_by),
    (p_household_id, 'Salary', 'Regular income from employment', 'income', '#059669', '💼', p_created_by),
    (p_household_id, 'Other Income', 'Freelance, investments, gifts', 'income', '#0D9488', '💵', p_created_by)
  ON CONFLICT (household_id, name, type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 14. Sample data for testing (optional - uncomment for testing)
/*
-- Create sample budget envelopes
INSERT INTO public.budget_envelopes (
  household_id,
  name,
  description,
  allocated_amount,
  period_start,
  period_end,
  category,
  created_by
) VALUES 
(
  (SELECT id FROM public.households LIMIT 1), -- Replace with actual household ID
  'Groceries',
  'Monthly grocery budget',
  400.00,
  DATE_TRUNC('month', CURRENT_DATE),
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
  'groceries',
  'system'
),
(
  (SELECT id FROM public.households LIMIT 1), -- Replace with actual household ID
  'Utilities',
  'Monthly utility bills',
  200.00,
  DATE_TRUNC('month', CURRENT_DATE),
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
  'utilities',
  'system'
);

-- Create sample spending entries
INSERT INTO public.spend_entries (
  household_id,
  amount,
  description,
  category,
  envelope_id,
  transaction_date,
  payment_method,
  created_by
) VALUES 
(
  (SELECT id FROM public.households LIMIT 1), -- Replace with actual household ID
  45.67,
  'Weekly grocery shopping at Coles',
  'groceries',
  (SELECT id FROM public.budget_envelopes WHERE name = 'Groceries' LIMIT 1),
  CURRENT_DATE - INTERVAL '2 days',
  'card',
  'system'
),
(
  (SELECT id FROM public.households LIMIT 1), -- Replace with actual household ID
  89.50,
  'Electricity bill payment',
  'utilities',
  (SELECT id FROM public.budget_envelopes WHERE name = 'Utilities' LIMIT 1),
  CURRENT_DATE - INTERVAL '1 day',
  'bank_transfer',
  'system'
);
*/

-- 15. Comments for documentation
COMMENT ON TABLE public.budget_envelopes IS 'Budget envelopes for envelope budgeting method';
COMMENT ON TABLE public.spend_entries IS 'Individual spending transactions';
COMMENT ON TABLE public.finance_categories IS 'Standardized categories for bills and spending';
COMMENT ON COLUMN public.budget_envelopes.allocated_amount IS 'Total amount allocated to this envelope';
COMMENT ON COLUMN public.budget_envelopes.spent_amount IS 'Amount spent from this envelope (auto-calculated)';
COMMENT ON COLUMN public.spend_entries.envelope_id IS 'Optional association with budget envelope';
COMMENT ON COLUMN public.spend_entries.bill_id IS 'Optional association with bill payment';
COMMENT ON COLUMN public.spend_entries.source IS 'How the entry was created: manual, receipt_ocr, bill_payment, import';
