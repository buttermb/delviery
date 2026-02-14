/**
 * CSRF Token Protection Utility
 *
 * Generates cryptographically secure tokens, stores them in sessionStorage,
 * validates on form submission, and regenerates after each use.
 */

import { logger } from '@/lib/logger';

const CSRF_STORAGE_KEY = 'floraiq_csrf_token';
const CSRF_TIMESTAMP_KEY = 'floraiq_csrf_timestamp';
const TOKEN_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a cryptographically secure random token
 */
function generateRandomToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a new CSRF token and store it in sessionStorage
 */
export function generateCsrfToken(): string {
  const token = generateRandomToken();
  try {
    sessionStorage.setItem(CSRF_STORAGE_KEY, token);
    sessionStorage.setItem(CSRF_TIMESTAMP_KEY, Date.now().toString());
  } catch (error: unknown) {
    logger.warn('Failed to store CSRF token in sessionStorage', error);
  }
  return token;
}

/**
 * Get the current CSRF token from sessionStorage
 * Returns null if no token exists or if the token has expired
 */
export function getCsrfToken(): string | null {
  try {
    const token = sessionStorage.getItem(CSRF_STORAGE_KEY);
    const timestamp = sessionStorage.getItem(CSRF_TIMESTAMP_KEY);

    if (!token || !timestamp) {
      return null;
    }

    const tokenAge = Date.now() - parseInt(timestamp, 10);
    if (tokenAge > TOKEN_MAX_AGE_MS) {
      clearCsrfToken();
      return null;
    }

    return token;
  } catch (error: unknown) {
    logger.warn('Failed to read CSRF token from sessionStorage', error);
    return null;
  }
}

/**
 * Validate a submitted token against the stored token
 * Returns true if the token is valid, false otherwise
 */
export function validateCsrfToken(submittedToken: string): boolean {
  const storedToken = getCsrfToken();

  if (!storedToken || !submittedToken) {
    logger.warn('CSRF validation failed: missing token');
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (storedToken.length !== submittedToken.length) {
    logger.warn('CSRF validation failed: token length mismatch');
    return false;
  }

  let result = 0;
  for (let i = 0; i < storedToken.length; i++) {
    result |= storedToken.charCodeAt(i) ^ submittedToken.charCodeAt(i);
  }

  const isValid = result === 0;
  if (!isValid) {
    logger.warn('CSRF validation failed: token mismatch');
  }

  return isValid;
}

/**
 * Regenerate the CSRF token (call after successful validation/form submission)
 * Returns the new token
 */
export function regenerateCsrfToken(): string {
  clearCsrfToken();
  return generateCsrfToken();
}

/**
 * Clear the stored CSRF token
 */
export function clearCsrfToken(): void {
  try {
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
    sessionStorage.removeItem(CSRF_TIMESTAMP_KEY);
  } catch (error: unknown) {
    logger.warn('Failed to clear CSRF token from sessionStorage', error);
  }
}
