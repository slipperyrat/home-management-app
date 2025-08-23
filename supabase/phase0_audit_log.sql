-- Phase 0: Audit Logging System
-- Run this in your Supabase SQL Editor

-- Create audit log table
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_id text not null,             -- clerk id
  household_id uuid,
  action text not null,               -- 'role.change' | 'reward.redeem' | 'delete' | 'chore.complete' | 'bill.paid'
  target_table text,                  -- table where the action occurred
  target_id text,                     -- id of the affected record
  meta jsonb not null default '{}',  -- additional context
  ip_address inet,                    -- IP address of the request
  user_agent text                     -- user agent string
);

-- Create indexes for audit log queries
create index if not exists audit_household_time_idx on audit_log (household_id, at desc);
create index if not exists audit_actor_time_idx on audit_log (actor_id, at desc);
create index if not exists audit_action_time_idx on audit_log (action, at desc);

-- Enable RLS on audit log
alter table audit_log enable row level security;

-- RLS policy: users can only see audit logs for their household
create policy "Users can view audit logs for their household" on audit_log
  for select using (
    household_id in (
      select household_id from household_members 
      where user_id = auth.jwt() ->> 'sub'
    )
  );

-- RLS policy: users can only see their own actions
create policy "Users can view their own actions" on audit_log
  for select using (
    actor_id = auth.jwt() ->> 'sub'
  );

-- Function to add audit log entry (call this from your API routes)
create or replace function add_audit_log(
  p_action text,
  p_target_table text default null,
  p_target_id text default null,
  p_meta jsonb default '{}'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_audit_id uuid;
  v_household_id uuid;
begin
  -- Get household_id from current user context
  select household_id into v_household_id
  from household_members 
  where user_id = auth.jwt() ->> 'sub'
  limit 1;
  
  -- Insert audit log entry
  insert into audit_log (
    actor_id,
    household_id,
    action,
    target_table,
    target_id,
    meta
  ) values (
    auth.jwt() ->> 'sub',
    v_household_id,
    p_action,
    p_target_table,
    p_target_id,
    p_meta
  ) returning id into v_audit_id;
  
  return v_audit_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function add_audit_log to authenticated;

-- Test the audit log system
-- select add_audit_log('test.action', 'test_table', 'test_id', '{"test": "data"}'::jsonb);
