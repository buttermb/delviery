/**
 * Token Refresh Utilities
 *
 * Provides robust token refresh mechanisms including:
 * - Token validation
 * - Proactive refresh scheduling with visibility-aware timers
 * - Wake-from-sleep detection
 * - Race condition prevention
 * - Stale state cleanup
 */

import { logger } from '@/lib/logger';
import { getTokenExpiration } from '@/lib/auth/jwt';

/** Refresh token 5 minutes before expiration */
export const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Minimum interval between refresh checks (30 seconds) */
const MIN_CHECK_INTERVAL_MS = 30 * 1000;

/** Threshold for detecting wake-from-sleep (15 seconds drift) */
const SLEEP_DETECTION_THRESHOLD_MS = 15 * 1000;

/**
 * Validates that a refresh token is usable (not null, empty, or a string literal).
 */
export function isValidRefreshToken(token: string | null | undefined): boolean {
  if (!token) return false;
  if (token === 'undefined' || token === 'null') return false;
  if (typeof token !== 'string') return false;
  if (token.trim() === '') return false;
  if (token.length < 10) return false;
  return true;
}

/**
 * Checks whether a token needs refreshing based on its expiration time.
 * Returns true if the token expires within the buffer window.
 */
export function tokenNeedsRefresh(token: string, bufferMs: number = REFRESH_BUFFER_MS): boolean {
  const expiration = getTokenExpiration(token);
  if (!expiration) return false;

  const timeUntilExpiry = expiration.getTime() - Date.now();
  return timeUntilExpiry < bufferMs;
}

/**
 * Extracts a refresh token from a cookie string.
 */
export function extractRefreshTokenFromCookies(
  cookies: string,
  cookieName: string = 'tenant_refresh_token'
): string | null {
  if (!cookies) return null;
  const cookieArray = cookies.split(';').map(c => c.trim());
  const refreshCookie = cookieArray.find(c => c.startsWith(`${cookieName}=`));
  if (refreshCookie) {
    return refreshCookie.split('=')[1] || null;
  }
  return null;
}

/**
 * Cleans up stale auth-related storage keys before a fresh login.
 */
export function cleanupStaleAuthState(
  storage: Storage,
  keysToClean: string[]
): void {
  keysToClean.forEach(key => {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be unavailable in some environments
    }
  });
}

/**
 * Cleans up auth-related cookies by setting them to expire in the past.
 */
export function cleanupAuthCookies(cookieNames: string[]): void {
  cookieNames.forEach(name => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  });
}

export interface RefreshTimerOptions {
  /** The access token to schedule refresh for */
  token: string;
  /** Callback to execute the actual token refresh */
  onRefresh: () => Promise<boolean>;
  /** Callback when session is about to expire (for UI warning) */
  onWarning?: (secondsLeft: number) => void;
  /** Buffer time before expiry to trigger refresh (default: 5 minutes) */
  bufferMs?: number;
  /** Time before expiry to show warning (default: 60 seconds) */
  warningBufferMs?: number;
}

export interface RefreshTimerHandle {
  /** Stops all timers and listeners */
  cleanup: () => void;
  /** Force a refresh check (e.g., after tab becomes visible) */
  checkNow: () => void;
}

/**
 * Creates a robust, visibility-aware refresh timer.
 *
 * Improvements over a simple setTimeout:
 * 1. Detects when the tab becomes visible and checks if refresh is needed
 * 2. Detects wake-from-sleep by monitoring time drift
 * 3. Uses both setTimeout and periodic checks for reliability
 * 4. Cleans up all listeners on disposal
 */
export function createRefreshTimer(options: RefreshTimerOptions): RefreshTimerHandle {
  const {
    token,
    onRefresh,
    onWarning,
    bufferMs = REFRESH_BUFFER_MS,
    warningBufferMs = 60 * 1000,
  } = options;

  let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  let warningTimeout: ReturnType<typeof setTimeout> | null = null;
  let checkInterval: ReturnType<typeof setInterval> | null = null;
  let lastCheckTime = Date.now();
  let isRefreshing = false;
  let disposed = false;

  const expiration = getTokenExpiration(token);

  const doRefresh = async () => {
    if (isRefreshing || disposed) return;
    isRefreshing = true;
    try {
      await onRefresh();
    } catch (error) {
      logger.error('[TokenRefresh] Refresh failed', error);
    } finally {
      isRefreshing = false;
    }
  };

  const checkAndRefresh = () => {
    if (disposed || isRefreshing) return;

    if (!expiration) return;

    const now = Date.now();
    const timeUntilExpiry = expiration.getTime() - now;

    // Token already expired or needs refresh
    if (timeUntilExpiry <= bufferMs) {
      logger.debug('[TokenRefresh] Token needs refresh, triggering');
      doRefresh();
      return;
    }

    // Show warning if within warning buffer
    if (onWarning && timeUntilExpiry <= warningBufferMs && timeUntilExpiry > 0) {
      onWarning(Math.floor(timeUntilExpiry / 1000));
    }
  };

  // Detect wake-from-sleep: if the time since last check is much larger than expected,
  // we likely slept and the setTimeout may not have fired.
  const detectSleepAndCheck = () => {
    if (disposed) return;

    const now = Date.now();
    const elapsed = now - lastCheckTime;
    lastCheckTime = now;

    // If elapsed time is significantly more than the check interval,
    // the machine likely woke from sleep
    if (elapsed > MIN_CHECK_INTERVAL_MS + SLEEP_DETECTION_THRESHOLD_MS) {
      logger.debug('[TokenRefresh] Detected wake-from-sleep, checking token', {
        elapsed,
        expected: MIN_CHECK_INTERVAL_MS,
      });
      checkAndRefresh();
    }
  };

  // Handle visibility change - when tab becomes visible, check token
  const handleVisibilityChange = () => {
    if (disposed) return;
    if (document.visibilityState === 'visible') {
      logger.debug('[TokenRefresh] Tab became visible, checking token');
      lastCheckTime = Date.now();
      checkAndRefresh();
    }
  };

  // Setup the timer if we have a valid expiration
  if (expiration) {
    const timeUntilRefresh = expiration.getTime() - Date.now() - bufferMs;

    if (timeUntilRefresh <= 0) {
      // Token already needs refresh
      logger.debug('[TokenRefresh] Token expires soon, refreshing immediately');
      doRefresh();
    } else {
      // Schedule refresh
      logger.debug(`[TokenRefresh] Scheduling refresh in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);
      refreshTimeout = setTimeout(() => {
        if (!disposed) {
          logger.debug('[TokenRefresh] Scheduled refresh timer fired');
          doRefresh();
        }
      }, timeUntilRefresh);

      // Schedule warning
      if (onWarning) {
        const timeUntilWarning = expiration.getTime() - Date.now() - warningBufferMs;
        if (timeUntilWarning > 0 && timeUntilWarning < timeUntilRefresh) {
          warningTimeout = setTimeout(() => {
            if (!disposed && expiration) {
              const secondsLeft = Math.floor((expiration.getTime() - Date.now()) / 1000);
              onWarning(secondsLeft > 0 ? secondsLeft : 60);
            }
          }, timeUntilWarning);
        }
      }
    }

    // Periodic check for wake-from-sleep detection
    checkInterval = setInterval(detectSleepAndCheck, MIN_CHECK_INTERVAL_MS);

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
  } else {
    logger.warn('[TokenRefresh] Could not determine token expiration, skipping timer setup');
  }

  const cleanup = () => {
    disposed = true;
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    if (warningTimeout) {
      clearTimeout(warningTimeout);
      warningTimeout = null;
    }
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  return {
    cleanup,
    checkNow: checkAndRefresh,
  };
}

/**
 * Creates a race-condition-safe refresh executor.
 * If a refresh is already in progress, subsequent callers wait for the same result.
 */
export function createRefreshExecutor(
  refreshFn: () => Promise<boolean>
): () => Promise<boolean> {
  let isRefreshing = false;
  let currentPromise: Promise<boolean> | null = null;

  return async (): Promise<boolean> => {
    if (isRefreshing && currentPromise) {
      logger.debug('[TokenRefresh] Refresh already in progress, waiting for result');
      return currentPromise;
    }

    isRefreshing = true;
    currentPromise = refreshFn();

    try {
      return await currentPromise;
    } finally {
      isRefreshing = false;
      currentPromise = null;
    }
  };
}
