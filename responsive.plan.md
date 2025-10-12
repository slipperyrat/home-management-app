<!-- a1449d65-2d39-42d1-ac33-0a2f5d3ffbdd abdcd676-8ebf-430e-a074-f1b1d930b0c9 -->
# Calendar Module Implementation
1. Audit-existing-calendar-assets — Review current calendar APIs/components (ICS export, sync routes, templates, AI insights) to understand expectations, available helpers, and gaps relative to the prompt.
2. Events-lib — Create `_lib/events.ts` for Supabase queries, household/attendee filters, and recurrence expansion using `rrule`, `luxon`, and existing logging utilities.
3. Date-helpers — Add `_lib/date.ts` with month range utilities, timezone-safe day keys, keyboard navigation helpers, and shared constants (e.g., week start Monday).
4. Month-grid — Build server `MonthGrid` component with Suspense skeleton, keyboard navigation, today/selected states, and event density indicators.
5. Day-panel — Implement server `DayPanel` component showing selected day’s events, empty state, and fallback loading; integrate existing ICS download / sync links if present.
6. New-event-dialog — Implement client `NewEventDialog` with shadcn dialog, progressive disclosure for advanced fields, server action for insert, validation, and revalidation tags.
7. Page-wiring — Rebuild `/calendar/page.tsx` as nodejs runtime server component orchestrating data fetch, Suspense boundaries, layout, and state (selected day) via URL/search params.
8. Testing/lint — Add unit coverage for recurrence expansion helpers, ensure ESLint/TypeScript pass, and validate streaming SSR behaviour.


### To-dos

- [x] Review existing calendar-related API routes, ICS exports, sync utilities, and prior components to capture required integration points.
- [x] Implement Supabase query + recurrence expansion helpers in `_lib/events.ts`.
- [x] Add timezone-aware month/date utilities in `_lib/date.ts`.
- [x] Build server `MonthGrid` with keyboard nav, Suspense skeleton, event indicators.
- [x] Implement server `DayPanel` with event list, empty state, and integrations.
- [x] Create client `NewEventDialog` with server action, validation, and revalidation.
- [x] Compose `/calendar/page.tsx` runtime nodejs server component with Suspense and layout.
- [ ] Add targeted tests for recurrence expansion helpers and ensure lint/test suite passes.
