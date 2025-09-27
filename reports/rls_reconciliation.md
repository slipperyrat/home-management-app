<!-- reports/rls_reconciliation.md -->

# RLS Reconciliation Summary

## High & Medium Fixes
- High-risk items resolved via `202509270930_fix_rls_policies.sql`
- Medium-risk items resolved via `202510011000_medium_risk_fixes.sql`

## Low-Risk Polish
| Area | Status | Notes |
| --- | --- | --- |
| Storage bucket (`attachments`) | ✅ Normalized | `202510011500_low_risk_cleanup.sql` ensures bucket insert idempotency & canonical policies |
| Legacy policies | ✅ Cleaned | Migration drops redundant storage policies and re-creates canonical set |
| Future monitoring | 🔍 | Keep an eye on new buckets/tables for consistent RLS patterns |

## Items Only in Migrations (Initial Review)
| Table / Scope | Issue Observed in Migrations | Source Notes |
| --- | --- | --- |
| `daily_digests` | Critical: `FOR ALL` policy with `WITH CHECK true` allows any role to write. | Initial Review → Daily digests bullet (policy `System can manage digests`) |
| `entitlements` | High: insert policy `WITH CHECK true` (no role restriction). | Initial Review → Entitlements bullet (policy `System can insert entitlements`) |
| `event_attendees`, `event_reminders` | High: write policies missing `WITH CHECK`, enabling privilege escalation. | Initial Review → Calendar core bullet (`attendees_modify_creator_or_owner`, `reminders_modify_creator_or_owner`) |
| Smart chore tables (`chore_assignments`, `chore_preferences`, `chore_completion_patterns`, `chore_ai_insights`, `chore_rotation_schedules`) | Critical: each has `FOR ALL USING (true)`, so RLS is ineffective. | Initial Review → Smart chores add-ons bullet (policies `Allow all operations ...`) |
| `households` | High: plan/stripe policies exist but RLS disabled so they never apply. | Initial Review → Risk Flags (Household access); migrations `add_stripe_columns.sql`, `update_plan_constraints.sql` |
| Owner-style tables (`planner_items`, `meal_plans`, `recipes`, `users`) | High: RLS not enabled, so existing policies never apply. | Initial Review → Risk Flags (Owner tables) |
| `attachments`, `ocr_processing_queue`, `receipt_items`, `price_history`, cache tables | High: comparisons omit explicit `::text` casts, risking type mismatch. | Initial Review → Type mismatches bullet |

## Items Only in Live DB Audit
| Table / Scope | Issue Found Live | CSV Reference |
| --- | --- | --- |
| `audit_logs` | RLS disabled despite user ownership columns. | C.csv → `audit_logs` |
| `household_events` | RLS disabled; no policies. | C.csv → `household_events` |
| `security_events` | RLS disabled even though user-owned. | C.csv → `security_events` |
| `shopping_lists` | RLS disabled; multiple household policies exist but inert. | C.csv → `shopping_lists`; A.csv rows for `Users can view/create/update/delete shopping lists` |
| `shopping_items` | RLS disabled; owner columns `created_by`, `completed_by`. | C.csv → `shopping_items`; A.csv rows for `Users can view/insert/update/delete shopping items` |
| `user_sessions` | RLS disabled, exposing per-user session data. | C.csv → `user_sessions`; A.csv row `Users can view their sessions` |
| `daily_digests` | Service-role-only `FOR ALL` policy already present (no open access). | A.csv row `Service role manages digests` |
| `entitlements` | Insert restricted to `auth.role() = 'service_role'`. | A.csv row `Service role inserts entitlements` |

## Items Present in Both
| Table / Scope | Shared Finding | Sources |
| --- | --- | --- |
| `household_members` | RLS disabled, so membership lookups can’t enforce policies. | Initial Review → Risk Flags (Household access); C.csv row |
| `daily_digests` (SELECT policy) | Household-membership SELECT policy exists in both. | Initial Review & A.csv row “Users can view digests for their household” |
| `analytics_events` | User-scoped SELECT/INSERT policy with `auth.uid()::text`. | Initial Review & A.csv rows for analytics events |
| `digest_preferences`, `notification_settings`, `push_subscriptions` | Owner-based `FOR ALL` policies guarding CRUD by `auth.uid()::text`. | Initial Review & A.csv rows |
| `shopping_lists` / `shopping_items` policies | Household-scoped CRUD policies exist, but RLS disabled live. | Initial Review & A.csv rows (policies) alongside C.csv flags |
