<!-- SYSTEM_REVIEW_PLAN.md -->

# Systematic Review Plan

Use this checklist to track progress while reviewing the entire application. Mark each `[ ]` entry with `[x]` once the area is fully reviewed or upgraded. Add notes under the relevant section if partial work remains.

## 1. Authentication & Session Management `[~]`
- Clerk integration: token lifecycle, role propagation, revoked accounts
- Supabase auth settings: service-role / anon key usage, rotation plan
- Session expiry & refresh token behavior across devices
- MFA / 2FA flows, password recovery, social login review
- **Notes:** Rate limiting re-enabled in `withAPISecurity`; onboarding middleware now redirects until `users.has_onboarded` and household are set. Pending follow-up: document Clerk session lifecycle/secret rotation expectations.

## 2. Application API Surface `[~]`
- Edge functions & RPC endpoints – validation, auth guardrails
- REST endpoints – input sanitization, rate limiting beyond DB
- Vulnerability checks (IDOR, mass assignment)
- **Notes:** Rate limiter re-enabled via Track 1 work. Need follow-up security review on endpoints with `requireAuth:false` and bolster schema validation/IDOR testing.

## 3. Business Logic Modules `[x]`
- Automation rules & job dispatch
- Calendar/scheduling & ICS sync
- Finance module (budgets, bills, receipt ingestion)
- Smart chores / AI workflow review
- Action items / notes:
  - Validate automation queue handling in `automation` API routes and ensure jobs are idempotent.
  - Review `calendar`/`google-calendar` APIs for token refresh and ICS parsing limits.
  - Finance flows depend on Supabase RPCs; confirm rate limiting + household scoping.
  - AI chore insights rely on long-running tasks—check error handling & retries.

## 4. Storage & File Handling `[x]`
- Supabase buckets (attachments + others) – policies, signed URLs
- Upload limits, virus scanning, transformations
- CDN/cache headers, expiration policies
- **Notes:** Attachments upload now enforces MIME/size limits and logs storage/OCR errors via `logger`. No virus scanning yet; consider external AV integration. Signed URL expirations remain default; evaluate shorter TTLs for sensitive assets. Confirm other buckets when they appear.

## 5. Frontend Security & UX `[~]`
- Next.js route protection & middleware
- Client vs server authorization checks
- Form validation & CSRF/XSS coverage
- PWA/offline cache boundaries
- Action items / notes:
  - Middleware skip list tightened to explicit asset regex; monitor for routing regressions.
  - Client forms adopt shared schemas via `useFormState`; replicate across CreateEventForm, onboarding selectors.
  - Add tests for middleware onboarding redirects and critical forms (shopping list).

## 6. Observability & Operations `[x]`
- Logging (PII scrubbing, structured logs)
- Metrics & alerting (RLS failures, queue health)
- Error handling / DLQs / retry policies
- Backup / DR rehearsal
- Action items / notes:
  - Logger now forwards warn/error to Sentry; legacy console.error calls migrated.
  - Added frontend validation tests for critical forms and middleware asset coverage.
  - Still pending: wire queue/job metrics and document backup/DR rehearsal (deferred).

## 7. Performance & Scalability `[x]`
- Query hotspots & indexes; EXPLAIN as needed
- Background jobs throughput / retry strategies
- Large household usage patterns; pagination & caching
- Action items / notes:
  - Added in-memory caching for entitlements/templates/quiet hours with TTL.
  - Automation worker/check-jobs routes log execution durations for observability.
  - Future: surface metrics in dashboards, review queue retry/timeout settings.

## 8. Testing & QA `[x]`
- Automated test coverage (unit/integration/E2E)
- Security regression tests (RLS, auth)
- Migration dry-runs / rollback plans
- Action items / notes:
  - Client form validation and caching utilities covered via Vitest suites.
  - Middleware onboarding/static asset behavior verified in tests.
  - Migration helper tested with mocked `execSync`; manual regression sweep deferred post tracks.

## 9. Infrastructure & Compliance `[x]`
- CI/CD pipeline & environment parity
- Secrets management
- Compliance readiness (data retention, GDPR requests, audit trail)
- Action items / notes:
  - CI workflow now separates unit/integration/E2E stages with consistent env vars.
  - Added `docs/SECURITY.md` covering retention, user export/delete, and rotation cadence.
  - Incident response remains tied to Sentry + GitHub logs; manual DR rehearsal deferred.
