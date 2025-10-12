<!-- 0f1e9cc5-c495-4e7d-a5fc-a87d13f687ba 8e81d6b3-668a-4019-8add-f8a2996466c8 -->
# Chores Dashboard Plan

1. Adapter Layer  

- Add `src/app/chores/_lib/api.ts` wrapping existing REST endpoints (`/api/chores`, `/api/chores/completions`, etc.) into repo-friendly helpers. Create shared types (`ChoreDTO`, filter options) and note gaps if endpoints differ.

2. Utilities  

- Implement date bucket helpers in `src/app/chores/_lib/grouping.ts` to classify chores into Overdue, Today, Tomorrow, This Week, Later, and No due date.

3. Page Shell  

- Rebuild `src/app/chores/page.tsx` as a server component streaming sidebar and list via Suspense. Parse `searchParams.view`; fetch chores/members/tags with Promise.all.

4. Filters Sidebar  

- Create `FiltersSidebar` (server wrapper + small client island) showing filters/tags and syncing selection to URL query.

5. Main List  

- Implement `ChoreList` (server) grouped rendering, row layout with badges/tooltips, skeleton fallback, and filter-specific empty states.

6. Client Islands  

- Build `QuickAdd` (client) for creating chores and `RowActions` (client) for assign/due/repeat/edit/delete/complete with rewards + toasts.

7. QA & Polish  

- Wire keyboard shortcuts (j/k navigation, space toggle, “a” quick add), ensure XP toasts appear when enabled, and run lint/tests plus manual sanity (filters, quick add, inline edits).

### To-dos

- [ ] Create meals adapter wrapping existing API routes and document mismatches