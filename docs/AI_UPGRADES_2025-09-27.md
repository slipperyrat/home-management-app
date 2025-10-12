# AI Upgrades – 27 Sep 2025

## Summary
- Centralized AI configuration (`AIConfigManager`) now deep-clones defaults before applying environment overrides, preventing cross-request state bleed.
- `AIEmailProcessor` respects feature flags/provider selection: avoids instantiating OpenAI when disabled or using mock provider, and validates API keys up front.
- Email processing requests reuse the cached model from config, ensuring consistent responses across environments.
- These updates landed in commit `d867d35` on 27 Sep 2025 (merged to `main` from `local-progress-20250927` + `cursor/optimize-openai...`).

## Operational Notes
- Required environment variables when OpenAI is active:
  - `OPENAI_API_KEY`
  - Optional per-feature overrides: `AI_MODEL_EMAIL`, `AI_MODEL_SHOPPING`, `AI_MODEL_MEAL`
  - Feature toggles: `AI_EMAIL_PROCESSING_ENABLED`, `AI_SHOPPING_ENABLED`, `AI_MEAL_PLANNING_ENABLED`
- When `AI_PROVIDER=mock` or a feature flag is `false`, services now return a structured error instead of attempting an OpenAI call.
- Relevant code: `src/lib/ai/config/aiConfig.ts`, `src/lib/ai/emailProcessor.ts`, `src/lib/ai/services/BaseAIService.ts`.

## Testing Checklist
- `node scripts/test-ai-email-processing.js`
- Smoke test `/api/ai/process-email` with feature flags on/off.
- Run targeted service tests: `npm run test -- src/lib/ai` (expand coverage as needed).
  - Newly added config guards verified via mocked unit tests (pending addition).

## Follow-ups
- Add automated coverage for mock fallbacks (shopping + meal planning).
- Monitor `ai_processing_logs` for new error signatures introduced by configuration validation.
- Document any additional feature toggles in `docs/AUTH_SESSION_MANAGEMENT.md` if expanded.
