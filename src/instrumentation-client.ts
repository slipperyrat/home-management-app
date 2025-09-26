// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

// Re-enable Sentry for error tracking
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://357b039bf7d7de045a0cab52af0ca44b@o4509813340307456.ingest.us.sentry.io/4509813340504064",
  integrations: [],
  tracesSampleRate: 1,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;