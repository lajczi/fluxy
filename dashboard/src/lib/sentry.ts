import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN || '';
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'production';

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release: `fluxy-dashboard@2.0.0`,

    tracesSampleRate: 0.1,

    tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],

    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: false,
      }),
      Sentry.browserTracingIntegration(),
    ],

    beforeSend(event) {
      if (!event.exception?.values?.[0]?.stacktrace) return null;

      const message = event.exception?.values?.[0]?.value || '';
      if (message.includes('ResizeObserver')) return null;

      return event;
    },

    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console' && breadcrumb.level === 'log') return null;
      return breadcrumb;
    },
  });

  console.log(`[Sentry] Dashboard SDK initialized (env: ${environment})`);
} else {
  console.log('[Sentry] No VITE_SENTRY_DSN - dashboard error tracking disabled');
}

export { Sentry };
