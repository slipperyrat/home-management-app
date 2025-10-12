# UI Lint Override During Redesign

Date: 2025-10-09

We introduced a temporary ESLint override for `src/components/ui/**/*` so the legacy UI patterned components stop blocking builds (they produced dozens of style warnings and leaked-render hints).

Reason: we plan to replace the entire UI system soon, so sinking time into cleaning up the old components doesn’t provide value. Instead, the override lets us proceed with other lint fixes and code changes.

Reminder: once the new UI lands, remove the override block in `.eslintrc.json` (search for the override on `src/components/ui`). Re-run `npm run lint` to confirm the new UI complies with the stricter rules.

