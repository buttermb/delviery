import { useRef, useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';

interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug: string;
  rememberMe: boolean;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  admin: {
    id: string;
    email: string;
    name?: string;
    role: string;
    tenant_id: string;
    userId: string;
  };
  tenant: {
    id: string;
    business_name: string;
    slug: string;
    subscription_plan: string;
    subscription_status: string;
  };
  session?: {
    user?: {
      factors?: Array<{ factor_type: string; status: string }>;
    };
  };
}

interface FailedAttemptState {
  count: number;
  lastAttemptAt: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS_BEFORE_WARNING = 3;
const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
const LOCKOUT_DURATION_MS = 60_000; // 1 minute lockout

function getFailedAttemptMessage(state: FailedAttemptState): string | null {
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    const secondsLeft = Math.ceil((state.lockedUntil - Date.now()) / 1000);
    return `Too many failed attempts. Please wait ${secondsLeft} seconds before trying again.`;
  }

  if (state.count >= MAX_ATTEMPTS_BEFORE_LOCKOUT) {
    return 'Account may be locked. Please reset your password or contact support.';
  }

  if (state.count >= MAX_ATTEMPTS_BEFORE_WARNING) {
    const remaining = MAX_ATTEMPTS_BEFORE_LOCKOUT - state.count;
    return `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`;
  }

  return null;
}

export function useLogin() {
  const [failedAttempts, setFailedAttempts] = useState<FailedAttemptState>({
    count: 0,
    lastAttemptAt: 0,
    lockedUntil: null,
  });
  const failedAttemptsRef = useRef(failedAttempts);
  failedAttemptsRef.current = failedAttempts;

  const storeSession = useCallback((data: LoginResponse, rememberMe: boolean) => {
    const storage = rememberMe ? localStorage : sessionStorage;

    try {
      storage.setItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN, data.access_token);
      storage.setItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN, data.refresh_token);
      storage.setItem(STORAGE_KEYS.TENANT_ADMIN_USER, JSON.stringify(data.admin));
      storage.setItem(STORAGE_KEYS.TENANT_DATA, JSON.stringify(data.tenant));
    } catch (error) {
      logger.warn('Failed to store session tokens', {
        rememberMe,
        component: 'useLogin',
      });
      // Fallback to safeStorage (localStorage wrapper with error handling)
      safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN, data.access_token);
      safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN, data.refresh_token);
      safeStorage.setItem(STORAGE_KEYS.TENANT_ADMIN_USER, JSON.stringify(data.admin));
      safeStorage.setItem(STORAGE_KEYS.TENANT_DATA, JSON.stringify(data.tenant));
    }
  }, []);

  const mutation = useMutation<LoginResponse, Error, LoginCredentials>({
    mutationFn: async ({ email, password, tenantSlug }: LoginCredentials) => {
      // Check if currently locked out
      const current = failedAttemptsRef.current;
      if (current.lockedUntil && Date.now() < current.lockedUntil) {
        const secondsLeft = Math.ceil((current.lockedUntil - Date.now()) / 1000);
        throw new Error(`Too many failed attempts. Please wait ${secondsLeft} seconds.`);
      }

      const { data, error } = await supabase.functions.invoke<LoginResponse>('auth-login', {
        body: { email, password, tenantSlug },
      });

      if (error) {
        throw new Error(error.message || 'Login failed');
      }

      if (!data) {
        throw new Error('No response received from login service');
      }

      return data;
    },

    onSuccess: async (data, variables) => {
      // Reset failed attempts on success
      setFailedAttempts({ count: 0, lastAttemptAt: 0, lockedUntil: null });

      // Store tokens based on rememberMe preference
      storeSession(data, variables.rememberMe);

      // Sync session with Supabase client for RLS
      try {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      } catch (sessionError) {
        logger.warn('Failed to sync session with Supabase client', {
          component: 'useLogin',
        });
      }

      logger.debug('Login successful', {
        email: variables.email,
        tenantSlug: variables.tenantSlug,
        rememberMe: variables.rememberMe,
        component: 'useLogin',
      });
    },

    onError: (error, variables) => {
      const isCredentialError =
        error.message.includes('Invalid email or password') ||
        error.message.includes('Invalid credentials') ||
        error.message.includes('401');

      if (isCredentialError) {
        setFailedAttempts((prev) => {
          const newCount = prev.count + 1;
          const lockedUntil =
            newCount >= MAX_ATTEMPTS_BEFORE_LOCKOUT
              ? Date.now() + LOCKOUT_DURATION_MS
              : null;

          return {
            count: newCount,
            lastAttemptAt: Date.now(),
            lockedUntil,
          };
        });
      }

      logger.error('Login failed', new Error(error.message), {
        email: variables.email,
        tenantSlug: variables.tenantSlug,
        attemptCount: failedAttemptsRef.current.count + 1,
        component: 'useLogin',
      });
    },
  });

  const attemptMessage = getFailedAttemptMessage(failedAttempts);

  const isLockedOut = !!(
    failedAttempts.lockedUntil && Date.now() < failedAttempts.lockedUntil
  );

  const resetAttempts = useCallback(() => {
    setFailedAttempts({ count: 0, lastAttemptAt: 0, lockedUntil: null });
  }, []);

  return {
    login: mutation.mutate,
    loginAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    data: mutation.data,
    failedAttempts: failedAttempts.count,
    attemptMessage,
    isLockedOut,
    resetAttempts,
    reset: mutation.reset,
  };
}
