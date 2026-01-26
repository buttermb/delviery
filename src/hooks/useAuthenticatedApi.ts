import { useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface ApiError extends Error {
  status?: number;
}

/**
 * Hook providing an authenticated API call wrapper that automatically
 * retries on 401 errors after refreshing the auth token.
 * If token refresh fails, the user is logged out.
 */
export function useAuthenticatedApi() {
  const { refreshAuthToken, logout } = useTenantAdminAuth();

  const apiCall = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error: unknown) {
      const apiError = error as ApiError;
      if (apiError?.status === 401) {
        logger.debug('[API] Received 401, attempting token refresh');
        const refreshed = await refreshAuthToken();
        if (refreshed) {
          logger.debug('[API] Token refreshed, retrying request');
          return await fn();
        } else {
          logger.warn('[API] Token refresh failed, logging out');
          await logout();
          throw new Error('Session expired');
        }
      }
      throw error;
    }
  }, [refreshAuthToken, logout]);

  return { apiCall };
}
