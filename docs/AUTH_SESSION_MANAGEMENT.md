# Authentication & Session Management Notes

This document captures the decisions and operational steps for Track 1 of the systematic review.

## Clerk Session Lifecycle
- Clerk manages primary session cookies (`__session`) and refresh tokens. Our app relies on Clerk's default 4-week refresh token and rolling session extension.
- The middleware (`src/middleware.ts`) protects key routes; server APIs revalidate via `withAPISecurity`.
- When users sign out, Clerk invalidates their session server-side; the middleware automatically redirects unauthenticated requests.

## Rate Limiting
- `withAPISecurity` now invokes `RateLimiter.checkRateLimit`. Database failures fail open but are logged via `logger.warn`.
- Rate limit configurations live in `src/lib/security/rateLimiter.ts` and can be tuned per endpoint group.

## Onboarding Enforcement
- Middleware checks both `users.has_onboarded` and `users.household_id`. Users missing either field are redirected to `/onboarding` until completion.
- Migration `202510020900_onboarding_guard.sql` ensures `has_onboarded` is present.

## Secret Rotation Expectations
- Clerk: update `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in GitHub/Vercel secrets. Rotation requires redeploy to invalidate cached values.
- Supabase service role key lives in secret stores; rotate via Supabase dashboard and update GitHub/Vercel secrets accordingly.
- CSRF, VAPID, OpenAI, and other secrets documented in `env-example.txt`. Rotate through GitHub/Vercel secrets and redeploy.

## Operational Checklist
1. Monitor Clerk dashboard for revoked accounts and suspicious activity.
2. Review Supabase audit logs periodically to ensure onboarding updates succeed.
3. Re-run `sql/test_rls_fix_suite.sql` after onboarding or auth policy changes.
4. Update this document when rotation procedures change or new auth systems are added.

## Session Health Monitoring
- Run `npm run audit:sessions` weekly (or after any auth incident). The script queries `user_sessions` for:
  - `expired`: sessions past `expires_at`
  - `stale`: sessions idle >12h yet still valid
  - `concurrent`: accounts holding >3 simultaneous sessions
- Output lists affected users with truncated session tokens, last activity timestamps, and IPs.
- After inspection, consider revoking stale/expired sessions via Clerk dashboard or Supabase cleanup and notify impacted users if suspicious.
- Integrate results into runbooks (GSuite sheet or PagerDuty note) so anomalies can be tracked over time.
