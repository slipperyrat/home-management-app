# Type Error Remediation Plan

## Completed

- Security utilities (`monitoring.ts`, `rateLimiter.ts`, CSRF helper) updated for strict optionals.
- Shopping & receipt ingestion flows (`addRecipeIngredients*`, confirmation, merge, receiptOCR) aligned with Supabase schema.
- Stripe, logging service, push notifications, and offline storage hardened for new typings.

## Active Focus

1. **Google Calendar Client**
   - `src/lib/googleCalendar.ts`: finalise calendar/event mapping using `calendar_v3` types, ensure optional params (timeMax, description) guarded.

2. **Performance Monitoring**
   - `src/lib/monitoring/PerformanceMonitor.ts` & `index.ts`: finish guarding `process.*`, optional metadata, and map reductions without `{}` index signatures.

3. **Finance Receipt Integration**
   - `src/lib/finance/receiptIntegration.ts`: confirm updates/description fields use Supabase `Update` type (string vs null).

4. **Supabase Feature Flags**
   - `src/lib/server/featureFlags.ts`: remove unused imports, ensure query uses existing columns or provide fallback structure.

5. **Meal Services & Hooks**
   - `src/lib/services/meal/MealService.ts` and related hooks/components: map Supabase results to domain interfaces, enforce non-null strings.

6. **OCR Data Persistence**
   - `src/lib/ocr/receiptOCRService.ts`: confirm attachment updates/casts match generated schema (JSON fields, totals).

7. **Push Notifications**
   - `src/lib/pushNotifications.ts`: finalise custom `actions` typing and optional `tag` handling.

8. **Middleware & Feature Flag Headers**
   - `src/lib/middleware/featureFlags.ts`: ensure returned `NextResponse` types match generics.

9. **Tests & Typings**
   - Install missing declarations (`@types/luxon`), import `vi` from Vitest in tests, update Next 15 middleware mocks, adjust notification/PWA tests for new signatures.

## Verification

- Iterate `npm run type-check` until clean.
- Run targeted unit tests (`npm run test -- --runInBand`) for affected modules.
- Document any residual casts/TODOs requiring later refactors.
