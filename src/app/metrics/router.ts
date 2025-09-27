import { NextRequest, NextResponse } from 'next/server';
import { register, Counter, Histogram } from 'prom-client';

register.clear();

export const apiRequestCounter = new Counter({
  name: 'api_requests_total',
  help: 'Total API requests',
  labelNames: ['route', 'method', 'status'],
});

export const apiLatencyHistogram = new Histogram({
  name: 'api_request_duration_ms',
  help: 'API request duration in ms',
  labelNames: ['route', 'method'],
  buckets: [50, 100, 200, 300, 500, 1000, 2000],
});

export const jobSuccessCounter = new Counter({
  name: 'job_success_total',
  help: 'Total successful jobs',
  labelNames: ['job'],
});

export const jobFailureCounter = new Counter({
  name: 'job_failure_total',
  help: 'Total failed jobs',
  labelNames: ['job'],
});

export const jobDurationHistogram = new Histogram({
  name: 'job_duration_ms',
  help: 'Job duration in ms',
  labelNames: ['job'],
  buckets: [100, 500, 1000, 2000, 5000, 10000],
});

export async function GET(_req: NextRequest) {
  const metrics = await register.metrics();
  return new NextResponse(metrics, {
    status: 200,
    headers: {
      'Content-Type': register.contentType,
    },
  });
}
