# Finance Module Upgrade Backlog

This backlog captures next-step ideas for the finance dashboard once we’re ready to expand beyond the current rebuild. Each item includes a lightweight scope outline, dependencies, and a rough effort signal to help with future prioritisation.

## Recurring Bills & Schedules (est. 1–2 days)
- **Goal:** Allow households to define recurring patterns for bills (monthly rent, quarterly utilities) and auto-materialise upcoming instances.
- **Scope:**
  - Extend finance schema with recurrence metadata (frequency, interval, anchors, optional end date).
  - UI editor inside bill detail or quick-add flow for configuring the recurrence rule.
  - Background job/cron (Supabase cron or scheduled edge function) that generates pending bills ahead of due dates while preventing duplicates.
  - Update `/api/finance/bills` routes and DTOs to expose recurrence info.
  - Tests covering schedule expansion and edge cases (skipped payments, pausing recurrence).
- **Dependencies:** Access to Supabase migrations, existing notification infra if reminders tie in later.

## Reminder Preferences (est. ~1 day)
- **Goal:** Give members control over reminder timing and channels for billed items.
- **Scope:**
  - Add per-bill reminder settings (e.g., notify 3 days before due, same-day, post-overdue).
  - Surface toggle + date selector in bill drawer or inline action menu.
  - Extend notification service to read preferences and enqueue email/push events.
  - Update tests to cover notification scheduling logic.
- **Dependencies:** Builds on recurrence work if both are planned; reuses existing notifications pipeline.

## Receipt Attachments & Storage (est. 1–1.5 days)
- **Goal:** Let users attach receipt images/PDFs to bills or spending entries for audit trails.
- **Scope:**
  - Provision Supabase storage bucket with RLS rules tied to household membership.
  - Add upload UI (dropzone + preview) within bill/spend modals.
  - Extend APIs to handle upload URLs, metadata, and linking attachments to bills or entries.
  - Display attachments in detail views with secure signed URLs.
  - Add tests for upload handler and access restrictions.
- **Dependencies:** Storage configuration, edge function or server action for signed URL generation.

## Budget & Spending Analytics (est. 0.5–1.5 days)
- **Goal:** Provide visual insight into spending trends and budget performance.
- **Scope:**
  - Quick win: client-side charts (e.g., Recharts/VisX) using existing envelope + spending summaries.
  - Stretch: add period comparisons (this month vs last) via new server aggregations.
  - Offer toggles for time range selection and category breakdowns.
  - Add snapshot tests for chart configuration or utility functions.
- **Dependencies:** Optional charting library, additional API endpoints if deeper analytics are desired.

---

Revisit this backlog after monitoring live usage; it’s intentionally modular so we can pull in the highest-impact upgrade when bandwidth opens up. Contributions welcome—append new ideas here with scope/effort so the roadmap stays centralised.
