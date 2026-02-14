import { logger } from '@/lib/logger';
import { logAuth, logAuthError } from '@/lib/debug/logger';
import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { performFullLogout } from "@/lib/utils/authHelpers";
import { tokenRefreshManager } from "@/lib/auth/tokenRefreshManager";

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupCredentials {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);
  const focusListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;

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

          if (event === 'INITIAL_SESSION' || !initializedRef.current) {
            initializedRef.current = true;
            setIsLoading(false);
          }

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

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (mounted && !initializedRef.current) {
        logAuth('Initial session loaded via getSession fallback', {
          hasSession: !!currentSession,
          userId: currentSession?.user?.id,
          source: 'AuthContext'
        });
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

  useEffect(() => {
    const handleFocus = () => {
      if (!session) return;

      const expiresAt = session.expires_at;
      if (expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;
        const REFRESH_THRESHOLD_SECONDS = 300;

        if (timeUntilExpiry < REFRESH_THRESHOLD_SECONDS) {
          tokenRefreshManager.refresh('auth-context', async () => {
            try {
              const { data, error } = await supabase.auth.refreshSession();
              if (error) {
                return { success: false, error: error.message };
              }
              return {
                success: true,
                accessToken: data.session?.access_token,
                refreshToken: data.session?.refresh_token
              };
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Unknown error';
              return { success: false, error: errorMsg };
            }
          });
        }
      }
    };

    focusListenerRef.current = handleFocus;
    window.addEventListener('focus', handleFocus);

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

      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        logAuthError('Login failed', { error: error.message, source: 'AuthContext' });
        return { success: false, error: error.message };
      }

      logAuth('Login successful', { userId: data.user?.id, source: 'AuthContext' });
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logAuthError('Login exception', { error: errorMsg, source: 'AuthContext' });
      return { success: false, error: errorMsg };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      logAuth('Sign out initiated', { userId: user?.id, source: 'AuthContext' });
      await performFullLogout();
      setUser(null);
      setSession(null);
      logAuth('Sign out completed', { source: 'AuthContext' });
    } catch (error) {
      logAuthError('Logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'AuthContext'
      });
    }
  }, [user]);

  const signup = useCallback(async (credentials: SignupCredentials): Promise<AuthResult> => {
    try {
      logAuth('Signup attempt', { email: credentials.email, source: 'AuthContext' });

      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            first_name: credentials.firstName,
            last_name: credentials.lastName,
          },
        },
      });

      if (error) {
        logAuthError('Signup failed', { error: error.message, source: 'AuthContext' });
        return { success: false, error: error.message };
      }

      logAuth('Signup successful', { userId: data.user?.id, source: 'AuthContext' });
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logAuthError('Signup exception', { error: errorMsg, source: 'AuthContext' });
      return { success: false, error: errorMsg };
    }
  }, []);

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
