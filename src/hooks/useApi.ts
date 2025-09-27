import { recordApiMetrics } from '@/app/metrics/client';

export async function useApiFetch(route: string, options: RequestInit = {}) {
  const start = performance.now();
  const response = await fetch(route, options);
  const duration = performance.now() - start;
  recordApiMetrics(route, options.method || 'GET', response.status, duration);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}
