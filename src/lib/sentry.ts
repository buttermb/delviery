/**
 * Sentry Error Tracking Integration
 *
 * Lazy initialization — no-op when VITE_SENTRY_DSN is missing.
 * Safe to call captureException / setSentryUser before init.
 */

import { logger } from '@/lib/logger';

let sentryModule: typeof import('@sentry/react') | null = null;
let initialized = false;

/**
 * Initialize Sentry. Must be called early in main.tsx.
 * No-op if DSN is missing or not in production.
 */
export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    logger.info('[Sentry] DSN not configured, skipping initialization');
    return;
  }

  try {
    sentryModule = await import('@sentry/react');
    sentryModule.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        // Filter out benign ResizeObserver errors
        if (event.exception?.values?.some(v => v.value?.includes('ResizeObserver'))) {
          return null;
        }
        return event;
      },
    });
    initialized = true;
    logger.info('[Sentry] Initialized');
  } catch (error) {
    logger.error('[Sentry] Failed to initialize', error);
  }
}

/**
 * Capture an exception. Safe to call before init (will no-op).
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!sentryModule || !initialized) return;
  sentryModule.captureException(error, { extra: context });
}

/**
 * Set user context for Sentry events.
 */
export function setSentryUser(user: { id: string; email?: string; tenantId?: string }): void {
  if (!sentryModule || !initialized) return;
  sentryModule.setUser({
    id: user.id,
    email: user.email,
    // Store tenantId as extra context
    ...(user.tenantId ? { segment: user.tenantId } : {}),
  });
}

/**
 * Clear user context (e.g. on logout).
 */
export function clearSentryUser(): void {
  if (!sentryModule || !initialized) return;
  sentryModule.setUser(null);
}
