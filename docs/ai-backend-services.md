# AI Backend Services Overview

We currently ship two backend-oriented services that power future-facing AI
automation, even though their dedicated dashboards have been removed from the
shipping UI:

## Batch Processing Pipeline

- **Location**: `src/lib/ai/services/BatchProcessor.ts`
- **API surface**: `src/app/api/ai/batch/*`
- **Purpose**: queues and processes bulk AI jobs (shopping suggestions, meal
  planning experiments, chore/email prototypes) with retry / concurrency
  controls.
- **Status**: backend-only. The previous `/batch-processing` dashboard was
  intentionally removed so end users do not see the unfinished tooling.

## Performance Monitoring Service

- **Location**: `src/lib/monitoring/PerformanceMonitor.ts`
- **API surface**: `src/app/api/monitoring/performance/route.ts`
- **Purpose**: records AI request timings, WebSocket metrics, and system stats
  for operational insight.
- **Status**: backend instrumentation remains active, but the `/monitoring`
  dashboard was removed from the UI until we ship a production-ready
  experience.

Both services are maintained so we can revive the associated dashboards (or
build internal tooling) without reimplementing the core processing logic. When
we are ready to expose them again, rehydrate the client hooks/components from
commit history and connect them to these existing endpoints.

