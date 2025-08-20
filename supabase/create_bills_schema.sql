-- Bills Automation System Schema
-- This creates the foundation for automated bill management

-- 1. Bills table - stores all bill information
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  
  -- Bill details
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  
  -- Dates
  due_date DATE NOT NULL,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_date DATE,
  
  -- Status and categorization
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  category TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Automation metadata
  source TEXT DEFAULT 'manual', -- 'manual', 'email', 'automation', 'import'
  external_id TEXT, -- for integration with external systems
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL -- Clerk user ID
);

-- 2. Bill reminders table - for automated notifications
CREATE TABLE IF NOT EXISTS public.bill_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('due_soon', 'overdue', 'payment_confirmation')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  sent_to TEXT[], -- array of user IDs to notify
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS bills_household_id_idx ON public.bills(household_id);
CREATE INDEX IF NOT EXISTS bills_status_idx ON public.bills(status);
CREATE INDEX IF NOT EXISTS bills_due_date_idx ON public.bills(due_date);
CREATE INDEX IF NOT EXISTS bills_category_idx ON public.bills(category);
CREATE INDEX IF NOT EXISTS bills_created_by_idx ON public.bills(created_by);

CREATE INDEX IF NOT EXISTS bill_reminders_bill_id_idx ON public.bill_reminders(bill_id);
CREATE INDEX IF NOT EXISTS bill_reminders_household_id_idx ON public.bill_reminders(household_id);
CREATE INDEX IF NOT EXISTS bill_reminders_scheduled_for_idx ON public.bill_reminders(scheduled_for);

-- 4. Enable Row Level Security
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_reminders ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for bills table
-- Members can read bills in their household
CREATE POLICY "bills_select_in_household" ON public.bills
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = bills.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

-- Members can insert bills in their household
CREATE POLICY "bills_insert_in_household" ON public.bills
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = bills.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

-- Members can update bills in their household
CREATE POLICY "bills_update_in_household" ON public.bills
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = bills.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

-- 6. RLS Policies for bill_reminders table
CREATE POLICY "bill_reminders_select_in_household" ON public.bill_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm 
      WHERE hm.household_id = bill_reminders.household_id 
      AND hm.user_id = auth.uid()::text
    )
  );

-- 7. Sample automation rules for bills
INSERT INTO public.automation_rules (
  household_id,
  name,
  trigger_types,
  conditions,
  actions,
  enabled,
  created_by
) VALUES 
-- Rule 1: Create bill from email event
(
  (SELECT id FROM public.households LIMIT 1), -- Replace with actual household ID
  'Auto-Create Bill from Email',
  ARRAY['bill.email.received'],
  '{}'::jsonb,
  '[{"name": "create_bill", "params": {"source": "email"}}]'::jsonb,
  true,
  'system'
),
-- Rule 2: Send reminder for due bills
(
  (SELECT id FROM public.households LIMIT 1), -- Replace with actual household ID
  'Bill Due Reminder',
  ARRAY['heartbeat'],
  '{}'::jsonb,
  '[{"name": "check_due_bills", "params": {"reminder_days": [7, 3, 1]}}]'::jsonb,
  true,
  'system'
),
-- Rule 3: Mark bills as overdue
(
  (SELECT id FROM public.households LIMIT 1), -- Replace with actual household ID
  'Mark Overdue Bills',
  ARRAY['heartbeat'],
  '{}'::jsonb,
  '[{"name": "mark_overdue_bills", "params": {}}]'::jsonb,
  true,
  'system'
);

-- 8. Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger to automatically update updated_at
CREATE TRIGGER bills_updated_at_trigger
  BEFORE UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION update_bills_updated_at();

-- 10. Function to calculate bill status
CREATE OR REPLACE FUNCTION calculate_bill_status(
  p_due_date DATE,
  p_paid_date DATE,
  p_status TEXT
)
RETURNS TEXT AS $$
BEGIN
  -- If already paid, return paid
  IF p_paid_date IS NOT NULL THEN
    RETURN 'paid';
  END IF;
  
  -- If due date has passed and not paid, return overdue
  IF p_due_date < CURRENT_DATE THEN
    RETURN 'overdue';
  END IF;
  
  -- Otherwise return pending
  RETURN 'pending';
END;
$$ LANGUAGE plpgsql;

-- 11. Function to automatically update bill status
CREATE OR REPLACE FUNCTION update_bill_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if status is not explicitly set to something other than pending
  IF NEW.status = 'pending' THEN
    NEW.status = calculate_bill_status(NEW.due_date, NEW.paid_date, NEW.status);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Trigger to automatically update bill status
CREATE TRIGGER bills_status_trigger
  BEFORE INSERT OR UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION update_bill_status();

-- 13. Sample data for testing (optional)
INSERT INTO public.bills (
  household_id,
  title,
  description,
  amount,
  due_date,
  category,
  priority,
  created_by
) VALUES 
(
  (SELECT id FROM public.households LIMIT 1), -- Replace with actual household ID
  'Electricity Bill - January 2024',
  'Monthly electricity bill from Origin Energy',
  89.50,
  CURRENT_DATE + INTERVAL '14 days',
  'Utilities',
  'medium',
  'system'
),
(
  (SELECT id FROM public.households LIMIT 1), -- Replace with actual household ID
  'Internet Bill - February 2024',
  'Monthly internet and phone bundle from Telstra',
  79.00,
  CURRENT_DATE + INTERVAL '7 days',
  'Utilities',
  'medium',
  'system'
);

-- 14. Comments for documentation
COMMENT ON TABLE public.bills IS 'Stores household bills with automation support';
COMMENT ON TABLE public.bill_reminders IS 'Stores automated bill reminders and notifications';
COMMENT ON COLUMN public.bills.source IS 'How the bill was created: manual, email, automation, or import';
COMMENT ON COLUMN public.bills.external_id IS 'External system ID for integrations (e.g., bank transaction ID)';
COMMENT ON COLUMN public.bills.priority IS 'Bill priority for reminder scheduling and display order';
