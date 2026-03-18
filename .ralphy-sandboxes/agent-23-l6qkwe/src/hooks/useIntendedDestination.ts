import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { logger } from '@/lib/logger';

const STORAGE_KEY = 'auth_intended_destination';
const STORAGE_EXPIRY_KEY = 'auth_intended_destination_expiry';
const EXPIRY_MINUTES = 30;

/**
 * Hook to manage the intended destination for auth redirects.
 *
 * When a user is redirected to login from a protected route,
 * this hook stores their intended destination so they can be
 * redirected back after authentication.
 *
 * Uses both sessionStorage (primary) and URL params (fallback)
 * to ensure the destination survives OAuth redirects.
 */
export function useIntendedDestination() {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Save the intended destination path.
   * Call this before redirecting to login.
   */
  const saveIntendedDestination = useCallback((path: string) => {
    // Don't save login/signup pages as intended destinations
    if (
      path.includes('/login') ||
      path.includes('/signup') ||
      path.includes('/forgot-password') ||
      path.includes('/reset-password') ||
      path.includes('/auth/callback') ||
      path.includes('/verify-email')
    ) {
      logger.debug('[IntendedDestination] Skipping save for auth page', { path });
      return;
    }

    try {
      const expiryTime = Date.now() + EXPIRY_MINUTES * 60 * 1000;
      sessionStorage.setItem(STORAGE_KEY, path);
      sessionStorage.setItem(STORAGE_EXPIRY_KEY, expiryTime.toString());
      logger.debug('[IntendedDestination] Saved intended destination', { path });
    } catch (error) {
      logger.warn('[IntendedDestination] Failed to save to sessionStorage', error);
    }
  }, []);

  /**
   * Get the intended destination path.
   * Returns null if no valid destination is stored.
   * Automatically clears the stored destination after retrieval.
   */
  const getIntendedDestination = useCallback((): string | null => {
    // Check URL param first (survives OAuth redirects)
    const urlRedirect = searchParams.get('redirect');
    if (urlRedirect) {
      logger.debug('[IntendedDestination] Found redirect in URL params', { urlRedirect });
      // Clear from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('redirect');
      setSearchParams(newParams, { replace: true });
      return urlRedirect;
    }

    // Check sessionStorage
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const expiryStr = sessionStorage.getItem(STORAGE_EXPIRY_KEY);

      if (!stored) {
        return null;
      }

      // Check expiry
      if (expiryStr) {
        const expiry = parseInt(expiryStr, 10);
        if (Date.now() > expiry) {
          logger.debug('[IntendedDestination] Stored destination expired');
          clearIntendedDestination();
          return null;
        }
      }

      logger.debug('[IntendedDestination] Retrieved intended destination', { stored });
      // Clear after retrieval
      clearIntendedDestination();
      return stored;
    } catch (error) {
      logger.warn('[IntendedDestination] Failed to read from sessionStorage', error);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearIntendedDestination is defined below and stable (no external deps)
  }, [searchParams, setSearchParams]);

  /**
   * Clear the stored intended destination.
   */
  const clearIntendedDestination = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_EXPIRY_KEY);
    } catch {
      // Silently fail
    }
  }, []);

  /**
   * Build a login URL with the intended destination as a query param.
   * Useful for OAuth flows where sessionStorage may not survive.
   */
  const buildLoginUrlWithRedirect = useCallback(
    (loginPath: string, intendedPath: string): string => {
      // Don't add redirect for auth pages
      if (
        intendedPath.includes('/login') ||
        intendedPath.includes('/signup') ||
        intendedPath.includes('/forgot-password') ||
        intendedPath.includes('/auth/callback')
      ) {
        return loginPath;
      }

      const url = new URL(loginPath, window.location.origin);
      url.searchParams.set('redirect', intendedPath);
      return url.pathname + url.search;
    },
    []
  );

  return {
    saveIntendedDestination,
    getIntendedDestination,
    clearIntendedDestination,
    buildLoginUrlWithRedirect,
  };
}

/**
 * Standalone utility functions for use outside of React components
 */
export const intendedDestinationUtils = {
  save: (path: string): void => {
    // Don't save login/signup pages
    if (
      path.includes('/login') ||
      path.includes('/signup') ||
      path.includes('/forgot-password') ||
      path.includes('/reset-password') ||
      path.includes('/auth/callback') ||
      path.includes('/verify-email')
    ) {
      return;
    }

    try {
      const expiryTime = Date.now() + EXPIRY_MINUTES * 60 * 1000;
      sessionStorage.setItem(STORAGE_KEY, path);
      sessionStorage.setItem(STORAGE_EXPIRY_KEY, expiryTime.toString());
    } catch {
      // Silently fail
    }
  },

  get: (): string | null => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const expiryStr = sessionStorage.getItem(STORAGE_EXPIRY_KEY);

      if (!stored) return null;

      if (expiryStr) {
        const expiry = parseInt(expiryStr, 10);
        if (Date.now() > expiry) {
          intendedDestinationUtils.clear();
          return null;
        }
      }

      return stored;
    } catch {
      return null;
    }
  },

  clear: (): void => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_EXPIRY_KEY);
    } catch {
      // Silently fail
    }
  },

  /**
   * Get and clear in one operation
   */
  consume: (): string | null => {
    const value = intendedDestinationUtils.get();
    if (value) {
      intendedDestinationUtils.clear();
    }
    return value;
  },
};
