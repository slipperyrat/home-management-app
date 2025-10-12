import { Counter, Histogram, Registry } from 'prom-client';

const register = new Registry();

export const jobSuccessCounter = new Counter({
  name: 'job_success_total',
  help: 'Total number of successful jobs',
  labelNames: ['job'],
  registers: [register],
});

export const jobFailureCounter = new Counter({
  name: 'job_failure_total',
  help: 'Total number of failed jobs',
  labelNames: ['job'],
  registers: [register],
});

export const jobDurationHistogram = new Histogram({
  name: 'job_duration_seconds',
  help: 'Duration of job execution in seconds',
  labelNames: ['job'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export function getRegistry() {
  return register;
}


