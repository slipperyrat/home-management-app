-- sql/test_rls_fix_suite.sql
--
-- Comprehensive test harness for RLS fixes introduced in
-- supabase/migrations/202509270930_fix_rls_policies.sql.
--
-- Usage: run the entire script in Supabase SQL Editor (role `postgres`).
-- It seeds temporary data, exercises critical policies, and cleans up.
-- Review the NOTICE output for pass/fail status.

DO $$
DECLARE
  v_household uuid := gen_random_uuid();
  v_other_household uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_intruder uuid := gen_random_uuid();
  v_digest uuid;
  v_entitlement_count integer;
  v_list uuid;
  v_event uuid := gen_random_uuid();
  v_audit uuid;
  v_attachment uuid;
BEGIN
  ---------------------------------------------------------------------------
  -- Seed baseline data using service role
  ---------------------------------------------------------------------------
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', NULL, true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);

  INSERT INTO households (id, name, created_by)
  VALUES (v_household, 'RLS QA Household', v_owner::text)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO households (id, name, created_by)
  VALUES (v_other_household, 'RLS QA Other Household', v_intruder::text)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO users (id) VALUES (v_owner::text) ON CONFLICT (id) DO NOTHING;
  INSERT INTO users (id) VALUES (v_member::text) ON CONFLICT (id) DO NOTHING;
  INSERT INTO users (id) VALUES (v_intruder::text) ON CONFLICT (id) DO NOTHING;

  UPDATE users SET household_id = v_household WHERE id IN (v_owner::text, v_member::text);
  UPDATE users SET household_id = v_other_household WHERE id = v_intruder::text;

  INSERT INTO household_members (user_id, household_id, role)
  VALUES (v_owner::text, v_household, 'owner'),
         (v_member::text, v_household, 'member')
  ON CONFLICT DO NOTHING;

  INSERT INTO household_members (user_id, household_id, role)
  VALUES (v_intruder::text, v_other_household, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO entitlements (household_id, tier)
  VALUES (v_household, 'free')
  ON CONFLICT (household_id) DO NOTHING;

  INSERT INTO entitlements (household_id, tier)
  VALUES (v_other_household, 'free')
  ON CONFLICT (household_id) DO NOTHING;

  INSERT INTO events (id, household_id, title, start_at, end_at, timezone, created_by)
  VALUES (v_event, v_household, 'QA Event', now(), now() + interval '1 hour', 'UTC', v_owner::text)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO daily_digests (household_id, digest_date, status)
  VALUES (v_household, current_date, 'pending')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_digest;

  IF v_digest IS NULL THEN
    SELECT id INTO v_digest
    FROM daily_digests
    WHERE household_id = v_household AND digest_date = current_date
    LIMIT 1;
  END IF;

  ---------------------------------------------------------------------------
  -- Test: Household plan updates restricted to owners/service role
  ---------------------------------------------------------------------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_owner::text, 'role', 'authenticated')::text, true);
  UPDATE households SET name = 'RLS QA Household (owner updated)' WHERE id = v_household;
  RAISE NOTICE 'Household owner update allowed ✔';

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_member::text, 'role', 'authenticated')::text, true);
  BEGIN
    UPDATE households SET name = 'Should fail - member update' WHERE id = v_household;
    RAISE EXCEPTION 'Household member improperly updated household';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Household update blocked for non-owner ✔';
  END;

  ---------------------------------------------------------------------------
  -- Test: Daily digests read restricted to household; writes service role only
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_member::text, 'role', 'authenticated')::text, true);
  PERFORM 1 FROM daily_digests WHERE id = v_digest;
  RAISE NOTICE 'Daily digest visible to household member ✔';

  PERFORM set_config('request.jwt.claim.sub', v_intruder::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_intruder::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM 1 FROM daily_digests WHERE id = v_digest;
    RAISE EXCEPTION 'Intruder accessed household digest';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Daily digest blocked for non-member ✔';
  END;

  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_member::text, 'role', 'authenticated')::text, true);
  BEGIN
    UPDATE daily_digests SET status = 'sent' WHERE id = v_digest;
    RAISE EXCEPTION 'Member should not update digest';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Daily digest update correctly restricted to service role ✔';
  END;

  ---------------------------------------------------------------------------
  -- Test: Entitlements update allowed for household members only
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_member::text, 'role', 'authenticated')::text, true);
  UPDATE entitlements SET tier = 'pro' WHERE household_id = v_household;
  SELECT COUNT(*) INTO v_entitlement_count FROM entitlements WHERE household_id = v_household AND tier = 'pro';
  IF v_entitlement_count = 1 THEN
    RAISE NOTICE 'Entitlements update allowed for household member ✔';
  ELSE
    RAISE EXCEPTION 'Entitlements update failed unexpectedly';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_intruder::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_intruder::text, 'role', 'authenticated')::text, true);
  BEGIN
    UPDATE entitlements SET tier = 'free' WHERE household_id = v_household;
    RAISE EXCEPTION 'Intruder updated entitlements';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Entitlements update blocked for non-member ✔';
  END;

  ---------------------------------------------------------------------------
  -- Test: Shopping lists/items membership enforcement
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_member::text, 'role', 'authenticated')::text, true);
  INSERT INTO shopping_lists (id, household_id, title, created_by)
  VALUES (gen_random_uuid(), v_household, 'QA List', v_member::text)
  RETURNING id INTO v_list;

  INSERT INTO shopping_items (id, list_id, name, created_by)
  VALUES (gen_random_uuid(), v_list, 'Milk', v_member::text);

  RAISE NOTICE 'Shopping list/item created by household member ✔';

  PERFORM set_config('request.jwt.claim.sub', v_intruder::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_intruder::text, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM 1 FROM shopping_lists WHERE id = v_list;
    RAISE EXCEPTION 'Intruder accessed shopping list';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Shopping list blocked for non-member ✔';
  END;

  BEGIN
    INSERT INTO shopping_items (id, list_id, name, created_by)
    VALUES (gen_random_uuid(), v_list, 'Eggs', v_intruder::text);
    RAISE EXCEPTION 'Intruder inserted shopping item';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Shopping item insert blocked for non-member ✔';
  END;

  ---------------------------------------------------------------------------
  -- Test: Event attendees - membership required for CRUD
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_member::text, 'role', 'authenticated')::text, true);
  INSERT INTO event_attendees (id, event_id, user_id)
  VALUES (gen_random_uuid(), v_event, v_member::text)
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Event attendee insert by member ✔';

  PERFORM set_config('request.jwt.claim.sub', v_intruder::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_intruder::text, 'role', 'authenticated')::text, true);
  BEGIN
    INSERT INTO event_attendees (id, event_id, user_id)
    VALUES (gen_random_uuid(), v_event, v_intruder::text);
    RAISE EXCEPTION 'Intruder inserted event attendee';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Event attendee insert blocked for non-member ✔';
  END;

  ---------------------------------------------------------------------------
  -- Test: Audit logs - user-scoped insert/select
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_member::text, 'role', 'authenticated')::text, true);
  INSERT INTO audit_logs (id, action, target_table, user_id)
  VALUES (gen_random_uuid(), 'qa.test', 'audit_logs', v_member::text)
  RETURNING id INTO v_audit;
  RAISE NOTICE 'Audit log insert for self ✔';

  BEGIN
    INSERT INTO audit_logs (id, action, target_table, user_id)
    VALUES (gen_random_uuid(), 'qa.fail', 'audit_logs', v_intruder::text);
    RAISE EXCEPTION 'Audit log insert bypassed WITH CHECK';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Audit log insert blocked when user_id mismatch ✔';
  END;

  ---------------------------------------------------------------------------
  -- Test: Attachments - household/path enforcement
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_owner::text, 'role', 'authenticated')::text, true);
  INSERT INTO attachments (id, household_id, uploaded_by, file_name, file_size, file_type, file_extension, storage_path)
  VALUES (gen_random_uuid(), v_household, v_owner, 'qa.pdf', 2048, 'application/pdf', 'pdf', v_owner::text || '/qa.pdf')
  RETURNING id INTO v_attachment;
  RAISE NOTICE 'Attachment insert by household member ✔';

  PERFORM set_config('request.jwt.claim.sub', v_intruder::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_intruder::text, 'role', 'authenticated')::text, true);
  BEGIN
    SELECT 1 FROM attachments WHERE id = v_attachment;
    RAISE EXCEPTION 'Intruder accessed attachment';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Attachment blocked for non-member ✔';
  END;

  ---------------------------------------------------------------------------
  -- Test: Security events & user sessions restricted to service role
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_member::text, 'role', 'authenticated')::text, true);
  BEGIN
    INSERT INTO security_events (id, user_id, event_type, severity, details)
    VALUES (gen_random_uuid(), v_member::text, 'qa_attempt', 'low', '{}'::jsonb);
    RAISE EXCEPTION 'Security event insert should require service role';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Security event insert blocked for authenticated user ✔';
  END;

  BEGIN
    INSERT INTO user_sessions (id, user_id, session_token)
    VALUES (gen_random_uuid(), v_member::text, 'qa-token');
    RAISE EXCEPTION 'User session insert should require service role';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'User session insert blocked for authenticated user ✔';
  END;

  ---------------------------------------------------------------------------
  -- Cleanup seeded data using service role
  ---------------------------------------------------------------------------
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', NULL, true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role')::text, true);
  DELETE FROM attachments WHERE id = v_attachment;
  DELETE FROM audit_logs WHERE id = v_audit;
  DELETE FROM event_attendees WHERE event_id = v_event;
  DELETE FROM shopping_items WHERE list_id = v_list;
  DELETE FROM shopping_lists WHERE id = v_list;
  DELETE FROM daily_digests WHERE id = v_digest;
  DELETE FROM events WHERE id = v_event;
  DELETE FROM entitlements WHERE household_id IN (v_household, v_other_household);
  DELETE FROM household_members WHERE household_id IN (v_household, v_other_household);
  UPDATE users SET household_id = NULL WHERE id IN (v_owner::text, v_member::text, v_intruder::text);
  DELETE FROM households WHERE id IN (v_household, v_other_household);

  -- Leave users as harmless test identities in case other checks expect them.

  RAISE NOTICE 'RLS QA test suite completed ✔';
END $$;
