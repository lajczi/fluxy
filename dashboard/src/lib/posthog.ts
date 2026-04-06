import posthog from 'posthog-js';
import { getAnalyticsOptIn, setAnalyticsOptIn } from './telemetryPrefs';

let initialized = false;

function doInit(): void {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY || '';
  if (!apiKey || initialized) return;

  posthog.init(apiKey, {
    api_host: 'https://meow.dorcus.digital',

    ui_host: 'https://us.posthog.com',

    person_profiles: 'identified_only',

    capture_pageview: true,
    capture_pageleave: true,

    enable_recording_console_log: false,

    autocapture: true,

    respect_dnt: true,

    persistence: 'localStorage+cookie',

    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug();
    },
  });

  initialized = true;
  console.log('[PostHog] Init');
}

export function initPosthogFromPrefs(): void {
  if (getAnalyticsOptIn() === true) doInit();
}

export function getPosthog(): typeof posthog | null {
  return initialized ? posthog : null;
}

export function enableAnalytics(): void {
  setAnalyticsOptIn(true);
  doInit();
}

export function disableAnalytics(): void {
  setAnalyticsOptIn(false);
  if (initialized) {
    posthog.reset();
    initialized = false;
    console.log('[PostHog] Disabled by user');
  }
}

export { posthog };
