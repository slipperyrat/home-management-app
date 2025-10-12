<!-- chores-plan -->
# Chores Dashboard Plan

1. **Adapter Layer** — Add `src/app/chores/_lib/api.ts` wrapping existing REST endpoints (`/api/chores`, `/api/chores/completions`, etc.) into repo-friendly helpers. Create shared types (`ChoreDTO`, filter options) and todo blockers for missing endpoints.
2. **Utilities** — Implement date-bucket helpers in `src/app/chores/_lib/grouping.ts` to classify chores into Overdue/Today/Tomorrow/This Week/Later/No due date.
3. **Page Shell** — Rebuild `src/app/chores/page.tsx` as a server component streaming sidebar + chore list via Suspense. Parse `searchParams.view` for filters, fetch chores/members/tags with Promise.all.
4. **Filters Sidebar** — Add `FiltersSidebar` (server parent + small client island) showing standard filters/tags, syncing selection to URL.
5. **Main List** — Create `ChoreList` (server) to render grouped buckets, row structure with badges, dotted focus states, skeleton fallback, and empties per filter.
6. **Client Islands** — Implement `QuickAdd` for new chores and `RowActions` (assign, due, repeat, edit, delete, complete rewards). Use toasts + router.refresh.
7. **Polish & QA** — Keyboard shortcuts (j/k, space, a), XP toast integration from adapter, run lint/tests and manual sanity (filter switches, quick add, inline actions).
