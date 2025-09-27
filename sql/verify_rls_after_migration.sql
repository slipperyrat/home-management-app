-- sql/verify_rls_after_migration.sql

--
-- Verification script to rerun RLS audits and perform spot checks after
-- applying migration 202509270930_fix_rls_policies.sql.
--
-- Sections:
--   1. Policy summary (A)
--   2. Policy risk flags (B) with improved cast detection
--   3. Tables missing RLS (C)
--   4. Owner column inventory (D)
--   5. Sample access checks (commented)
--

-------------------------------------------------------------------------------
-- (A) Policy summary equivalent to A_POLICY_SUMMARY.csv
-------------------------------------------------------------------------------
WITH policy_data AS (
  SELECT
    p.schemaname AS schema,
    p.tablename AS table_name,
    p.policyname,
    p.permissive,
    array_agg(DISTINCT r.rolname ORDER BY r.rolname) AS policy_roles,
    p.cmd,
    p.qual,
    p.with_check
  FROM pg_policies p
  LEFT JOIN pg_roles r ON r.rolname = ANY(p.roles)
  WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema')
  GROUP BY p.schemaname, p.tablename, p.policyname, p.permissive, p.cmd, p.qual, p.with_check
)
SELECT
  schema,
  table_name,
  policyname,
  permissive,
  policy_roles,
  cmd,
  qual AS using_clause,
  with_check
FROM policy_data
ORDER BY schema, table_name, policyname;

-------------------------------------------------------------------------------
-- (B) Policy risk flags: identify mismatched casts, permissive policies, etc.
-------------------------------------------------------------------------------
WITH owner_cols AS (
  SELECT
    n.nspname AS schema,
    c.relname AS table_name,
    a.attname AS column_name,
    pg_catalog.pg_get_userbyid(c.relowner) AS table_owner,
    format_type(a.atttypid, a.atttypmod) AS column_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE a.attnum > 0
    AND NOT a.attisdropped
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND a.attname IN ('user_id', 'created_by', 'updated_by', 'owner_id', 'completed_by', 'uploaded_by')
),
policy_data AS (
  SELECT
    p.schemaname AS schema,
    p.tablename AS table_name,
    p.policyname,
    p.cmd,
    p.qual,
    p.with_check,
    p.permissive,
    array_agg(DISTINCT r.rolname ORDER BY r.rolname) AS policy_roles,
    string_agg(format('%s:%s', oc.column_name, oc.column_type), ', ') AS owner_columns
  FROM pg_policies p
  LEFT JOIN pg_roles r ON r.rolname = ANY(p.roles)
  LEFT JOIN owner_cols oc
    ON oc.schema = p.schemaname
   AND oc.table_name = p.tablename
  WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema')
  GROUP BY p.schemaname, p.tablename, p.policyname, p.cmd, p.qual, p.with_check, p.permissive
),
analysis AS (
  SELECT
    schema,
    table_name,
    policyname,
    policy_roles,
    cmd,
    owner_columns,
    qual,
    with_check,
    permissive,
    regexp_replace(qual, '\s+', ' ', 'g') AS qual_compact,
    regexp_replace(COALESCE(with_check, ''), '\s+', ' ', 'g') AS check_compact
  FROM policy_data
)
SELECT
  schema,
  table_name,
  policyname,
  policy_roles,
  cmd,
  owner_columns,
  permissive,
  qual,
  with_check,
  (qual_compact ~ '\btrue\b') AS using_true,
  (check_compact ~ '\btrue\b') AS check_true,
  (qual_compact ~ 'auth\.uid\(\)::uuid') AS contains_uuid_cast,
  (qual_compact ~ 'auth\.uid\(\)::text') AS contains_text_cast,
  (owner_columns IS NOT NULL AND owner_columns ~ 'uuid' AND qual_compact ~ 'auth\.uid\(\)::text') AS mismatched_cast_uuid,
  (owner_columns IS NOT NULL AND owner_columns ~ 'text' AND qual_compact ~ 'auth\.uid\(\)::uuid') AS mismatched_cast_text
FROM analysis
ORDER BY schema, table_name, policyname;

-------------------------------------------------------------------------------
-- (C) Tables with user-identifying columns but RLS disabled
-------------------------------------------------------------------------------
WITH owner_tables AS (
  SELECT DISTINCT
    n.nspname AS schema,
    c.relname AS table_name,
    string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ', ') AS owner_columns
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE a.attnum > 0
    AND NOT a.attisdropped
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND a.attname IN ('user_id', 'created_by', 'updated_by', 'owner_id', 'completed_by', 'uploaded_by')
  GROUP BY n.nspname, c.relname
)
SELECT
  ot.schema,
  ot.table_name,
  ot.owner_columns,
  c.relrowsecurity AS rls_enabled,
  (
    SELECT COUNT(*)
    FROM pg_policies p
    WHERE p.schemaname = ot.schema
      AND p.tablename = ot.table_name
  ) AS policy_count
FROM owner_tables ot
JOIN pg_class c ON c.relname = ot.table_name
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = ot.schema
ORDER BY ot.schema, ot.table_name;

-------------------------------------------------------------------------------
-- (D) Owner column inventory akin to D_OWNER_COLUMN_TYPES.csv
-------------------------------------------------------------------------------
SELECT
  n.nspname AS schema,
  c.relname AS table_name,
  a.attname AS column_name,
  format_type(a.atttypid, a.atttypmod) AS column_type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE a.attnum > 0
  AND NOT a.attisdropped
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND a.attname IN (
    'user_id','created_by','updated_by','owner_id','completed_by','uploaded_by','assigned_to'
  )
ORDER BY schema, table_name, column_name;

-------------------------------------------------------------------------------
-- (E) Sample access tests (commented; run manually per section)
-------------------------------------------------------------------------------
-- Replace placeholders with real UUIDs before executing.

-- 1. Daily digests: household member can select; service-role required for writes
-- DO $$
-- DECLARE
--   v_member uuid := '00000000-0000-0000-0000-000000000000'; -- auth.uid() of household member (text / uuid cast depending on schema)
--   v_other  uuid := '11111111-1111-1111-1111-111111111111'; -- different user
--   v_digest uuid;
-- BEGIN
--   -- Create a digest as service role
--   PERFORM set_config('role', 'service_role', true);
--   INSERT INTO public.daily_digests (household_id, digest_date, status)
--   VALUES ('22222222-2222-2222-2222-222222222222', current_date, 'pending')
--   RETURNING id INTO v_digest;
--
--   -- Member can select household digest
--   PERFORM set_config('role', 'authenticated', true);
--   PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
--   PERFORM 1 FROM public.daily_digests WHERE id = v_digest;
--
--   -- Non-member denied
--   PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
--   BEGIN
--     PERFORM 1 FROM public.daily_digests WHERE id = v_digest;
--     RAISE EXCEPTION 'Non-member should be blocked but was not';
--   EXCEPTION WHEN others THEN
--     RAISE NOTICE 'Non-member correctly denied for digest';
--   END;
-- END $$;

-- 2. Entitlements: service role insert; member update limited to household
-- DO $$
-- DECLARE
--   v_household uuid := '33333333-3333-3333-3333-333333333333';
--   v_member uuid := 'aaaaaaa0-0000-0000-0000-000000000000';
-- BEGIN
--   PERFORM set_config('role', 'service_role', true);
--   INSERT INTO public.entitlements (household_id, tier) VALUES (v_household, 'free')
--   ON CONFLICT (household_id) DO NOTHING;
--
--   PERFORM set_config('role', 'authenticated', true);
--   PERFORM set_config('request.jwt.claim.sub', v_member::text, true);
--   UPDATE public.entitlements SET tier = 'pro'
--   WHERE household_id = v_household;
-- END $$;

-- 3. Shopping lists/items: member access vs non-member denial
-- DO $$
-- DECLARE
--   v_household uuid := '44444444-4444-4444-4444-444444444444';
--   v_member text := 'memberUserId';
--   v_other text := 'otherUserId';
--   v_list uuid;
-- BEGIN
--   -- Assume household_members table already has rows for member/household
--   PERFORM set_config('role', 'authenticated', true);
--   PERFORM set_config('request.jwt.claim.sub', v_member, true);
--   INSERT INTO public.shopping_lists (id, household_id, title, created_by)
--   VALUES (gen_random_uuid(), v_household, 'Test List', v_member)
--   RETURNING id INTO v_list;
--
--   INSERT INTO public.shopping_items (id, list_id, name, created_by)
--   VALUES (gen_random_uuid(), v_list, 'Milk', v_member);
--
--   -- Non-member blocked
--   PERFORM set_config('request.jwt.claim.sub', v_other, true);
--   BEGIN
--     SELECT 1 FROM public.shopping_lists WHERE id = v_list;
--     RAISE EXCEPTION 'Non-member should not access list';
--   EXCEPTION WHEN others THEN
--     RAISE NOTICE 'Non-member correctly denied for shopping list';
--   END;
-- END $$;

-- 4. Event attendees/reminders: only household members may manage records
-- DO $$
-- DECLARE
--   v_event uuid := '55555555-5555-5555-5555-555555555555';
--   v_member text := 'memberUserId';
-- BEGIN
--   PERFORM set_config('role', 'authenticated', true);
--   PERFORM set_config('request.jwt.claim.sub', v_member, true);
--   INSERT INTO public.event_attendees (id, event_id, user_id)
--   VALUES (gen_random_uuid(), v_event, v_member)
--   ON CONFLICT DO NOTHING;
-- END $$;

-- 5. Audit logs: user can insert/select own row only
-- DO $$
-- DECLARE
--   v_user text := 'memberUserId';
-- BEGIN
--   PERFORM set_config('role', 'authenticated', true);
--   PERFORM set_config('request.jwt.claim.sub', v_user, true);
--   INSERT INTO public.audit_logs (id, action, target_table, user_id)
--   VALUES (gen_random_uuid(), 'test.action', 'audit_logs', v_user);
--   PERFORM 1 FROM public.audit_logs WHERE user_id = v_user;
-- END $$;

-- 6. Attachments/storage: path restricted to user folder
-- DO $$
-- DECLARE
--   v_user text := 'memberUserId';
--   v_attachment uuid;
-- BEGIN
--   PERFORM set_config('role', 'authenticated', true);
--   PERFORM set_config('request.jwt.claim.sub', v_user, true);
--   INSERT INTO public.attachments (id, household_id, uploaded_by, file_name, file_size, file_type, file_extension, storage_path)
--   VALUES (gen_random_uuid(), '66666666-6666-6666-6666-666666666666', v_user::uuid, 'doc.pdf', 1024, 'application/pdf', 'pdf', v_user || '/doc.pdf')
--   RETURNING id INTO v_attachment;
-- END $$;
