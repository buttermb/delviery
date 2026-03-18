import { logger } from '@/lib/logger';
import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";
import { clientEncryption } from "@/lib/encryption/clientEncryption";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { safeStorage } from "@/utils/safeStorage";
import { getTokenExpiration } from "@/lib/auth/jwt";
import { SessionTimeoutWarning } from "@/components/auth/SessionTimeoutWarning";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { resilientFetch, ErrorCategory, getErrorMessage, initConnectionMonitoring, onConnectionStatusChange, type ConnectionStatus } from "@/lib/utils/networkResilience";
import { authFlowLogger, AuthFlowStep, AuthAction } from "@/lib/utils/authFlowLogger";
import { performFullLogout } from "@/lib/utils/authHelpers";

interface SuperAdmin {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

interface SuperAdminAuthContextType {
  superAdmin: SuperAdmin | null;
  token: string | null;
  supabaseSession: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextType | undefined>(undefined);

const TOKEN_KEY = STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN;
const SUPER_ADMIN_KEY = STORAGE_KEYS.SUPER_ADMIN_USER;
const SUPABASE_SESSION_KEY = STORAGE_KEYS.SUPERADMIN_SUPABASE_SESSION;

// Initialize connection monitoring on module load
if (typeof window !== 'undefined') {
  initConnectionMonitoring();
}
export const SuperAdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [secondsUntilLogout, setSecondsUntilLogout] = useState(60);

  // Monitor connection status
  useEffect(() => {
    const unsubscribe = onConnectionStatusChange((status) => {
      setConnectionStatus(status);
      logger.info('Connection status updated in super admin auth context', { status });
    });
    return unsubscribe;
  }, []);

  // Wrap verifyToken in useCallback to prevent infinite loops
  const verifyToken = useCallback(async (tokenToVerify: string) => {
    const flowId = authFlowLogger.startFlow(AuthAction.VERIFY, {});

    try {
      authFlowLogger.logStep(flowId, AuthFlowStep.NETWORK_REQUEST);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
      const url = `${supabaseUrl}/functions/v1/super-admin-auth?action=verify`;

      authFlowLogger.logFetchAttempt(flowId, url, 1);
      const fetchStartTime = performance.now();

      // Detect mobile and use longer timeout
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const timeout = isMobile ? 15000 : 10000;

      const { response, attempts, category } = await resilientFetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${tokenToVerify}`,
          "Content-Type": "application/json",
        },
        timeout,
        retryConfig: {
          maxRetries: 1,
          initialDelay: 500,
        },
        onError: (errorCategory) => {
          authFlowLogger.logFetchFailure(flowId, url, new Error(getErrorMessage(errorCategory)), errorCategory, attempts);
        },
      });

      if (!response.ok) {
        const error = new Error("Token verification failed");
        authFlowLogger.failFlow(flowId, error, category);
        throw error;
      }

      authFlowLogger.logFetchSuccess(flowId, url, response.status, performance.now() - fetchStartTime);
      authFlowLogger.logStep(flowId, AuthFlowStep.PARSE_RESPONSE);

      const data = await response.json();
      setSuperAdmin(data.superAdmin);
      safeStorage.setItem(SUPER_ADMIN_KEY, JSON.stringify(data.superAdmin));

      authFlowLogger.logStep(flowId, AuthFlowStep.COMPLETE);
      authFlowLogger.completeFlow(flowId, { superAdminId: data.superAdmin?.id });
      setLoading(false);
    } catch (error) {
      const category = error instanceof Error && error.message.includes('Network')
        ? ErrorCategory.NETWORK
        : ErrorCategory.AUTH;
      authFlowLogger.failFlow(flowId, error, category);

      // User-friendly error messages
      const errorMessage = category === ErrorCategory.NETWORK
        ? 'Network connection lost. Check your internet and try again.'
        : 'Login session expired. Please log in again.';

      logger.error(errorMessage, error);
      safeStorage.removeItem(TOKEN_KEY);
      safeStorage.removeItem(SUPER_ADMIN_KEY);
      setToken(null);
      setSuperAdmin(null);
      setLoading(false);
    }
  }, []); // No dependencies needed - uses parameter

  // Initialize from localStorage and restore Supabase session
  useEffect(() => {
    const storedToken = safeStorage.getItem(TOKEN_KEY);
    const storedAdmin = safeStorage.getItem(SUPER_ADMIN_KEY);
    const storedSupabaseSession = safeStorage.getItem(SUPABASE_SESSION_KEY);

    if (storedToken && storedAdmin) {
      setToken(storedToken);
      try {
        setSuperAdmin(JSON.parse(storedAdmin));

        // Restore Supabase session if available
        if (storedSupabaseSession) {
          try {
            const session = JSON.parse(storedSupabaseSession);
            setSupabaseSession(session);
            // Set the session in Supabase client for RLS access
            supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token ?? '',
            }).then(({ error }) => {
              if (error) {
                logger.error('Failed to restore Supabase session', error, { component: 'SuperAdminAuth' });
              } else {
                logger.info('Supabase session restored successfully', { component: 'SuperAdminAuth' });
              }
            });
          } catch (sessionParseError) {
            logger.error('Failed to parse stored Supabase session', sessionParseError instanceof Error ? sessionParseError : new Error(String(sessionParseError)), { component: 'SuperAdminAuth' });
            safeStorage.removeItem(SUPABASE_SESSION_KEY);
          }
        }

        // Verify token is still valid
        verifyToken(storedToken);
      } catch {
        // Invalid stored data, clear it
        safeStorage.removeItem(TOKEN_KEY);
        safeStorage.removeItem(SUPER_ADMIN_KEY);
        safeStorage.removeItem(SUPABASE_SESSION_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [verifyToken]); // Add verifyToken as dependency

  const login = async (email: string, password: string) => {
    const flowId = authFlowLogger.startFlow(AuthAction.LOGIN, { email });

    try {
      authFlowLogger.logStep(flowId, AuthFlowStep.VALIDATE_INPUT);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
      const url = `${supabaseUrl}/functions/v1/super-admin-auth?action=login`;

      authFlowLogger.logStep(flowId, AuthFlowStep.NETWORK_REQUEST);
      authFlowLogger.logFetchAttempt(flowId, url, 1);
      const fetchStartTime = performance.now();

      const { response, attempts, category } = await resilientFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        timeout: 30000,
        retryConfig: {
          maxRetries: 3,
          initialDelay: 1000,
        },
        onRetry: (attempt, error) => {
          const delay = 1000 * Math.pow(2, attempt - 1);
          authFlowLogger.logFetchRetry(flowId, url, attempt, error, Math.min(delay, 10000));
        },
        onError: (errorCategory) => {
          authFlowLogger.logFetchFailure(flowId, url, new Error(getErrorMessage(errorCategory)), errorCategory, attempts);
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Login failed" }));
        const error = new Error(errorData.error || "Login failed");
        authFlowLogger.failFlow(flowId, error, category);
        throw error;
      }

      authFlowLogger.logFetchSuccess(flowId, url, response.status, performance.now() - fetchStartTime);
      authFlowLogger.logStep(flowId, AuthFlowStep.PARSE_RESPONSE);

      const data = await response.json();

      // Store custom JWT token
      setToken(data.token);
      setSuperAdmin(data.superAdmin);
      safeStorage.setItem(TOKEN_KEY, data.token);
      safeStorage.setItem(SUPER_ADMIN_KEY, JSON.stringify(data.superAdmin));

      // Store user ID for encryption
      if (data.superAdmin?.id) {
        safeStorage.setItem('floraiq_user_id', data.superAdmin.id);
        safeStorage.setItem('floraiq_user_id', data.superAdmin.id);
      }

      // Initialize encryption with user's password
      try {
        if (data.superAdmin?.id) {
          await clientEncryption.initialize(password, data.superAdmin.id);
          logger.debug('Encryption initialized successfully', { component: 'SuperAdminAuthContext' });
        }
      } catch (encryptionError) {
        // Log but don't block login - encryption is optional for now
        logger.warn('Encryption initialization failed', encryptionError instanceof Error ? encryptionError : new Error(String(encryptionError)), { component: 'SuperAdminAuthContext' });
      }

      // ============================================================================
      // PHASE 2: HYBRID AUTH - Store and set Supabase session for RLS access
      // ============================================================================
      if (data.supabaseSession) {
        logger.info('Setting Supabase session for super admin RLS access', { component: 'SuperAdminAuth' });
        setSupabaseSession(data.supabaseSession);
        safeStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(data.supabaseSession));

        // Set the session in Supabase client - this enables RLS access
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.supabaseSession.access_token,
          refresh_token: data.supabaseSession.refresh_token ?? '',
        });

        if (sessionError) {
          logger.error('Failed to set Supabase session', sessionError);
        } else {
          logger.info('Super admin can now access tenant data via RLS', { component: 'SuperAdminAuth' });
        }
      }

      authFlowLogger.logStep(flowId, AuthFlowStep.COMPLETE);
      authFlowLogger.completeFlow(flowId, { superAdminId: data.superAdmin?.id });
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const category = errorObj.message.includes('Network')
        ? ErrorCategory.NETWORK
        : ErrorCategory.AUTH;
      authFlowLogger.failFlow(flowId, errorObj, category);
      logger.error("Super admin login error", errorObj, {
        component: 'SuperAdminAuthContext',
        category,
        flowId,
      });
      throw errorObj;
    }
  };

  const logout = async () => {
    const flowId = authFlowLogger.startFlow(AuthAction.LOGOUT, {});

    try {
      if (token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
        await resilientFetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
          retryConfig: {
            maxRetries: 1,
            initialDelay: 500,
          },
        });
      }

      // Sign out from Supabase session as well
      await supabase.auth.signOut();

      authFlowLogger.completeFlow(flowId, {});
    } catch (error) {
      const category = ErrorCategory.NETWORK;
      authFlowLogger.failFlow(flowId, error, category);
      logger.error("Logout error", error);
    } finally {
      // Perform complete state cleanup (encryption, Supabase, storage, query cache)
      await performFullLogout();

      // Clear context-specific React state
      setToken(null);
      setSuperAdmin(null);
      setSupabaseSession(null);
    }
  };

  const refreshToken = async () => {
    if (!token) return;

    const flowId = authFlowLogger.startFlow(AuthAction.REFRESH, {});

    try {
      authFlowLogger.logStep(flowId, AuthFlowStep.NETWORK_REQUEST);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
      const url = `${supabaseUrl}/functions/v1/super-admin-auth?action=refresh`;

      authFlowLogger.logFetchAttempt(flowId, url, 1);
      const fetchStartTime = performance.now();

      const { response, attempts, category } = await resilientFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
        timeout: 10000,
        retryConfig: {
          maxRetries: 2,
          initialDelay: 1000,
        },
        onRetry: (attempt, error) => {
          const delay = 1000 * Math.pow(2, attempt - 1);
          authFlowLogger.logFetchRetry(flowId, url, attempt, error, Math.min(delay, 10000));
        },
        onError: (errorCategory) => {
          authFlowLogger.logFetchFailure(flowId, url, new Error(getErrorMessage(errorCategory)), errorCategory, attempts);
        },
      });

      if (!response.ok) {
        const error = new Error("Token refresh failed");
        authFlowLogger.failFlow(flowId, error, category);
        throw error;
      }

      authFlowLogger.logFetchSuccess(flowId, url, response.status, performance.now() - fetchStartTime);
      authFlowLogger.logStep(flowId, AuthFlowStep.PARSE_RESPONSE);

      const data = await response.json();
      setToken(data.token);
      safeStorage.setItem(TOKEN_KEY, data.token);

      authFlowLogger.logStep(flowId, AuthFlowStep.COMPLETE);
      authFlowLogger.completeFlow(flowId, {});
    } catch (error) {
      const category = error instanceof Error && error.message.includes('Network')
        ? ErrorCategory.NETWORK
        : ErrorCategory.AUTH;
      authFlowLogger.failFlow(flowId, error, category);
      logger.error("Token refresh error", error);
      // If refresh fails, logout
      await logout();
    }
  };

  // Token expiration monitoring - refresh 5 minutes before expiry
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    const checkAndRefreshToken = () => {
      const expiration = getTokenExpiration(token);
      if (!expiration) return;

      const now = new Date();
      const timeUntilExpiry = expiration.getTime() - now.getTime();
      const fiveMinutes = 5 * 60 * 1000;
      const oneMinute = 60 * 1000;

      // Show warning if less than 1 minute until expiry
      if (timeUntilExpiry < oneMinute && timeUntilExpiry > 0) {
        setSecondsUntilLogout(Math.floor(timeUntilExpiry / 1000));
        setShowTimeoutWarning(true);
      } else if (timeUntilExpiry < fiveMinutes && timeUntilExpiry >= oneMinute) {
        // Auto-refresh between 1-5 minutes before expiry
        logger.info("Token expiring soon, refreshing...", { component: 'SuperAdminAuth' });
        refreshToken();
      } else if (timeUntilExpiry <= 0) {
        logger.warn("Token expired, logging out...", { component: 'SuperAdminAuth' });
        setShowTimeoutWarning(false);
        logout();
      }
    };

    // Check immediately
    checkAndRefreshToken();

    // Check every minute
    refreshIntervalRef.current = setInterval(checkAndRefreshToken, 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- logout and refreshToken are stable auth functions; adding them would cause infinite re-subscription
  }, [token]);

  const handleStayLoggedIn = () => {
    setShowTimeoutWarning(false);
    refreshToken();
  };

  const handleLogoutFromWarning = () => {
    setShowTimeoutWarning(false);
    logout();
  };

  return (
    <SuperAdminAuthContext.Provider value={{ superAdmin, token, supabaseSession, loading, login, logout, refreshToken }}>
      {children}
      <SessionTimeoutWarning
        open={showTimeoutWarning}
        onExtendSession={handleStayLoggedIn}
        onLogout={handleLogoutFromWarning}
        secondsRemaining={secondsUntilLogout}
      />
    </SuperAdminAuthContext.Provider>
  );
};

export const useSuperAdminAuth = () => {
  const context = useContext(SuperAdminAuthContext);
  if (context === undefined) {
    throw new Error("useSuperAdminAuth must be used within a SuperAdminAuthProvider");
  }
  return context;
};

