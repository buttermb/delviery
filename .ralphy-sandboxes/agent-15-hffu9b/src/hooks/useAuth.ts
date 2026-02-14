/**
 * Master Authentication Hook
 *
 * TanStack Query-based hook that provides comprehensive auth state management
 * for the FloraIQ platform. Manages Supabase auth state, token storage,
 * automatic refresh, and auth operations.
 *
 * Usage:
 *   import { useAuth } from '@/hooks/useAuth';
 *   const { user, session, isAuthenticated, login, logout } = useAuth();
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';
import { tokenRefreshManager } from '@/lib/auth/tokenRefreshManager';
import { performLogoutCleanup } from '@/lib/auth/logoutCleanup';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  session: Session | null;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupCredentials {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}

interface ResetPasswordParams {
  email: string;
  redirectTo?: string;
}

interface ChangePasswordParams {
  currentPassword: string;
  newPassword: string;
}

interface AuthErrorState {
  message: string;
  code?: string;
}

export interface UseAuthReturn {
  /** Current authenticated user or null */
  user: User | null;
  /** Current session or null */
  session: Session | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state is still loading */
  isLoading: boolean;
  /** Current auth error state */
  error: AuthErrorState | null;
  /** Sign in with email/password */
  login: (credentials: LoginCredentials) => Promise<void>;
  /** Sign out the current user */
  logout: () => Promise<void>;
  /** Create a new account */
  signup: (credentials: SignupCredentials) => Promise<void>;
  /** Send password reset email */
  resetPassword: (params: ResetPasswordParams) => Promise<void>;
  /** Change password for authenticated user */
  changePassword: (params: ChangePasswordParams) => Promise<void>;
  /** Manually trigger session refresh */
  refreshSession: () => Promise<void>;
  /** Check current session validity */
  checkSession: () => Promise<boolean>;
  /** Whether login mutation is pending */
  isLoginPending: boolean;
  /** Whether signup mutation is pending */
  isSignupPending: boolean;
  /** Whether logout mutation is pending */
  isLogoutPending: boolean;
}

// ─── Query Keys ─────────────────────────────────────────────────────────────

const AUTH_QUERY_KEY = ['auth', 'session'] as const;

// ─── Token Storage Helpers ──────────────────────────────────────────────────

function storeTokens(session: Session): void {
  try {
    safeStorage.setItem(
      STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN,
      session.access_token
    );
    if (session.refresh_token) {
      safeStorage.setItem(
        STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN,
        session.refresh_token
      );
    }
    logger.debug('[useAuth] Tokens stored successfully');
  } catch (error) {
    logger.warn('[useAuth] Failed to store tokens', error);
  }
}

function clearTokens(): void {
  safeStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN);
  safeStorage.removeItem(STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN);
  safeStorage.removeItem(STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN);
  safeStorage.removeItem(STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN);
  safeStorage.removeItem(STORAGE_KEYS.COURIER_ACCESS_TOKEN);
  logger.debug('[useAuth] Tokens cleared');
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const queryClient = useQueryClient();
  const listenerSetupRef = useRef(false);

  // ── Session Query ──────────────────────────────────────────────────────

  const {
    data: authState,
    isLoading,
    error: queryError,
  } = useQuery<AuthState, AuthError>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async (): Promise<AuthState> => {
      logger.debug('[useAuth] Fetching session');
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        logger.error('[useAuth] getSession error', error);
        throw error;
      }

      if (session) {
        storeTokens(session);
      }

      return {
        user: session?.user ?? null,
        session: session ?? null,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
  });

  // ── Auth State Listener ────────────────────────────────────────────────

  useEffect(() => {
    if (listenerSetupRef.current) return;
    listenerSetupRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        logger.debug('[useAuth] Auth state changed', { event, hasSession: !!session });

        const newState: AuthState = {
          user: session?.user ?? null,
          session: session ?? null,
        };

        // Update query cache directly for instant reactivity
        queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, newState);

        // Handle token storage based on event
        if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          storeTokens(session);
        }

        if (event === 'SIGNED_OUT') {
          clearTokens();
        }

        // Auto-refresh handling
        if (event === 'TOKEN_REFRESHED') {
          logger.debug('[useAuth] Token refreshed automatically');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      listenerSetupRef.current = false;
    };
  }, [queryClient]);

  // ── Login Mutation ─────────────────────────────────────────────────────

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: LoginCredentials): Promise<AuthState> => {
      logger.debug('[useAuth] Login attempt', { email });
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error('[useAuth] Login failed', error);
        throw error;
      }

      if (data.session) {
        storeTokens(data.session);
      }

      return {
        user: data.user,
        session: data.session,
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, data);
      logger.debug('[useAuth] Login successful', { userId: data.user?.id });
    },
  });

  // ── Signup Mutation ────────────────────────────────────────────────────

  const signupMutation = useMutation({
    mutationFn: async ({ email, password, metadata }: SignupCredentials): Promise<AuthState> => {
      logger.debug('[useAuth] Signup attempt', { email });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: metadata ? { data: metadata } : undefined,
      });

      if (error) {
        logger.error('[useAuth] Signup failed', error);
        throw error;
      }

      if (data.session) {
        storeTokens(data.session);
      }

      return {
        user: data.user ?? null,
        session: data.session ?? null,
      };
    },
    onSuccess: (data) => {
      queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, data);
      logger.debug('[useAuth] Signup successful', { userId: data.user?.id });
    },
  });

  // ── Logout Mutation ────────────────────────────────────────────────────

  const logoutMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      logger.debug('[useAuth] Logout initiated');
      const { error } = await supabase.auth.signOut();

      if (error) {
        logger.error('[useAuth] Logout error', error);
        throw error;
      }
    },
    onSuccess: () => {
      clearTokens();
      performLogoutCleanup({ queryClient, tier: 'base' });
      queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, {
        user: null,
        session: null,
      });
      tokenRefreshManager.resetAll();
      logger.debug('[useAuth] Logout successful');
    },
    onError: (error) => {
      // Even on error, clear local state to prevent stale sessions
      clearTokens();
      queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, {
        user: null,
        session: null,
      });
      logger.error('[useAuth] Logout failed, cleared local state anyway', error instanceof Error ? error : new Error(String(error)));
    },
  });

  // ── Reset Password Mutation ────────────────────────────────────────────

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email, redirectTo }: ResetPasswordParams): Promise<void> => {
      logger.debug('[useAuth] Password reset requested', { email });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        logger.error('[useAuth] Password reset failed', error);
        throw error;
      }

      logger.debug('[useAuth] Password reset email sent', { email });
    },
  });

  // ── Change Password Mutation ───────────────────────────────────────────

  const changePasswordMutation = useMutation({
    mutationFn: async ({ newPassword }: ChangePasswordParams): Promise<void> => {
      logger.debug('[useAuth] Password change requested');
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        logger.error('[useAuth] Password change failed', error);
        throw error;
      }

      logger.debug('[useAuth] Password changed successfully');
    },
  });

  // ── Refresh Session ────────────────────────────────────────────────────

  const refreshSession = useCallback(async (): Promise<void> => {
    const result = await tokenRefreshManager.refresh('master-auth', async () => {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session) {
        storeTokens(data.session);
        queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, {
          user: data.session.user,
          session: data.session,
        });
        return {
          success: true,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        };
      }

      return { success: false, error: 'No session returned' };
    });

    if (!result.success) {
      logger.warn('[useAuth] Session refresh failed', { error: result.error });
    }
  }, [queryClient]);

  // ── Check Session ──────────────────────────────────────────────────────

  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        logger.error('[useAuth] Session check failed', error);
        return false;
      }

      if (session) {
        storeTokens(session);
        queryClient.setQueryData<AuthState>(AUTH_QUERY_KEY, {
          user: session.user,
          session,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('[useAuth] Session check exception', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }, [queryClient]);

  // ── Wrapped Action Helpers ─────────────────────────────────────────────

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    await loginMutation.mutateAsync(credentials);
  }, [loginMutation]);

  const logout = useCallback(async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const signup = useCallback(async (credentials: SignupCredentials): Promise<void> => {
    await signupMutation.mutateAsync(credentials);
  }, [signupMutation]);

  const resetPassword = useCallback(async (params: ResetPasswordParams): Promise<void> => {
    await resetPasswordMutation.mutateAsync(params);
  }, [resetPasswordMutation]);

  const changePassword = useCallback(async (params: ChangePasswordParams): Promise<void> => {
    await changePasswordMutation.mutateAsync(params);
  }, [changePasswordMutation]);

  // ── Build Error State ──────────────────────────────────────────────────

  const mutationError = loginMutation.error || signupMutation.error ||
    logoutMutation.error || resetPasswordMutation.error || changePasswordMutation.error;

  const error: AuthErrorState | null = queryError
    ? { message: queryError.message, code: queryError.status?.toString() }
    : mutationError
      ? {
        message: mutationError instanceof Error ? mutationError.message : String(mutationError),
        code: (mutationError as AuthError)?.status?.toString(),
      }
      : null;

  // ── Return ─────────────────────────────────────────────────────────────

  return {
    user: authState?.user ?? null,
    session: authState?.session ?? null,
    isAuthenticated: !!authState?.session?.user,
    isLoading,
    error,
    login,
    logout,
    signup,
    resetPassword,
    changePassword,
    refreshSession,
    checkSession,
    isLoginPending: loginMutation.isPending,
    isSignupPending: signupMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
  };
}
