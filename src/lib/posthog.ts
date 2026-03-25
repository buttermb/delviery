/**
 * PostHog Product Analytics Integration
 *
 * Lazy initialization — no-op when VITE_POSTHOG_KEY is missing.
 * Safe to call capture / identify before init.
 */

import { logger } from '@/lib/logger';

type PostHogInstance = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
};

let posthogInstance: PostHogInstance | null = null;

/**
 * Initialize PostHog. Called via scheduleIdle in App.tsx.
 * No-op if key is missing or not in production.
 */
export async function initPostHog(): Promise<void> {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key || !import.meta.env.PROD) {
    logger.info('[PostHog] Key not configured or not production, skipping');
    return;
  }

  try {
    const posthog = await import('posthog-js');
    posthog.default.init(key, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      autocapture: true,
      capture_pageview: true,
      disable_session_recording: true, // Clarity handles session recording
      respect_dnt: true,
      loaded: () => {
        logger.info('[PostHog] Initialized');
      },
    });
    posthogInstance = posthog.default;
  } catch (error) {
    logger.error('[PostHog] Failed to initialize', error);
  }
}

/**
 * Capture an analytics event. Safe to call before init (will no-op).
 */
export function posthogCapture(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!posthogInstance) return;
  posthogInstance.capture(event, properties);
}

/**
 * Identify a user for analytics.
 */
export function posthogIdentify(
  userId: string,
  properties?: Record<string, unknown>,
): void {
  if (!posthogInstance) return;
  posthogInstance.identify(userId, properties);
}

/**
 * Reset user identity (e.g. on logout).
 */
export function posthogReset(): void {
  if (!posthogInstance) return;
  posthogInstance.reset();
}
