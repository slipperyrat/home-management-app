-- supabase/migrations/202509270930_fix_rls_policies.sql

BEGIN;

-------------------------------------------------------------------------------
-- Daily digests (Initial Review: critical exposure, CSV_B daily_digests row)
-------------------------------------------------------------------------------
ALTER TABLE public.daily_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_digests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_digests_select_household_members ON public.daily_digests;
CREATE POLICY daily_digests_select_household_members ON public.daily_digests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.daily_digests.household_id
        AND hm.user_id = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS daily_digests_insert_service_role ON public.daily_digests;
CREATE POLICY daily_digests_insert_service_role ON public.daily_digests
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS daily_digests_update_service_role ON public.daily_digests;
CREATE POLICY daily_digests_update_service_role ON public.daily_digests
  FOR UPDATE TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS daily_digests_delete_service_role ON public.daily_digests;
CREATE POLICY daily_digests_delete_service_role ON public.daily_digests
  FOR DELETE TO authenticated
  USING (auth.role() = 'service_role');

-------------------------------------------------------------------------------
-- Entitlements (Initial Review: high severity insert, CSV_B entitlements rows)
-------------------------------------------------------------------------------
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entitlements_select_household_members ON public.entitlements;
CREATE POLICY entitlements_select_household_members ON public.entitlements
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.entitlements.household_id
        AND hm.user_id = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS entitlements_insert_service_role ON public.entitlements;
CREATE POLICY entitlements_insert_service_role ON public.entitlements
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS entitlements_update_household_members ON public.entitlements;
CREATE POLICY entitlements_update_household_members ON public.entitlements
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.entitlements.household_id
        AND hm.user_id = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.entitlements.household_id
        AND hm.user_id = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS entitlements_delete_service_role ON public.entitlements;
CREATE POLICY entitlements_delete_service_role ON public.entitlements
  FOR DELETE TO authenticated
  USING (auth.role() = 'service_role');

-------------------------------------------------------------------------------
-- Households (Initial Review high severity: RLS never enabled)
-------------------------------------------------------------------------------
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.households FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their household subscription data" ON public.households;
DROP POLICY IF EXISTS "Users can view their household plan" ON public.households;
CREATE POLICY households_select_membership ON public.households
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.households.id
        AND hm.user_id = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Only owners can update subscription data" ON public.households;
DROP POLICY IF EXISTS "Only owners can update household plan" ON public.households;
CREATE POLICY households_update_owners ON public.households
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.households.id
        AND hm.user_id = auth.uid()::text
        AND hm.role = 'owner'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.households.id
        AND hm.user_id = auth.uid()::text
        AND hm.role = 'owner'
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS households_insert_service_role ON public.households;
CREATE POLICY households_insert_service_role ON public.households
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS households_delete_service_role ON public.households;
CREATE POLICY households_delete_service_role ON public.households
  FOR DELETE TO authenticated
  USING (auth.role() = 'service_role');

-------------------------------------------------------------------------------
-- Household members (Initial Review & CSV_C household_members row)
-------------------------------------------------------------------------------
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS household_members_select_self_household ON public.household_members;
CREATE POLICY household_members_select_own ON public.household_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR auth.role() = 'service_role');

DROP POLICY IF EXISTS household_members_insert_service_role ON public.household_members;
CREATE POLICY household_members_insert_service_role ON public.household_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS household_members_update_service_role ON public.household_members;
CREATE POLICY household_members_update_service_role ON public.household_members
  FOR UPDATE TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS household_members_delete_service_role ON public.household_members;
CREATE POLICY household_members_delete_service_role ON public.household_members
  FOR DELETE TO authenticated
  USING (auth.role() = 'service_role');

-------------------------------------------------------------------------------
-- Shopping lists (CSV_C shopping_lists, CSV_B policy rows)
-------------------------------------------------------------------------------
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopping_lists_select_household ON public.shopping_lists;
CREATE POLICY shopping_lists_select_household ON public.shopping_lists
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.shopping_lists.household_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS shopping_lists_insert_household ON public.shopping_lists;
CREATE POLICY shopping_lists_insert_household ON public.shopping_lists
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.shopping_lists.household_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS shopping_lists_update_household ON public.shopping_lists;
CREATE POLICY shopping_lists_update_household ON public.shopping_lists
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.shopping_lists.household_id
        AND hm.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.shopping_lists.household_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS shopping_lists_delete_household ON public.shopping_lists;
CREATE POLICY shopping_lists_delete_household ON public.shopping_lists
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.shopping_lists.household_id
        AND hm.user_id = auth.uid()::text
    )
  );

-------------------------------------------------------------------------------
-- Shopping items (CSV_C shopping_items, CSV_B policy rows)
-------------------------------------------------------------------------------
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopping_items_select_household ON public.shopping_items;
CREATE POLICY shopping_items_select_household ON public.shopping_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      JOIN public.household_members hm ON hm.household_id = sl.household_id
      WHERE sl.id = public.shopping_items.list_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS shopping_items_insert_household ON public.shopping_items;
CREATE POLICY shopping_items_insert_household ON public.shopping_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      JOIN public.household_members hm ON hm.household_id = sl.household_id
      WHERE sl.id = public.shopping_items.list_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS shopping_items_update_household ON public.shopping_items;
CREATE POLICY shopping_items_update_household ON public.shopping_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      JOIN public.household_members hm ON hm.household_id = sl.household_id
      WHERE sl.id = public.shopping_items.list_id
        AND hm.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      JOIN public.household_members hm ON hm.household_id = sl.household_id
      WHERE sl.id = public.shopping_items.list_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS shopping_items_delete_household ON public.shopping_items;
CREATE POLICY shopping_items_delete_household ON public.shopping_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists sl
      JOIN public.household_members hm ON hm.household_id = sl.household_id
      WHERE sl.id = public.shopping_items.list_id
        AND hm.user_id = auth.uid()::text
    )
  );

-------------------------------------------------------------------------------
-- Audit logs (CSV_C audit_logs row)
-------------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_own ON public.audit_logs;
CREATE POLICY audit_logs_select_own ON public.audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS audit_logs_insert_own ON public.audit_logs;
CREATE POLICY audit_logs_insert_own ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS audit_logs_update_service_role ON public.audit_logs;
CREATE POLICY audit_logs_update_service_role ON public.audit_logs
  FOR UPDATE TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS audit_logs_delete_service_role ON public.audit_logs;
CREATE POLICY audit_logs_delete_service_role ON public.audit_logs
  FOR DELETE TO authenticated
  USING (auth.role() = 'service_role');

-------------------------------------------------------------------------------
-- Security events (CSV_C security_events row)
-------------------------------------------------------------------------------
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_events_select_own ON public.security_events;
CREATE POLICY security_events_select_own ON public.security_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text OR auth.role() = 'service_role');

DROP POLICY IF EXISTS security_events_insert_service_role ON public.security_events;
CREATE POLICY security_events_insert_service_role ON public.security_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS security_events_update_service_role ON public.security_events;
CREATE POLICY security_events_update_service_role ON public.security_events
  FOR UPDATE TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS security_events_delete_service_role ON public.security_events;
CREATE POLICY security_events_delete_service_role ON public.security_events
  FOR DELETE TO authenticated
  USING (auth.role() = 'service_role');

-------------------------------------------------------------------------------
-- User sessions (CSV_C user_sessions row)
-------------------------------------------------------------------------------
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_sessions_select_own ON public.user_sessions;
CREATE POLICY user_sessions_select_own ON public.user_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS user_sessions_insert_service_role ON public.user_sessions;
CREATE POLICY user_sessions_insert_service_role ON public.user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS user_sessions_update_service_role ON public.user_sessions;
CREATE POLICY user_sessions_update_service_role ON public.user_sessions
  FOR UPDATE TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS user_sessions_delete_service_role ON public.user_sessions;
CREATE POLICY user_sessions_delete_service_role ON public.user_sessions
  FOR DELETE TO authenticated
  USING (auth.role() = 'service_role');

-------------------------------------------------------------------------------
-- Household events (CSV_C household_events row)
-------------------------------------------------------------------------------
ALTER TABLE public.household_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS household_events_select_household ON public.household_events;
CREATE POLICY household_events_select_household ON public.household_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.household_events.household_id
        AND hm.user_id = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS household_events_insert_household ON public.household_events;
CREATE POLICY household_events_insert_household ON public.household_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.household_events.household_id
        AND hm.user_id = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS household_events_update_household ON public.household_events;
CREATE POLICY household_events_update_household ON public.household_events
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.household_events.household_id
        AND hm.user_id = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.household_events.household_id
        AND hm.user_id = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS household_events_delete_household ON public.household_events;
CREATE POLICY household_events_delete_household ON public.household_events
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members hm
      WHERE hm.household_id = public.household_events.household_id
        AND hm.user_id = auth.uid()::text
    )
    OR auth.role() = 'service_role'
  );

-------------------------------------------------------------------------------
-- Event attendees & reminders (Initial Review high severity gap)
-------------------------------------------------------------------------------
DROP POLICY IF EXISTS event_attendees_household_select ON public.event_attendees;
CREATE POLICY event_attendees_household_select ON public.event_attendees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.household_members hm ON hm.household_id = e.household_id
      WHERE e.id = public.event_attendees.event_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS event_attendees_household_insert ON public.event_attendees;
CREATE POLICY event_attendees_household_insert ON public.event_attendees
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.household_members hm ON hm.household_id = e.household_id
      WHERE e.id = public.event_attendees.event_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS event_attendees_household_update ON public.event_attendees;
CREATE POLICY event_attendees_household_update ON public.event_attendees
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.household_members hm ON hm.household_id = e.household_id
      WHERE e.id = public.event_attendees.event_id
        AND hm.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.household_members hm ON hm.household_id = e.household_id
      WHERE e.id = public.event_attendees.event_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS event_attendees_household_delete ON public.event_attendees;
CREATE POLICY event_attendees_household_delete ON public.event_attendees
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.household_members hm ON hm.household_id = e.household_id
      WHERE e.id = public.event_attendees.event_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS event_reminders_household_select ON public.event_reminders;
CREATE POLICY event_reminders_household_select ON public.event_reminders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.household_members hm ON hm.household_id = e.household_id
      WHERE e.id = public.event_reminders.event_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS event_reminders_household_insert ON public.event_reminders;
CREATE POLICY event_reminders_household_insert ON public.event_reminders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.household_members hm ON hm.household_id = e.household_id
      WHERE e.id = public.event_reminders.event_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS event_reminders_household_update ON public.event_reminders;
CREATE POLICY event_reminders_household_update ON public.event_reminders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.household_members hm ON hm.household_id = e.household_id
      WHERE e.id = public.event_reminders.event_id
        AND hm.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.household_members hm ON hm.household_id = e.household_id
      WHERE e.id = public.event_reminders.event_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS event_reminders_household_delete ON public.event_reminders;
CREATE POLICY event_reminders_household_delete ON public.event_reminders
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.household_members hm ON hm.household_id = e.household_id
      WHERE e.id = public.event_reminders.event_id
        AND hm.user_id = auth.uid()::text
    )
  );

-------------------------------------------------------------------------------
-- Smart chore tables (Initial Review: critical FOR ALL USING true)
-------------------------------------------------------------------------------
ALTER TABLE public.chore_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chore_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chore_assignments_select_household ON public.chore_assignments;
CREATE POLICY chore_assignments_select_household ON public.chore_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_assignments.chore_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS chore_assignments_insert_household ON public.chore_assignments;
CREATE POLICY chore_assignments_insert_household ON public.chore_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_assignments.chore_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS chore_assignments_update_household ON public.chore_assignments;
CREATE POLICY chore_assignments_update_household ON public.chore_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_assignments.chore_id
        AND hm.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_assignments.chore_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS chore_assignments_delete_household ON public.chore_assignments;
CREATE POLICY chore_assignments_delete_household ON public.chore_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_assignments.chore_id
        AND hm.user_id = auth.uid()::text
    )
  );

ALTER TABLE public.chore_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chore_preferences FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chore_preferences_select_own ON public.chore_preferences;
CREATE POLICY chore_preferences_select_own ON public.chore_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS chore_preferences_insert_own ON public.chore_preferences;
CREATE POLICY chore_preferences_insert_own ON public.chore_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS chore_preferences_update_own ON public.chore_preferences;
CREATE POLICY chore_preferences_update_own ON public.chore_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS chore_preferences_delete_own ON public.chore_preferences;
CREATE POLICY chore_preferences_delete_own ON public.chore_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

ALTER TABLE public.chore_completion_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chore_completion_patterns FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chore_completion_patterns_select_scope ON public.chore_completion_patterns;
CREATE POLICY chore_completion_patterns_select_scope ON public.chore_completion_patterns
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_completion_patterns.chore_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS chore_completion_patterns_insert_own ON public.chore_completion_patterns;
CREATE POLICY chore_completion_patterns_insert_own ON public.chore_completion_patterns
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS chore_completion_patterns_update_own ON public.chore_completion_patterns;
CREATE POLICY chore_completion_patterns_update_own ON public.chore_completion_patterns
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

DROP POLICY IF EXISTS chore_completion_patterns_delete_own ON public.chore_completion_patterns;
CREATE POLICY chore_completion_patterns_delete_own ON public.chore_completion_patterns
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

ALTER TABLE public.chore_ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chore_ai_insights FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chore_ai_insights_select_service_role ON public.chore_ai_insights;
CREATE POLICY chore_ai_insights_select_service_role ON public.chore_ai_insights
  FOR SELECT TO authenticated
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS chore_ai_insights_insert_service_role ON public.chore_ai_insights;
CREATE POLICY chore_ai_insights_insert_service_role ON public.chore_ai_insights
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS chore_ai_insights_update_service_role ON public.chore_ai_insights;
CREATE POLICY chore_ai_insights_update_service_role ON public.chore_ai_insights
  FOR UPDATE TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS chore_ai_insights_delete_service_role ON public.chore_ai_insights;
CREATE POLICY chore_ai_insights_delete_service_role ON public.chore_ai_insights
  FOR DELETE TO authenticated
  USING (auth.role() = 'service_role');

ALTER TABLE public.chore_rotation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chore_rotation_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chore_rotation_schedules_select_household ON public.chore_rotation_schedules;
CREATE POLICY chore_rotation_schedules_select_household ON public.chore_rotation_schedules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_rotation_schedules.chore_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS chore_rotation_schedules_insert_household ON public.chore_rotation_schedules;
CREATE POLICY chore_rotation_schedules_insert_household ON public.chore_rotation_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_rotation_schedules.chore_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS chore_rotation_schedules_update_household ON public.chore_rotation_schedules;
CREATE POLICY chore_rotation_schedules_update_household ON public.chore_rotation_schedules
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_rotation_schedules.chore_id
        AND hm.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_rotation_schedules.chore_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS chore_rotation_schedules_delete_household ON public.chore_rotation_schedules;
CREATE POLICY chore_rotation_schedules_delete_household ON public.chore_rotation_schedules
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chores c
      JOIN public.household_members hm ON hm.household_id = c.household_id
      WHERE c.id = public.chore_rotation_schedules.chore_id
        AND hm.user_id = auth.uid()::text
    )
  );

-------------------------------------------------------------------------------
-- Attachments & storage (Initial Review type mismatch risk)
-------------------------------------------------------------------------------
DROP POLICY IF EXISTS attachments_household_select ON public.attachments;
CREATE POLICY attachments_household_select ON public.attachments
  FOR SELECT TO authenticated
  USING (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS attachments_household_insert ON public.attachments;
CREATE POLICY attachments_household_insert ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
    AND uploaded_by = auth.uid()::text
  );

DROP POLICY IF EXISTS attachments_household_update ON public.attachments;
CREATE POLICY attachments_household_update ON public.attachments
  FOR UPDATE TO authenticated
  USING (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  )
  WITH CHECK (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS attachments_household_delete ON public.attachments;
CREATE POLICY attachments_household_delete ON public.attachments
  FOR DELETE TO authenticated
  USING (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS storage_objects_owner_select ON storage.objects;
CREATE POLICY storage_objects_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS storage_objects_owner_insert ON storage.objects;
CREATE POLICY storage_objects_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS storage_objects_owner_delete ON storage.objects;
CREATE POLICY storage_objects_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
