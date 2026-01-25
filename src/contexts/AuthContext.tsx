import { logger } from '@/lib/logger';
import { logAuth, logAuthError } from '@/lib/debug/logger';
import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { performLogoutCleanup } from '@/lib/auth/logoutCleanup';
import { tokenRefreshManager } from '@/lib/auth/tokenRefreshManager';

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupCredentials {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** @deprecated Use isLoading instead */
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResult>;
  logout: () => Promise<void>;
  /** @deprecated Use logout instead */
  signOut: () => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);
  const focusListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;

    // Set up auth state change listener FIRST to catch INITIAL_SESSION event.
    // Supabase fires INITIAL_SESSION when it restores a session from its own
    // localStorage, which happens before getSession() resolves.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        logAuth(`Auth state changed: ${event}`, {
          event,
          hasSession: !!currentSession,
          userId: currentSession?.user?.id,
          userEmail: currentSession?.user?.email,
          authMethod: currentSession?.user?.app_metadata?.provider,
          source: 'AuthContext'
        });
        logger.debug('[AuthContext] Auth state change', { event, hasSession: !!currentSession });

        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          // Mark loading complete on INITIAL_SESSION or if we haven't initialized yet
          if (event === 'INITIAL_SESSION' || !initializedRef.current) {
            initializedRef.current = true;
            setIsLoading(false);
          }

          // Log specific auth events
          if (event === 'SIGNED_IN') {
            logger.info('[AuthContext] User signed in', {
              userId: currentSession?.user?.id,
              email: currentSession?.user?.email
            });
          } else if (event === 'SIGNED_OUT') {
            logger.info('[AuthContext] User signed out');
          } else if (event === 'TOKEN_REFRESHED') {
            logger.debug('[AuthContext] Token refreshed successfully');
          }
        }
      }
    );

    // Also call getSession() as a fallback to ensure loading resolves
    // even if onAuthStateChange doesn't fire (edge case)
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted && !initializedRef.current) {
        logAuth('Initial session loaded via getSession fallback', {
          hasSession: !!currentSession,
          userId: currentSession?.user?.id,
          userEmail: currentSession?.user?.email,
          authMethod: currentSession?.user?.app_metadata?.provider,
          source: 'AuthContext'
        });
        logger.debug('[AuthContext] Initial session (fallback)', { hasSession: !!currentSession });
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        initializedRef.current = true;
        setIsLoading(false);
      }
    }).catch((error) => {
      logAuthError('Failed to get initial session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'AuthContext'
      });
      logger.error('[AuthContext] getSession error', error instanceof Error ? error : new Error(String(error)));
      if (mounted && !initializedRef.current) {
        initializedRef.current = true;
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Token refresh on app focus
  useEffect(() => {
    const handleFocus = () => {
      if (!session) return;

      logger.debug('[AuthContext] App focused, checking token freshness');

      // Check if the token is close to expiry (within 5 minutes)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;
        const REFRESH_THRESHOLD_SECONDS = 300; // 5 minutes

        if (timeUntilExpiry < REFRESH_THRESHOLD_SECONDS) {
          logger.info('[AuthContext] Token near expiry on focus, refreshing', {
            timeUntilExpiry,
            threshold: REFRESH_THRESHOLD_SECONDS
          });

          tokenRefreshManager.refresh('auth-context', async () => {
            try {
              const { data, error } = await supabase.auth.refreshSession();
              if (error) {
                logAuthError('Token refresh on focus failed', {
                  error: error.message,
                  source: 'AuthContext'
                });
                return { success: false, error: error.message };
              }
              logAuth('Token refreshed on app focus', { source: 'AuthContext' });
              return {
                success: true,
                accessToken: data.session?.access_token,
                refreshToken: data.session?.refresh_token
              };
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Unknown error';
              logAuthError('Token refresh on focus exception', {
                error: errorMsg,
                source: 'AuthContext'
              });
              return { success: false, error: errorMsg };
            }
          });
        } else {
          logger.debug('[AuthContext] Token still fresh on focus', { timeUntilExpiry });
        }
      }
    };

    focusListenerRef.current = handleFocus;
    window.addEventListener('focus', handleFocus);

    // Also handle visibilitychange for mobile browsers
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      focusListenerRef.current = null;
    };
  }, [session]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResult> => {
    try {
      logAuth('Login attempt', { email: credentials.email, source: 'AuthContext' });
      logger.info('[AuthContext] Login attempt', { email: credentials.email });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        logAuthError('Login failed', {
          error: error.message,
          email: credentials.email,
          source: 'AuthContext'
        });
        logger.warn('[AuthContext] Login failed', { error: error.message, email: credentials.email });
        return { success: false, error: error.message };
      }

      logAuth('Login successful', {
        userId: data.user?.id,
        email: data.user?.email,
        source: 'AuthContext'
      });
      logger.info('[AuthContext] Login successful', { userId: data.user?.id });
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      logAuthError('Login exception', { error: errorMsg, source: 'AuthContext' });
      logger.error('[AuthContext] Login exception', err instanceof Error ? err : new Error(errorMsg));
      return { success: false, error: errorMsg };
    }
  }, []);

  const signup = useCallback(async (credentials: SignupCredentials): Promise<AuthResult> => {
    try {
      logAuth('Signup attempt', { email: credentials.email, source: 'AuthContext' });
      logger.info('[AuthContext] Signup attempt', { email: credentials.email });

      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: credentials.metadata ? { data: credentials.metadata } : undefined,
      });

      if (error) {
        logAuthError('Signup failed', {
          error: error.message,
          email: credentials.email,
          source: 'AuthContext'
        });
        logger.warn('[AuthContext] Signup failed', { error: error.message, email: credentials.email });
        return { success: false, error: error.message };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        logAuth('Signup successful - email confirmation required', {
          userId: data.user.id,
          email: data.user.email,
          source: 'AuthContext'
        });
        logger.info('[AuthContext] Signup successful, confirmation required', { userId: data.user.id });
        return { success: true };
      }

      logAuth('Signup successful', {
        userId: data.user?.id,
        email: data.user?.email,
        source: 'AuthContext'
      });
      logger.info('[AuthContext] Signup successful', { userId: data.user?.id });
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      logAuthError('Signup exception', { error: errorMsg, source: 'AuthContext' });
      logger.error('[AuthContext] Signup exception', err instanceof Error ? err : new Error(errorMsg));
      return { success: false, error: errorMsg };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      logAuth('Logout initiated', {
        userId: user?.id,
        userEmail: user?.email,
        source: 'AuthContext'
      });
      logger.info('[AuthContext] Logout initiated', { userId: user?.id });

      await supabase.auth.signOut();
      setUser(null);
      setSession(null);

      // Reset token refresh manager state
      tokenRefreshManager.reset('auth-context');

      // Comprehensive cleanup: encryption, query cache, storage
      performLogoutCleanup({ queryClient, tier: 'base' });

      logAuth('Logout completed', { source: 'AuthContext' });
      logger.info('[AuthContext] Logout completed');
    } catch (error) {
      logAuthError('Logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'AuthContext'
      });
      logger.error('[AuthContext] Logout error', error instanceof Error ? error : new Error(String(error)));
    }
  }, [user, queryClient]);

  const isAuthenticated = !!user && !!session;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated,
      isLoading,
      loading: isLoading,
      login,
      logout,
      signOut: logout,
      signup,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
