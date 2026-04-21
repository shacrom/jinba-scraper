import { env } from '../config/env.js';

// Lazily import Sentry only if DSN is set to avoid unnecessary overhead
let sentryInitialized = false;

export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    return; // no-op — DSN not configured
  }

  // Dynamic import to avoid Sentry overhead when not needed
  import('@sentry/node')
    .then(({ init }) => {
      init({
        dsn: env.SENTRY_DSN,
        environment: env.NODE_ENV,
        tracesSampleRate: 0.1,
      });
      sentryInitialized = true;
    })
    .catch(() => {
      // Sentry init failure is non-fatal
    });
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!sentryInitialized || !env.SENTRY_DSN) {
    return; // no-op
  }

  import('@sentry/node')
    .then(({ captureException: sentryCapture, withScope }) => {
      if (context) {
        withScope((scope) => {
          scope.setExtras(context);
          sentryCapture(err);
        });
      } else {
        sentryCapture(err);
      }
    })
    .catch(() => {
      // ignore
    });
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  if (!sentryInitialized || !env.SENTRY_DSN) {
    return;
  }

  import('@sentry/node')
    .then(({ addBreadcrumb: sentryCrumb }) => {
      sentryCrumb({ message, data, level: 'info' });
    })
    .catch(() => {
      // ignore
    });
}
