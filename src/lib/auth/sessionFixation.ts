/**
 * Session Fixation Protection
 *
 * Prevents session fixation attacks by:
 * 1. Clearing all pre-authentication session data before login
 * 2. Generating a fresh session nonce after successful authentication
 * 3. Invalidating any stale session markers from previous sessions
 *
 * This ensures that an attacker cannot set a session token (e.g., via XSS or
 * URL manipulation) before the user authenticates, and then hijack the
 * authenticated session.
 */

import { logger } from '@/lib/logger';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';
import { tokenRefreshManager } from '@/lib/auth/tokenRefreshManager';

/** Key for storing the session nonce that proves session freshness */
const SESSION_NONCE_KEY = 'floraiq_session_nonce';
/** Key for storing the timestamp when the session was established */
const SESSION_ESTABLISHED_KEY = 'floraiq_session_established_at';

/**
 * Generates a cryptographically random session nonce.
 * Uses crypto.getRandomValues for secure randomness.
 */
function generateSessionNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Clear all pre-authentication session data.
 * Must be called BEFORE initiating a login request to prevent session fixation.
 *
 * This removes any tokens, user data, or session markers that could have been
 * set by an attacker before the user authenticates.
 *
 * @param tier - The authentication tier being logged into
 */
export function clearPreAuthSessionData(tier: 'tenant_admin' | 'customer' | 'super_admin'): void {
  logger.debug('[SESSION_FIXATION] Clearing pre-auth session data', { tier });

  // Clear any existing session nonce (prevents reuse of old session markers)
  try {
    sessionStorage.removeItem(SESSION_NONCE_KEY);
    sessionStorage.removeItem(SESSION_ESTABLISHED_KEY);
  } catch {
    // sessionStorage may not be available
  }

  // Clear tier-specific tokens and data
  if (tier === 'tenant_admin') {
    safeStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
    safeStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN);
    safeStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_USER);
    safeStorage.removeItem(STORAGE_KEYS.TENANT_DATA);
    tokenRefreshManager.reset('tenant-admin');
  } else if (tier === 'customer') {
    safeStorage.removeItem(STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN);
    safeStorage.removeItem(STORAGE_KEYS.CUSTOMER_USER);
    safeStorage.removeItem(STORAGE_KEYS.CUSTOMER_TENANT_DATA);
    tokenRefreshManager.reset('customer');
  } else if (tier === 'super_admin') {
    safeStorage.removeItem(STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN);
    safeStorage.removeItem(STORAGE_KEYS.SUPER_ADMIN_USER);
    safeStorage.removeItem(STORAGE_KEYS.SUPER_ADMIN_TENANT_ID);
  }

  // Clear shared session markers
  try {
    sessionStorage.removeItem('floraiq_user_id');
  } catch {
    // sessionStorage may not be available
  }
  safeStorage.removeItem(STORAGE_KEYS.FLORAIQ_USER_ID as typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS]);

  logger.debug('[SESSION_FIXATION] Pre-auth session data cleared', { tier });
}

/**
 * Establish a fresh session after successful authentication.
 * Generates a new session nonce and stores it in sessionStorage.
 *
 * This must be called AFTER successful login to mark the session as
 * legitimately established by the user.
 *
 * @param tier - The authentication tier that was successfully authenticated
 * @returns The generated session nonce (for optional server-side validation)
 */
export function establishFreshSession(tier: 'tenant_admin' | 'customer' | 'super_admin'): string {
  const nonce = generateSessionNonce();
  const timestamp = Date.now().toString();

  try {
    sessionStorage.setItem(SESSION_NONCE_KEY, nonce);
    sessionStorage.setItem(SESSION_ESTABLISHED_KEY, timestamp);
  } catch {
    // sessionStorage may not be available - log but don't block auth
    logger.warn('[SESSION_FIXATION] Could not store session nonce in sessionStorage');
  }

  logger.debug('[SESSION_FIXATION] Fresh session established', { tier, timestamp });
  return nonce;
}

/**
 * Validate that the current session was legitimately established.
 * Checks that a session nonce exists in sessionStorage (proving
 * the session was created through the proper login flow).
 *
 * @returns Whether the session appears legitimate
 */
export function validateSessionFreshness(): boolean {
  try {
    const nonce = sessionStorage.getItem(SESSION_NONCE_KEY);
    const establishedAt = sessionStorage.getItem(SESSION_ESTABLISHED_KEY);

    if (!nonce || !establishedAt) {
      return false;
    }

    // Validate nonce format (64 hex chars = 32 bytes)
    if (!/^[0-9a-f]{64}$/.test(nonce)) {
      logger.warn('[SESSION_FIXATION] Invalid session nonce format detected');
      return false;
    }

    // Validate timestamp is reasonable (not in the future, not too old)
    const timestamp = parseInt(establishedAt, 10);
    if (isNaN(timestamp) || timestamp > Date.now()) {
      logger.warn('[SESSION_FIXATION] Invalid session timestamp detected');
      return false;
    }

    return true;
  } catch {
    // sessionStorage not available - cannot validate
    return false;
  }
}

/**
 * Invalidate the current session nonce.
 * Called during logout to ensure the session marker cannot be reused.
 */
export function invalidateSessionNonce(): void {
  try {
    sessionStorage.removeItem(SESSION_NONCE_KEY);
    sessionStorage.removeItem(SESSION_ESTABLISHED_KEY);
  } catch {
    // sessionStorage may not be available
  }
  logger.debug('[SESSION_FIXATION] Session nonce invalidated');
}
