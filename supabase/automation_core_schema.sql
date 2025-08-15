-- Automation Core Schema
-- This file creates the foundation for the AI automation system

-- 1) Events (append-only fact log)
create table if not exists public.household_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type text not null, -- e.g. 'bill.email.received', 'heartbeat', 'chore.completed'
  source text not null, -- 'app', 'webhook:mailgun', 'automation', etc.
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 2) Rules (deterministic automation triggers)
create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  description text,
  trigger_types text[] not null, -- e.g. {'bill.email.received','heartbeat','chore.completed'}
  conditions jsonb not null default '{}', -- simple filters/flags for future use
  actions jsonb not null default '[]', -- array of action objects
  enabled boolean not null default true,
  created_by text not null, -- Clerk user id (text)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Jobs (queued actions to be executed)
create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  rule_id uuid null references public.automation_rules(id) on delete set null,
  event_id uuid null references public.household_events(id) on delete set null,
  action text not null, -- e.g. 'create_bill','update_shopping_list','notify'
  params jsonb not null default '{}',
  dedupe_key text null, -- to avoid duplicates
  status text not null default 'pending', -- pending|processing|done|failed
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text null,
  created_at timestamptz not null default now(),
  processed_at timestamptz null,
  scheduled_for timestamptz null -- for delayed execution
);

-- 4) Bills table (first automation surface)
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  amount decimal(10,2) not null,
  currency text not null default 'AUD',
  due_date date not null,
  status text not null default 'pending', -- pending|paid|overdue|cancelled
  category text, -- utilities, rent, insurance, etc.
  description text,
  source text not null default 'manual', -- manual|email|automation
  source_data jsonb, -- original email content, receipt data, etc.
  assigned_to text, -- Clerk user id
  created_by text not null, -- Clerk user id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz null
);

-- 5) Notifications table (for automation outputs)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id text not null, -- Clerk user id
  title text not null,
  message text not null,
  type text not null default 'info', -- info|success|warning|error
  category text, -- automation|system|reminder
  read boolean not null default false,
  action_url text, -- optional link to relevant page
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

-- Indexes for performance
create index if not exists household_events_household_id_idx on public.household_events(household_id);
create index if not exists household_events_type_idx on public.household_events(type);
create index if not exists household_events_occurred_at_idx on public.household_events(occurred_at);

create index if not exists automation_rules_household_id_idx on public.automation_rules(household_id);
create index if not exists automation_rules_enabled_idx on public.automation_rules(enabled);

create index if not exists automation_jobs_status_idx on public.automation_jobs(status);
create index if not exists automation_jobs_household_id_idx on public.automation_jobs(household_id);
create index if not exists automation_jobs_scheduled_for_idx on public.automation_jobs(scheduled_for);
create unique index if not exists automation_jobs_dedupe_idx on public.automation_jobs(dedupe_key) where dedupe_key is not null;

create index if not exists bills_household_id_idx on public.bills(household_id);
create index if not exists bills_status_idx on public.bills(status);
create index if not exists bills_due_date_idx on public.bills(due_date);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_read_idx on public.notifications(read);
create index if not exists notifications_created_at_idx on public.notifications(created_at);

-- Enable RLS on all tables
alter table public.household_events enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_jobs enable row level security;
alter table public.bills enable row level security;
alter table public.notifications enable row level security;

-- RLS Policies for household_events
create policy "events_select_in_household"
on public.household_events
for select
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = household_events.household_id
      and hm.user_id = auth.uid()::text
  )
);

create policy "events_insert_in_household"
on public.household_events
for insert
with check (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = household_events.household_id
      and hm.user_id = auth.uid()::text
  )
);

-- RLS Policies for automation_rules (only owners can write; members can read)
create policy "rules_select_in_household"
on public.automation_rules
for select
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = automation_rules.household_id
      and hm.user_id = auth.uid()::text
  )
);

create policy "rules_insert_owner_only"
on public.automation_rules
for insert
with check (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = automation_rules.household_id
      and hm.user_id = auth.uid()::text
      and hm.role = 'owner'
  )
);

create policy "rules_update_owner_only"
on public.automation_rules
for update
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = automation_rules.household_id
      and hm.user_id = auth.uid()::text
      and hm.role = 'owner'
  )
)
with check (true);

-- RLS Policies for automation_jobs (read within household, writes by service)
create policy "jobs_select_in_household"
on public.automation_jobs
for select
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = automation_jobs.household_id
      and hm.user_id = auth.uid()::text
  )
);

-- RLS Policies for bills
create policy "bills_select_in_household"
on public.bills
for select
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = bills.household_id
      and hm.user_id = auth.uid()::text
  )
);

create policy "bills_insert_in_household"
on public.bills
for insert
with check (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = bills.household_id
      and hm.user_id = auth.uid()::text
  )
);

create policy "bills_update_in_household"
on public.bills
for update
using (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = bills.household_id
      and hm.user_id = auth.uid()::text
  )
)
with check (true);

-- RLS Policies for notifications
create policy "notifications_select_own"
on public.notifications
for select
using (user_id = auth.uid()::text);

create policy "notifications_insert_in_household"
on public.notifications
for insert
with check (
  exists (
    select 1 from public.household_members hm
    where hm.household_id = notifications.household_id
      and hm.user_id = auth.uid()::text
  )
);

create policy "notifications_update_own"
on public.notifications
for update
using (user_id = auth.uid()::text)
with check (true);

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_automation_rules_updated_at
  before update on public.automation_rules
  for each row
  execute function public.update_updated_at_column();

create trigger update_bills_updated_at
  before update on public.bills
  for each row
  execute function public.update_updated_at_column();
