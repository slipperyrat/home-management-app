-- supabase/migrations/202510011000_medium_risk_fixes.sql
-- Medium-risk RLS clean-up: cast alignment, enable RLS on owner tables, tighten policies.
-- Applies only when relevant tables exist (cache tables guarded by to_regclass checks).

BEGIN;

-------------------------------------------------------------------------------
-- Attachments & related OCR tables: align auth.uid() casts with TEXT columns
-------------------------------------------------------------------------------
DROP POLICY IF EXISTS attachments_select_household ON public.attachments;
DROP POLICY IF EXISTS attachments_insert_household ON public.attachments;
DROP POLICY IF EXISTS attachments_update_household ON public.attachments;
DROP POLICY IF EXISTS attachments_delete_household ON public.attachments;
DROP POLICY IF EXISTS "Users can view attachments in their household" ON public.attachments;
DROP POLICY IF EXISTS "Users can insert attachments to their household" ON public.attachments;
DROP POLICY IF EXISTS "Users can update attachments in their household" ON public.attachments;
DROP POLICY IF EXISTS "Users can delete attachments in their household" ON public.attachments;

CREATE POLICY attachments_select_household ON public.attachments
  FOR SELECT TO authenticated
  USING (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

CREATE POLICY attachments_insert_household ON public.attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
    AND uploaded_by = auth.uid()::text
  );

CREATE POLICY attachments_update_household ON public.attachments
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

CREATE POLICY attachments_delete_household ON public.attachments
  FOR DELETE TO authenticated
  USING (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS ocr_queue_select_household ON public.ocr_processing_queue;
DROP POLICY IF EXISTS "Users can view OCR queue in their household" ON public.ocr_processing_queue;
CREATE POLICY ocr_queue_select_household ON public.ocr_processing_queue
  FOR SELECT TO authenticated
  USING (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS receipt_items_select_household ON public.receipt_items;
DROP POLICY IF EXISTS receipt_items_update_household ON public.receipt_items;
DROP POLICY IF EXISTS "Users can view receipt items in their household" ON public.receipt_items;
DROP POLICY IF EXISTS "Users can update receipt items in their household" ON public.receipt_items;
CREATE POLICY receipt_items_select_household ON public.receipt_items
  FOR SELECT TO authenticated
  USING (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

CREATE POLICY receipt_items_update_household ON public.receipt_items
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

DROP POLICY IF EXISTS price_history_select_household ON public.price_history;
DROP POLICY IF EXISTS price_history_insert_household ON public.price_history;
DROP POLICY IF EXISTS "Users can view price history in their household" ON public.price_history;
DROP POLICY IF EXISTS "Users can insert price history in their household" ON public.price_history;
CREATE POLICY price_history_select_household ON public.price_history
  FOR SELECT TO authenticated
  USING (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

CREATE POLICY price_history_insert_household ON public.price_history
  FOR INSERT TO authenticated
  WITH CHECK (
    household_id IN (
      SELECT household_id
      FROM public.users u
      WHERE u.id = auth.uid()::text
    )
  );

-------------------------------------------------------------------------------
-- Cache tables: ensure auth.uid() cast to text for pattern comparisons
-------------------------------------------------------------------------------
DO $$
DECLARE
  v_sql text;
BEGIN
  IF to_regclass('public.cache_entries') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS cache_entries_select_scoped ON public.cache_entries';
    EXECUTE 'DROP POLICY IF EXISTS cache_entries_insert_scoped ON public.cache_entries';
    EXECUTE 'DROP POLICY IF EXISTS cache_entries_update_scoped ON public.cache_entries';
    EXECUTE 'DROP POLICY IF EXISTS cache_entries_delete_scoped ON public.cache_entries';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own cache entries" ON public.cache_entries';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert their own cache entries" ON public.cache_entries';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own cache entries" ON public.cache_entries';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own cache entries" ON public.cache_entries';

    v_sql := format($f$
      CREATE POLICY cache_entries_select_scoped ON public.cache_entries
        FOR SELECT TO authenticated
        USING (
          cache_key LIKE 'user_' || auth.uid()::text || ':%'
          OR cache_key LIKE 'household_' || (
            SELECT household_id::text FROM public.household_members hm
            WHERE hm.user_id = auth.uid()::text
            LIMIT 1
          ) || ':%'
        )
    $f$);
    EXECUTE v_sql;

    v_sql := format($f$
      CREATE POLICY cache_entries_insert_scoped ON public.cache_entries
        FOR INSERT TO authenticated
        WITH CHECK (
          cache_key LIKE 'user_' || auth.uid()::text || ':%'
          OR cache_key LIKE 'household_' || (
            SELECT household_id::text FROM public.household_members hm
            WHERE hm.user_id = auth.uid()::text
            LIMIT 1
          ) || ':%'
        )
    $f$);
    EXECUTE v_sql;

    v_sql := format($f$
      CREATE POLICY cache_entries_update_scoped ON public.cache_entries
        FOR UPDATE TO authenticated
        USING (
          cache_key LIKE 'user_' || auth.uid()::text || ':%'
          OR cache_key LIKE 'household_' || (
            SELECT household_id::text FROM public.household_members hm
            WHERE hm.user_id = auth.uid()::text
            LIMIT 1
          ) || ':%'
        )
        WITH CHECK (
          cache_key LIKE 'user_' || auth.uid()::text || ':%'
          OR cache_key LIKE 'household_' || (
            SELECT household_id::text FROM public.household_members hm
            WHERE hm.user_id = auth.uid()::text
            LIMIT 1
          ) || ':%'
        )
    $f$);
    EXECUTE v_sql;

    v_sql := format($f$
      CREATE POLICY cache_entries_delete_scoped ON public.cache_entries
        FOR DELETE TO authenticated
        USING (
          cache_key LIKE 'user_' || auth.uid()::text || ':%'
          OR cache_key LIKE 'household_' || (
            SELECT household_id::text FROM public.household_members hm
            WHERE hm.user_id = auth.uid()::text
            LIMIT 1
          ) || ':%'
        )
    $f$);
    EXECUTE v_sql;
  END IF;

  IF to_regclass('public.cache_statistics') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS cache_statistics_select_scoped ON public.cache_statistics';
    EXECUTE 'DROP POLICY IF EXISTS cache_statistics_insert_scoped ON public.cache_statistics';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own cache statistics" ON public.cache_statistics';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert their own cache statistics" ON public.cache_statistics';

    v_sql := format($f$
      CREATE POLICY cache_statistics_select_scoped ON public.cache_statistics
        FOR SELECT TO authenticated
        USING (
          cache_key LIKE 'user_' || auth.uid()::text || ':%'
          OR cache_key LIKE 'household_' || (
            SELECT household_id::text FROM public.household_members hm
            WHERE hm.user_id = auth.uid()::text
            LIMIT 1
          ) || ':%'
        )
    $f$);
    EXECUTE v_sql;

    v_sql := format($f$
      CREATE POLICY cache_statistics_insert_scoped ON public.cache_statistics
        FOR INSERT TO authenticated
        WITH CHECK (
          cache_key LIKE 'user_' || auth.uid()::text || ':%'
          OR cache_key LIKE 'household_' || (
            SELECT household_id::text FROM public.household_members hm
            WHERE hm.user_id = auth.uid()::text
            LIMIT 1
          ) || ':%'
        )
    $f$);
    EXECUTE v_sql;
  END IF;

  IF to_regclass('public.cache_invalidation_log') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS cache_invalidation_log_select_scoped ON public.cache_invalidation_log';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view their own cache invalidation logs" ON public.cache_invalidation_log';

    v_sql := format($f$
      CREATE POLICY cache_invalidation_log_select_scoped ON public.cache_invalidation_log
        FOR SELECT TO authenticated
        USING (
          target LIKE 'user_' || auth.uid()::text || ':%'
          OR target LIKE 'household_' || (
            SELECT household_id::text FROM public.household_members hm
            WHERE hm.user_id = auth.uid()::text
            LIMIT 1
          ) || ':%'
        )
    $f$);
    EXECUTE v_sql;
  END IF;
END $$;

-------------------------------------------------------------------------------
-- Planner / Meal / Recipe tables: enable RLS and add household policies
-------------------------------------------------------------------------------
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.planner_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recipes_select_household ON public.recipes;
DROP POLICY IF EXISTS recipes_modify_household ON public.recipes;

CREATE POLICY recipes_select_household ON public.recipes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = public.recipes.household_id
        AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY recipes_modify_household ON public.recipes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = public.recipes.household_id
        AND hm.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = public.recipes.household_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS meal_plans_select_household ON public.meal_plans;
DROP POLICY IF EXISTS meal_plans_modify_household ON public.meal_plans;

CREATE POLICY meal_plans_select_household ON public.meal_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = public.meal_plans.household_id
        AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY meal_plans_modify_household ON public.meal_plans
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = public.meal_plans.household_id
        AND hm.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = public.meal_plans.household_id
        AND hm.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS planner_items_select_household ON public.planner_items;
DROP POLICY IF EXISTS planner_items_modify_household ON public.planner_items;

CREATE POLICY planner_items_select_household ON public.planner_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = public.planner_items.household_id
        AND hm.user_id = auth.uid()::text
    )
  );

CREATE POLICY planner_items_modify_household ON public.planner_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = public.planner_items.household_id
        AND hm.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.household_members hm
      WHERE hm.household_id = public.planner_items.household_id
        AND hm.user_id = auth.uid()::text
    )
  );

-------------------------------------------------------------------------------
-- Users table: enable RLS and add owner policy (medium risk to lock down)
-------------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;

CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (auth.role() = 'service_role' OR id = auth.uid()::text);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (auth.role() = 'service_role' OR id = auth.uid()::text)
  WITH CHECK (auth.role() = 'service_role' OR id = auth.uid()::text);

COMMIT;
