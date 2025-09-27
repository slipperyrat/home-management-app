<!-- rls_followups.md -->

# RLS Follow-ups

## ✅ Completed
- High-risk migration `202509270930_fix_rls_policies.sql`
- Medium-risk migration `202510011000_medium_risk_fixes.sql`
- Verification scripts (`sql/verify_rls_after_migration.sql`, `sql/test_rls_fix_suite.sql`)

## 🔍 Low-Risk Items to Clean Up
1. **Storage bucket audit**
   - Ensure any custom buckets besides `attachments` enforce `auth.uid()` folder ownership.
2. **Legacy tables without RLS**
   - Review older internal tables (e.g., automation/notifications) for completeness even if low exposure.
3. **Policy hygiene**
   - Remove obsolete policies in new migration to avoid confusion.
