import { logger } from '@/lib/logger';
import { logAuth, logAuthError } from '@/lib/debug/logger';
import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { clientEncryption } from "@/lib/encryption/clientEncryption";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { safeStorage } from "@/utils/safeStorage";
import { clearPreAuthSessionData, establishFreshSession, invalidateSessionNonce } from "@/lib/auth/sessionFixation";
import { getTokenExpiration } from "@/lib/auth/jwt";
import { createRefreshTimer, tokenNeedsRefresh, type RefreshTimerHandle } from "@/lib/auth/tokenRefresh";
import { SessionTimeoutWarning } from "@/components/auth/SessionTimeoutWarning";
import { resilientFetch, ErrorCategory, getErrorMessage, initConnectionMonitoring, onConnectionStatusChange, type ConnectionStatus } from "@/lib/utils/networkResilience";
import { authFlowLogger, AuthFlowStep, AuthAction } from "@/lib/utils/authFlowLogger";
import { performFullLogout } from "@/lib/utils/authHelpers";

interface Customer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  customer_id?: string;
  tenant_id: string;
}

interface Tenant {
  id: string;
  business_name: string;
  slug: string;
  limits?: {
    customers: number;
    menus: number;
    products: number;
    locations: number;
    users: number;
  };
  usage?: {
    customers: number;
    menus: number;
    products: number;
    locations: number;
    users: number;
  };
}

interface CustomerAuthContextType {
  customer: Customer | null;
  tenant: Tenant | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  connectionStatus: ConnectionStatus;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

const TOKEN_KEY = STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN;
const CUSTOMER_KEY = STORAGE_KEYS.CUSTOMER_USER;
const TENANT_KEY = STORAGE_KEYS.CUSTOMER_TENANT_DATA;

// Validate environment variables
const validateEnvironment = (): { valid: boolean; error?: string } => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';

  if (!supabaseUrl) {
    return { valid: false, error: 'Missing VITE_SUPABASE_URL environment variable' };
  }

  try {
    new URL(supabaseUrl);
  } catch {
    return { valid: false, error: 'Invalid VITE_SUPABASE_URL format' };
  }

  return { valid: true };
};

export const CustomerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [secondsUntilLogout, setSecondsUntilLogout] = useState(300);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');

  // Validate environment on mount
  useEffect(() => {
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
      logger.error('Environment validation failed:', envCheck.error);
      logger.error('[CustomerAuth] Configuration error:', envCheck.error);
      setLoading(false);
    }
  }, []);

  // Initialize connection monitoring
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initConnectionMonitoring();
    }

    const unsubscribe = onConnectionStatusChange((status) => {
      setConnectionStatus(status);
      if (status === 'offline') {
        logger.warn('Customer portal offline', { component: 'CustomerAuthContext' });
      } else if (status === 'online') {
        logger.info('Customer portal back online', { component: 'CustomerAuthContext' });
      }
    });

    return unsubscribe;
  }, []);

  // Initialize from localStorage
  useEffect(() => {
    const storedToken = safeStorage.getItem(TOKEN_KEY);
    const storedCustomer = safeStorage.getItem(CUSTOMER_KEY);
    const storedTenant = safeStorage.getItem(TENANT_KEY);

    if (storedToken && storedCustomer && storedTenant) {
      setToken(storedToken);
      try {
        setCustomer(JSON.parse(storedCustomer));
        setTenant(JSON.parse(storedTenant));
        // Verify token is still valid
        verifyToken(storedToken);
      } catch (e) {
        // Invalid stored data (e.g., corrupted JSON), clear it
        logger.warn('Failed to parse stored customer auth data, clearing storage', e instanceof Error ? e : new Error(String(e)), {
          component: 'CustomerAuthContext',
          hasStoredCustomer: !!storedCustomer,
          hasStoredTenant: !!storedTenant,
        });
        safeStorage.removeItem(TOKEN_KEY);
        safeStorage.removeItem(CUSTOMER_KEY);
        safeStorage.removeItem(TENANT_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const envCheck = validateEnvironment();
      if (!envCheck.valid) {
        throw new Error(envCheck.error || 'Environment configuration error');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
      const { response } = await resilientFetch(
        `${supabaseUrl}/functions/v1/customer-auth?action=verify`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${tokenToVerify}`,
            "Content-Type": "application/json",
          },
          timeout: 8000,
          retryConfig: {
            maxRetries: 2,
            initialDelay: 500,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Customer token verification failed", new Error(errorText), {
          status: response.status,
          component: 'CustomerAuthContext',
          hasToken: !!tokenToVerify,
        });
        throw new Error(`Token verification failed: ${response.status}`);
      }

      const data = await response.json();
      setCustomer(data.customer);
      setTenant(data.tenant);
      safeStorage.setItem(CUSTOMER_KEY, JSON.stringify(data.customer));
      safeStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));
      setLoading(false);
    } catch (error) {
      logger.error("Token verification error", error);
      safeStorage.removeItem(TOKEN_KEY);
      safeStorage.removeItem(CUSTOMER_KEY);
      safeStorage.removeItem(TENANT_KEY);
      setToken(null);
      setCustomer(null);
      setTenant(null);
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, tenantSlug: string) => {
    try {
      const envCheck = validateEnvironment();
      if (!envCheck.valid) {
        throw new Error(envCheck.error || 'Environment configuration error');
      }

      // Session fixation protection: Clear all pre-auth session data
      // This prevents an attacker from setting tokens before the user authenticates
      clearPreAuthSessionData('customer');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';

      const flowId = authFlowLogger.startFlow(AuthAction.LOGIN, {
        email,
        tenantSlug,
        userType: 'customer'
      });

      authFlowLogger.logStep(flowId, AuthFlowStep.NETWORK_REQUEST);

      const { response, attempts } = await resilientFetch(
        `${supabaseUrl}/functions/v1/customer-auth?action=login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password, tenantSlug }),
          timeout: 30000,
          retryConfig: {
            maxRetries: 3,
            initialDelay: 1000,
          },
          onRetry: (attempt, error) => {
            authFlowLogger.logFetchRetry(flowId, 'customer-auth', attempt, error, 1000);
            logger.warn('Customer login retry', {
              attempt,
              error: error instanceof Error ? error.message : String(error),
              component: 'CustomerAuthContext'
            });
          },
        }
      );

      authFlowLogger.logStep(flowId, AuthFlowStep.PARSE_RESPONSE, {
        status: response.status,
        attempts
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Login failed" }));
        // Check if email verification is required
        if (response.status === 403 && error.requires_verification) {
          const verificationError: Error & { requires_verification?: boolean; customer_user_id?: string } = Object.assign(
            new Error(error.message || "Email not verified"),
            { requires_verification: true, customer_user_id: error.customer_user_id as string }
          );
          throw verificationError;
        }
        throw new Error(error.error || "Login failed");
      }

      const data = await response.json();

      authFlowLogger.completeFlow(flowId, {
        customerId: data.customer?.id,
        tenantId: data.tenant?.id
      });

      // Debug: Log successful customer login
      logAuth('Customer login successful', {
        customerId: data.customer?.id,
        customerEmail: data.customer?.email,
        tenantId: data.tenant?.id,
        tenantSlug: data.tenant?.slug,
        source: 'CustomerAuthContext'
      });

      setToken(data.token);
      setCustomer(data.customer);
      setTenant(data.tenant);
      safeStorage.setItem(TOKEN_KEY, data.token);
      safeStorage.setItem(CUSTOMER_KEY, JSON.stringify(data.customer));
      safeStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));

      // Session fixation protection: Establish a fresh session after successful auth
      establishFreshSession('customer');

      // Store user ID for encryption
      if (data.customer?.id) {
        safeStorage.setItem('floraiq_user_id', data.customer.id);
      }

      // Initialize encryption with user's password
      try {
        if (data.customer?.id) {
          await clientEncryption.initialize(password, data.customer.id);
          logger.debug('Encryption initialized successfully', { component: 'CustomerAuthContext' });
        }
      } catch (encryptionError) {
        // Log but don't block login - encryption is optional for now
        logger.warn('Encryption initialization failed', encryptionError instanceof Error ? encryptionError : new Error(String(encryptionError)), { component: 'CustomerAuthContext' });
      }

      // NOTE: Customers use custom JWT tokens, not Supabase auth sessions
      // Customer queries manually filter by tenant_id and customer_id for security
      // If Supabase session support is needed for RLS, we would need to:
      // 1. Create auth.users records for customers in the signup/login flow
      // 2. Return Supabase session from customer-auth edge function
      // 3. Call supabase.auth.setSession() here similar to TenantAdminAuthContext
      // For now, manual filtering provides security without requiring Supabase auth
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const errorRecord = error as Record<string, unknown> | null;

      // Get category from error or use unknown
      const errorCategory = (typeof errorRecord?.category === 'string' ? errorRecord.category : ErrorCategory.UNKNOWN) as string;

      // Log flow failure
      authFlowLogger.failFlow(typeof errorRecord?.flowId === 'string' ? errorRecord.flowId : '', errorObj, errorCategory as ErrorCategory);

      // Enhanced error logging with context
      logger.error("Customer login error", errorObj, {
        component: 'CustomerAuthContext',
        email: email,
        tenantSlug: tenantSlug,
        attempts: typeof errorRecord?.attempts === 'number' ? errorRecord.attempts : undefined,
        errorCategory,
      });

      // Use getErrorMessage for user-friendly errors
      const userMessage = getErrorMessage(errorCategory as ErrorCategory, errorObj);
      throw new Error(userMessage);
    }
  };

  const logout = async () => {
    // Session fixation protection: Invalidate session nonce on logout
    invalidateSessionNonce();

    logAuth('Customer logout initiated', {
      customerId: customer?.id,
      customerEmail: customer?.email,
      tenantId: tenant?.id,
      source: 'CustomerAuthContext'
    });

    try {
      if (token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
        await resilientFetch(
          `${supabaseUrl}/functions/v1/customer-auth?action=logout`,
          {
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
          }
        );
      }
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logAuthError('Customer logout error', {
        error: errorObj.message,
        hadToken: !!token,
        source: 'CustomerAuthContext'
      });
      logger.error("Customer logout error", errorObj, {
        component: 'CustomerAuthContext',
        hadToken: !!token,
      });
    } finally {
      // Perform complete state cleanup (encryption, Supabase, storage, query cache)
      await performFullLogout();

      // Clear context-specific React state
      setToken(null);
      setCustomer(null);
      setTenant(null);

      logAuth('Customer logout completed', { source: 'CustomerAuthContext' });
    }
  };

  const refreshToken = async () => {
    // For customers, tokens last 30 days, so we verify the token is still valid
    // and refresh it proactively before expiry
    if (!token) return;

    // Verify the token directly
    await verifyToken(token);
  };

  // Token expiration monitoring with visibility-aware refresh timer.
  // Uses createRefreshTimer for robust handling of:
  // - Tab backgrounding (visibility change detection)
  // - Wake-from-sleep (time drift detection)
  // - Scheduled proactive refresh before expiry
  const refreshTimerHandleRef = useRef<RefreshTimerHandle | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!token) {
      if (refreshTimerHandleRef.current) {
        refreshTimerHandleRef.current.cleanup();
        refreshTimerHandleRef.current = null;
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // Clean up previous timer
    if (refreshTimerHandleRef.current) {
      refreshTimerHandleRef.current.cleanup();
    }

    // Customer tokens last 30 days, so refresh 5 minutes before expiry
    // and warn 5 minutes before expiry
    const CUSTOMER_REFRESH_BUFFER_MS = 5 * 60 * 1000;
    const CUSTOMER_WARNING_BUFFER_MS = 5 * 60 * 1000;

    refreshTimerHandleRef.current = createRefreshTimer({
      token,
      onRefresh: async () => {
        await refreshToken();
        return true;
      },
      onWarning: (secondsLeft) => {
        setSecondsUntilLogout(secondsLeft > 0 ? secondsLeft : 300);
        setShowTimeoutWarning(true);
      },
      bufferMs: CUSTOMER_REFRESH_BUFFER_MS,
      warningBufferMs: CUSTOMER_WARNING_BUFFER_MS,
    });

    // Also check periodically as a safety net (every hour for customer tokens)
    const checkAndRefreshToken = () => {
      if (tokenNeedsRefresh(token, CUSTOMER_REFRESH_BUFFER_MS)) {
        logger.info("Customer token expiring soon, verifying...", { component: 'CustomerAuth' });
        refreshToken();
      }

      // Check if token is fully expired
      const expiration = getTokenExpiration(token);
      if (expiration && expiration.getTime() <= Date.now()) {
        logger.warn("Customer token expired, logging out...", { component: 'CustomerAuth' });
        setShowTimeoutWarning(false);
        logout();
      }
    };

    refreshIntervalRef.current = setInterval(checkAndRefreshToken, 60 * 60 * 1000);

    return () => {
      if (refreshTimerHandleRef.current) {
        refreshTimerHandleRef.current.cleanup();
        refreshTimerHandleRef.current = null;
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
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
    <CustomerAuthContext.Provider value={{ customer, tenant, token, loading, login, logout, refreshToken, connectionStatus }}>
      {children}
      <SessionTimeoutWarning
        open={showTimeoutWarning}
        onExtendSession={handleStayLoggedIn}
        onLogout={handleLogoutFromWarning}
        secondsRemaining={secondsUntilLogout}
      />
    </CustomerAuthContext.Provider>
  );
};

export const useCustomerAuth = () => {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  }
  return context;
};

