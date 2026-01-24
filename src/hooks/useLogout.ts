import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { safeStorage } from '@/utils/safeStorage';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

/**
 * All auth-related storage keys that must be cleared on logout.
 * Covers all tiers: super admin, tenant admin, customer, courier.
 */
const AUTH_STORAGE_KEYS = [
  STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN,
  STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN,
  STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN,
  STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN,
  STORAGE_KEYS.COURIER_ACCESS_TOKEN,
  STORAGE_KEYS.SUPER_ADMIN_USER,
  STORAGE_KEYS.SUPER_ADMIN_TENANT_ID,
  STORAGE_KEYS.TENANT_ADMIN_USER,
  STORAGE_KEYS.TENANT_DATA,
  STORAGE_KEYS.CUSTOMER_USER,
  STORAGE_KEYS.CUSTOMER_TENANT_DATA,
  STORAGE_KEYS.COURIER_PIN_SESSION,
] as const;

interface UseLogoutOptions {
  /** URL to redirect to after logout. Defaults to '/login'. */
  redirectTo?: string;
  /** Callback fired after successful logout cleanup */
  onSuccess?: () => void;
}

async function performLogout(): Promise<void> {
  // Call the auth-logout edge function to invalidate server-side session
  const { error } = await supabase.functions.invoke('auth-logout', {
    method: 'POST',
  });

  // If there's an error but it's an auth-related error (401/403),
  // the user is already logged out - treat as success
  if (error) {
    const isAlreadyLoggedOut =
      error.message?.includes('401') ||
      error.message?.includes('403') ||
      error.message?.includes('unauthorized') ||
      error.message?.toLowerCase().includes('not authenticated') ||
      error.message?.toLowerCase().includes('jwt');

    if (!isAlreadyLoggedOut) {
      logger.warn('[LOGOUT] Edge function error (proceeding with cleanup)', { error: error.message });
    }
    // Always proceed with local cleanup regardless of server error
  }

  // Sign out from Supabase auth (clears Supabase session)
  await supabase.auth.signOut().catch((signOutError: unknown) => {
    logger.warn('[LOGOUT] Supabase signOut error (proceeding with cleanup)', { error: signOutError });
  });
}

/**
 * Hook for logging out the current user.
 *
 * Uses `useMutation` to call the `auth-logout` edge function,
 * clears all local storage auth data, clears TanStack Query cache,
 * and redirects to the login page.
 *
 * Handles errors gracefully - if the user is already logged out,
 * local cleanup still proceeds without showing an error.
 */
export function useLogout(options: UseLogoutOptions = {}) {
  const { redirectTo = '/login', onSuccess } = options;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: performLogout,
    onSettled: () => {
      // Always perform local cleanup regardless of success/failure.
      // This ensures the user is fully logged out client-side even if
      // the server request fails.

      // 1. Clear all auth-related localStorage keys
      for (const key of AUTH_STORAGE_KEYS) {
        safeStorage.removeItem(key);
      }

      // 2. Clear shared session keys
      const sharedKeys = ['floraiq_user_id', 'lastTenantSlug'];
      for (const key of sharedKeys) {
        safeStorage.removeItem(key);
        try {
          sessionStorage.removeItem(key);
        } catch {
          // sessionStorage may not be available
        }
      }

      // 3. Clear TanStack Query cache to prevent stale data leaking
      queryClient.clear();

      logger.debug('[LOGOUT] Local cleanup complete');

      // 4. Redirect to login page
      navigate(redirectTo, { replace: true });

      // 5. Fire optional success callback
      onSuccess?.();
    },
    onError: (error: Error) => {
      // Even on error, onSettled handles cleanup.
      // Only show toast for unexpected errors (not "already logged out" cases).
      const isAlreadyLoggedOut =
        error.message?.includes('401') ||
        error.message?.includes('403') ||
        error.message?.includes('unauthorized') ||
        error.message?.toLowerCase().includes('not authenticated');

      if (!isAlreadyLoggedOut) {
        logger.error('[LOGOUT] Unexpected error during logout', error);
        toast.error('Logout encountered an issue, but you have been signed out locally.');
      }
    },
  });

  return {
    logout: mutation.mutate,
    logoutAsync: mutation.mutateAsync,
    isLoggingOut: mutation.isPending,
  };
}
