// Re-enable Sentry for error tracking
import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Re-enable Sentry for error tracking
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
