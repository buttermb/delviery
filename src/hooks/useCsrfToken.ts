/**
 * useCsrfToken Hook
 *
 * Provides CSRF token management for auth forms:
 * - Generates token on mount (page load)
 * - Validates token on form submission
 * - Regenerates token after each use
 * - Blocks requests without a valid token
 */

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import {
  generateCsrfToken,
  validateCsrfToken,
  regenerateCsrfToken,
} from '@/lib/csrf';

interface UseCsrfTokenReturn {
  /** The current CSRF token to include in form state */
  csrfToken: string;
  /** Validate the token before form submission. Returns true if valid. */
  validateToken: () => boolean;
  /** Regenerate the token (called automatically after validateToken succeeds) */
  refreshToken: () => void;
}

export function useCsrfToken(): UseCsrfTokenReturn {
  const [csrfToken, setCsrfToken] = useState<string>('');

  // Generate token on mount (page load)
  useEffect(() => {
    const token = generateCsrfToken();
    setCsrfToken(token);
  }, []);

  // Validate the current token
  const validateToken = useCallback((): boolean => {
    if (!csrfToken) {
      logger.warn('CSRF token not available for validation');
      return false;
    }

    const isValid = validateCsrfToken(csrfToken);
    if (isValid) {
      // Regenerate after successful validation
      const newToken = regenerateCsrfToken();
      setCsrfToken(newToken);
    }
    return isValid;
  }, [csrfToken]);

  // Manual refresh if needed
  const refreshToken = useCallback((): void => {
    const newToken = regenerateCsrfToken();
    setCsrfToken(newToken);
  }, []);

  return { csrfToken, validateToken, refreshToken };
}
