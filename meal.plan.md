<!-- 0f1e9cc5-c495-4e7d-a5fc-a87d13f687ba 8e81d6b3-668a-4019-8add-f8a2996466c8 -->
# Shopping Lists Implementation Plan

- [x] **Audit & Cleanup** — Remove obsolete client pages (`src/app/shopping-lists/page.tsx`, `src/app/shopping-lists/[id]/page.tsx`, old `components/` + `types.ts`, unused hooks) to avoid conflicts with the new server-first architecture.
- [x] **Server Adapter Layer** — Introduce `src/app/shopping-lists/_lib` (types + `api.ts`) that maps to existing REST endpoints (`/api/shopping-lists`, `/api/shopping-lists/[id]`, `/api/shopping-lists/[id]/items`, `/api/shopping-items/toggle`, `/api/meal-planner/add-week-ingredients`, etc.), documenting any gaps (e.g., missing mark-all-complete endpoint).
- [x] **Routing Shells** — Rebuild `/shopping-lists/page.tsx` (redirect or empty state) and `/shopping-lists/[id]/page.tsx` as server components that fetch sidebar + active list in parallel and stream via `<Suspense>`.
- [x] **UI Components** — Implement new `_components` set:
  - `ListsSidebar.tsx` (server + small client actions for create/rename/delete).
  - `ListView.tsx` (server) to render grouped items, header actions, and notes.
  - Client dialogs (`AddItemDialog`, `RenameListDialog`, `DeleteListDialog`) and `NotesArea` with debounced autosave.
  - Lightweight client handlers for item toggle/edit (using `useTransition` + revalidation).
- [x] **Progressive Enhancements** — Wire header actions (`Mark all complete`, `Generate from meals`, `Add item`) to adapter functions, ensure toasts, focus management, and handle TODOs where backend gaps exist.
- [x] **Polish & Validation** — Add skeleton states, accessibility tweaks, and run lint/format to guarantee no TS/ESLint issues.

### To-dos

- [x] Create meals adapter wrapping existing API routes and document mismatches

# Chores Dashboard Plan

- [x] Create meals adapter wrapping existing API routes and document mismatches
- [x] Adapter Layer
- [x] Utilities
- [x] Page Shell
- [x] Filters Sidebar
- [x] Main List
- [x] Client Islands
- [x] QA & Polish (shortcuts, XP toasts, lint/tests)
- [x] Inline assign/due-date/repeat controls in row actions
- [x] Enhanced quick-add form (assignee + due date)
- [x] Surface XP reward badges and toasts toggle
