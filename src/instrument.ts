import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

dotenv.config();

const dsn = process.env.SENTRY_DSN || '';

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    release: `fluxy@2.0.0`,
    tracesSampleRate: 0,
    sendDefaultPii: true,
    debug: process.env.SENTRY_DEBUG === 'true',
  });
  console.log(`[Sentry] SDK initialized (dsn: ${dsn.substring(0, 30)}...)`);

  Sentry.captureMessage('Fluxy process started', { level: 'info', tags: { source: 'startup' } });
  Sentry.flush(5000).then((flushed) => {
    if (flushed) {
      console.log('[Sentry] Startup event sent successfully');
    } else {
      console.error('[Sentry] WARNING: Failed to flush startup event - events may not be reaching Sentry');
    }
  }).catch((err) => {
    console.error('[Sentry] Flush error:', err);
  });
} else {
  console.log('[Sentry] No SENTRY_DSN found in environment - disabled');
}
