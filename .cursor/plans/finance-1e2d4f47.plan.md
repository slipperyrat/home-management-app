<!-- 1e2d4f47-4e2f-4a1a-9db4-1e1a24c83c9b plan: finance module rebuild -->

# Finance Module Rebuild Plan

1. **Domain Types + Adapters**  

- Introduce `src/app/finance/_lib/types.ts` for shared DTOs (bills, envelopes, spend entries, feature flags).  
- Create `src/app/finance/_lib/api.ts` wrapping existing `/api/finance/*` endpoints with server-safe helpers and graceful error handling.

2. **Page Shell & Data Loading**  

- Rebuild `src/app/finance/page.tsx` as an async server component.  
- Gate access via `getCurrentHousehold`/`canAccessFeature`, parallel-fetch finance data, and stream sidebar + body with `<Suspense>` + skeleton fallbacks.

3. **Server Components**  

- Add structured sections (`FinanceOverview`, `BillsSection`, `BudgetsSection`, `SpendingSection`) under `src/app/finance/_components`, consuming adapter data and matching dark-first aesthetic.  
- Ensure grouped summaries (due buckets, totals) and empty states per feature flag.

4. **Client Islands & Interactions**  

- Implement focused client components for quick-add bill/spend, mark-paid toggle, filters, and inline edits using optimistic updates + React Query cache helpers.  
- Share form primitives with existing shadcn UI tokens, keyboard access (Enter/Space), and toasts.

5. **Cleanup & Navigation**  

- Retire legacy `/bills` client page and outdated forms once new flows land.  
- Update nav links/routes to point into the rebuilt finance dashboard, confirm lint/tests clean.