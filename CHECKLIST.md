<!-- CHECKLIST.md -->
# RLS Fix Migration Checklist

1. **Apply migration**
   - Run `supabase db push` or execute `supabase/migrations/202509270930_fix_rls_policies.sql` in the Supabase SQL editor.
   - Run `supabase/migrations/202510011000_medium_risk_fixes.sql` for the medium-risk updates.

2. **Verify database state**
   - Execute `sql/verify_rls_after_migration.sql` to rerun policy audits and review risk flags.

3. **Manual spot checks (optional)**
   - Use commented DO blocks in `sql/verify_rls_after_migration.sql` as templates to test access paths for specific roles or tables.

4. **Regression suite (optional but recommended)**
   - Run `sql/test_rls_fix_suite.sql` to exercise critical pass/fail cases and confirm cleanup.
