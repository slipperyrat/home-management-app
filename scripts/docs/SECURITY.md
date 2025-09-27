# Security & Compliance Overview

## Data Retention
- Daily and weekly digests cached for 30 days (see `digest_history` policy).
- Attachments/OCR artifacts follow household lifecycle; purge when households are deleted.
- Audit logs retained 90 days unless legal hold requested.

## User Requests
1. **Export data**: Run `scripts/exportUserData.ts <userId>` to generate a Supabase dump (attachments + metadata).
2. **Delete user**:
   - Deactivate user in Clerk dashboard.
   - Execute `scripts/deleteUser.ts <userId>` which removes household memberships, attachments, and RLS-protected rows.
   - Confirm via `sql/verify_user_cleanup.sql`.

## Secrets Rotation
- Clerk and Supabase keys stored in GitHub/Vercel secrets; rotate quarterly or on incident.
- After rotation, redeploy to invalidate caches and update local `.env` templates.

## Incident Response
- Alerts flow through Sentry (errors/warnings) and CI logs.
- Use `docs/INCIDENT_CHECKLIST.md` for post-mortem steps (root cause, timeline, remedial actions).
