<!-- recipes-plan -->
# Recipes Module Upgrade Plan

1. **Adapter Layer** — Replace legacy client hooks with `src/app/recipes/_lib` adapter + shared types for server components and client islands.
2. **Routing Shells** — Rebuild `/recipes` entry + dynamic routes as server components with Suspense, aligning styling/layout with dashboard/calendar.
3. **UI Components** — Implement modern recipe list/detail/import components (Tailwind + shadcn) using small client islands for search, import, and actions.
4. **Integrations** — Wire recipe actions into meals/shopping lists (attach recipe, add ingredients, generate from meals) with shared toasts + navigation.
5. **Cross-Workflows** — Audit dashboard/calendar/meals/recipes/shopping-lists for navigation gaps and state sharing; upgrade links and toasts.
6. **QA & Polish** — Run lint/tests, ensure docs and plan trackers reflect progress.
