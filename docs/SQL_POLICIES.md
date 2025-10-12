# Supabase RLS policies

```sql
-- Policy 1: allow insert into household_events if the user is a member of the household
create policy "Allow household members to log events"
on public.household_events
for insert
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id::uuid = household_events.household_id
      and hm.user_id = auth.uid()::text
  )
);

-- Policy 2: (optional) allow updates to payload/occurred_at by household members
create policy "Allow household members to update events"
on public.household_events
for update
using (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id::uuid = household_events.household_id
      and hm.user_id = auth.uid()::text
  )
)
with check (
  exists (
    select 1
    from public.household_members hm
    where hm.household_id::uuid = household_events.household_id
      and hm.user_id = auth.uid()::text
  )
);
```
