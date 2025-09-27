import { apiRequestCounter, apiLatencyHistogram } from '@/app/metrics/router';

export function recordApiMetrics(route: string, method: string, status: number, durationMs: number) {
  apiRequestCounter.inc({ route, method, status: String(status) });
  apiLatencyHistogram.observe({ route, method }, durationMs);
}
