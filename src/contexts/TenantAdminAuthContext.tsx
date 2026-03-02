import { logger } from '@/lib/logger';
import { logAuth } from '@/lib/debug/logger';
import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getTokenExpiration } from "@/lib/auth/jwt";
import { createRefreshTimer, isValidRefreshToken, tokenNeedsRefresh, type RefreshTimerHandle } from "@/lib/auth/tokenRefresh";

import { clientEncryption } from "@/lib/encryption/clientEncryption";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { safeStorage } from "@/utils/safeStorage";
import { SessionTimeoutWarning } from "@/components/auth/SessionTimeoutWarning";
import { resilientFetch, ErrorCategory, getErrorMessage, initConnectionMonitoring, onConnectionStatusChange, type ConnectionStatus } from "@/lib/utils/networkResilience";
import { authFlowLogger, AuthFlowStep, AuthAction } from "@/lib/utils/authFlowLogger";
import { useFeatureFlags } from "@/config/featureFlags";
import { toast } from "sonner";
import { broadcastLogout } from "@/lib/auth/logoutCleanup";
import { clearPreAuthSessionData, invalidateSessionNonce } from "@/lib/auth/sessionFixation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { FreeTierOnboardingFlow } from "@/components/onboarding/FreeTierOnboardingFlow";
import { useTenantRouteGuard } from "@/hooks/useTenantRouteGuard";
import { performFullLogout } from "@/lib/utils/authHelpers";

interface TenantAdmin {
  id: string;
  email: string;
  name?: string;
  role: string;
  tenant_id: string;
  userId: string;
}

export interface Tenant {
  id: string;
  business_name: string;
  slug: string;
  subscription_plan: string;
  subscription_status: string;
  trial_ends_at?: string | null;
  next_billing_date?: string | null;
  grace_period_ends_at?: string | null;
  payment_method_added?: boolean;
  mrr?: number;
  onboarding_completed?: boolean;
  business_tier?: string;
  created_at?: string;
  // Free tier and credits flags - critical for subscription logic
  is_free_tier?: boolean;
  credits_enabled?: boolean;
  limits: {
    customers: number;
    menus: number;
    products: number;
    locations: number;
    users: number;
  };
  usage: {
    customers: number;
    menus: number;
    products: number;
    locations: number;
    users: number;
  };
  features?: {
    api_access: boolean;
    custom_branding: boolean;
    white_label: boolean;
    advanced_analytics: boolean;
    sms_enabled: boolean;
  };
}

interface SignupResult {
  user: TenantAdmin;
  tenant: Tenant;
}

interface AuthError extends Error {
  status?: number;
  code?: string;
}

interface TenantAdminAuthContextType {
  admin: TenantAdmin | null;
  tenant: Tenant | null;
  tenantSlug: string | null;
  token: string | null; // For backwards compatibility
  accessToken: string | null; // For backwards compatibility
  refreshToken: string | null; // For backwards compatibility
  isAuthenticated: boolean; // New: cookie-based authentication state
  connectionStatus: ConnectionStatus; // Network connection status
  loading: boolean;
  initialized: boolean; // True after initializeAuth completes (prevents flash of login)
  login: (email: string, password: string, tenantSlug: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthToken: () => Promise<boolean>;
  refreshTenant: () => Promise<void>; // Refresh tenant data from database
  handleSignupSuccess?: (signupResult: SignupResult) => Promise<void>; // For signup flow
  mfaRequired: boolean;
  verifyMfa: (code: string) => Promise<void>;
}

export type { TenantAdminAuthContextType };

const TenantAdminAuthContext = createContext<TenantAdminAuthContextType | undefined>(undefined);

// Use centralized storage keys
const ACCESS_TOKEN_KEY = STORAGE_KEYS.TENANT_ADMIN_ACCESS_TOKEN;
const REFRESH_TOKEN_KEY = STORAGE_KEYS.TENANT_ADMIN_REFRESH_TOKEN;
const ADMIN_KEY = STORAGE_KEYS.TENANT_ADMIN_USER;
const TENANT_KEY = STORAGE_KEYS.TENANT_DATA;

// Token refresh buffer (5 minutes before expiration)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
// Token expiration safety buffer (60 seconds)
const EXPIRATION_BUFFER_MS = 60 * 1000;

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

// Initialize connection monitoring on module load
if (typeof window !== 'undefined') {
  initConnectionMonitoring();
}

export const TenantAdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { shouldAutoApprove, flags } = useFeatureFlags();
  const [admin, setAdmin] = useState<TenantAdmin | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null); // For backwards compatibility
  const [accessToken, setAccessToken] = useState<string | null>(null); // For backwards compatibility
  const [refreshToken, setRefreshToken] = useState<string | null>(null); // For backwards compatibility
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Cookie-based auth state
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false); // Set true only after initializeAuth completes
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');

  // Track whether auth has been initialized to prevent re-running on route changes
  const authInitializedRef = useRef(false);

  // Define clearAuthState first so it can be used by other functions
  // Helper function to clear auth state
  const clearAuthState = useCallback(() => {
    setAdmin(null);
    setTenant(null);
    setTenantSlug(null);
    setToken(null);
    setAccessToken(null);
    setRefreshToken(null);
    setIsAuthenticated(false);
    setLoading(false);
    safeStorage.removeItem(ADMIN_KEY);
    safeStorage.removeItem(TENANT_KEY);
    safeStorage.removeItem('lastTenantSlug');
    safeStorage.removeItem(ACCESS_TOKEN_KEY);
    safeStorage.removeItem(REFRESH_TOKEN_KEY);
    // Allow re-initialization after logout (e.g., switching tenants)
    authInitializedRef.current = false;
  }, []);

  // Helper: redirect to login page with session expired message
  // Extracts tenant slug from URL path since state may already be cleared
  const redirectToLoginExpired = useCallback(() => {
    const pathMatch = location.pathname.match(/^\/([^/]+)\/admin/);
    const slug = tenant?.slug || pathMatch?.[1];
    if (slug) {
      navigate(`/saas/login?expired=1`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [tenant?.slug, location.pathname, navigate]);

  useEffect(() => {
    const unsubscribe = onConnectionStatusChange((status) => {
      setConnectionStatus(status);
      logger.info('Connection status updated in auth context', { status });
    });
    return unsubscribe;
  }, []);

  // Sync tenantSlug from tenant data
  useEffect(() => {
    setTenantSlug(tenant?.slug ?? null);
  }, [tenant]);

  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [secondsUntilLogout, setSecondsUntilLogout] = useState(60);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const refreshTimerHandleRef = useRef<RefreshTimerHandle | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const hasShownOnboardingRef = useRef(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  // Check onboarding status - redirect to setup wizard once per session
  useEffect(() => {
    if (tenant && !loading && !tenant.onboarding_completed && !hasShownOnboardingRef.current) {
      const currentPath = location.pathname;
      const setupWizardPath = `/${tenant.slug}/admin/setup-wizard`;

      // Don't redirect if already on setup wizard or auth-related pages
      if (
        currentPath.includes('/setup-wizard') ||
        currentPath.includes('/login') ||
        currentPath.includes('/auth/') ||
        currentPath.includes('/verify-email') ||
        currentPath.includes('/reset/')
      ) {
        return;
      }

      // Mark as shown to prevent re-triggering
      hasShownOnboardingRef.current = true;

      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        navigate(setupWizardPath, { replace: true });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tenant, loading, location.pathname, navigate]);

  // Validate environment on mount
  useEffect(() => {
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
      logger.error('Environment validation failed:', envCheck.error);
      logger.error('[TenantAdminAuth] Configuration error:', envCheck.error);
      setLoading(false);
    }
  }, []);

  // Sync with Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.access_token) {
          // Update tokens when Supabase refreshes them
          const currentAccessToken = safeStorage.getItem(ACCESS_TOKEN_KEY);
          if (currentAccessToken !== session.access_token) {
            setAccessToken(session.access_token);
            setToken(session.access_token);
            safeStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
            if (session.refresh_token) {
              setRefreshToken(session.refresh_token);
              safeStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
            }
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Initialize authentication (cookie-based) - runs ONCE on mount
  useEffect(() => {
    const LOADING_TIMEOUT_MS = 12000; // 12-second safety timeout

    const initializeAuth = async () => {
      // Prevent re-initialization on subsequent renders/route changes
      if (authInitializedRef.current) {
        return;
      }
      authInitializedRef.current = true;

      // Declare variables outside try block for catch block access
      let parsedAdmin: TenantAdmin | null = null;
      // Check if we're on a tenant admin route
      const isTenantAdminRoute = /^\/[^/]+\/admin/.test(location.pathname);

      // Check if we have stored session data
      const storedAccessToken = safeStorage.getItem(ACCESS_TOKEN_KEY);
      const storedAdmin = safeStorage.getItem(ADMIN_KEY);
      const hasStoredSession = !!(storedAccessToken && storedAdmin);

      // Skip all authentication logic if NOT on a tenant admin route
      if (!isTenantAdminRoute) {
        // If not on admin route but have stored session, keep it (don't clear)
        if (!hasStoredSession) {
          setLoading(false);
        }
        return;
      }

      // Skip token refresh on login/signup pages - user is trying to authenticate
      const isAuthPage = location.pathname.includes('/login') ||
        location.pathname.includes('/signup') ||
        location.pathname.includes('/forgot-password');
      if (isAuthPage) {
        // Clear any stale tokens on auth pages to prevent refresh loops
        safeStorage.removeItem(ACCESS_TOKEN_KEY);
        safeStorage.removeItem(REFRESH_TOKEN_KEY);
        clearAuthState();
        setLoading(false);
        return;
      }

      let parsedTenant: Tenant | null = null;

      try {
        // PRIORITY 1: Check for active Supabase session first
        const { data: { session } } = await supabase.auth.getSession();

        logger.debug('[AUTH_DEBUG] Session check', {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          expiresAt: session?.expires_at,
        });

        if (session?.user) {
          logger.info('[AUTH] Active Supabase session found, fetching admin/tenant data');
          logAuth('Supabase session found', {
            userId: session.user.id,
            userEmail: session.user.email,
            source: 'TenantAdminAuthContext'
          });

          try {
            // Fetch admin and tenant data using user ID from session
            const { data: adminData } = await supabase
              .from('tenant_users')
              .select('id, email, role, tenant_id, status')
              .eq('user_id', session.user.id)
              .eq('status', 'active')
              .maybeSingle();

            logger.debug('[AUTH_DEBUG] Tenant user lookup', {
              found: !!adminData,
              role: adminData?.role,
              tenantId: adminData?.tenant_id,
              status: adminData?.status,
            });

            if (adminData) {
              const { data: tenantData } = await supabase
                .from('tenants')
                .select('id, business_name, slug, subscription_plan, subscription_status, trial_ends_at, grace_period_ends_at, payment_method_added, mrr, onboarding_completed, business_tier, created_at, is_free_tier, credits_enabled, limits, usage, features')
                .eq('id', adminData.tenant_id)
                .maybeSingle();

              logger.debug('[AUTH_DEBUG] Tenant lookup', {
                found: !!tenantData,
                tenantSlug: tenantData?.slug,
                tenantName: tenantData?.business_name,
              });

              if (tenantData) {
                parsedAdmin = {
                  id: adminData.id,
                  email: adminData.email ?? session.user.email ?? '',
                  name: adminData.email, // tenant_users doesn't have full_name
                  role: adminData.role,
                  tenant_id: adminData.tenant_id,
                  userId: session.user.id,
                };
                parsedTenant = tenantData as unknown as Tenant;

                // Debug: Log successful tenant admin authentication
                logAuth('Tenant admin authenticated', {
                  adminId: parsedAdmin.id,
                  adminEmail: parsedAdmin.email,
                  adminRole: parsedAdmin.role,
                  tenantId: parsedTenant.id,
                  tenantSlug: parsedTenant.slug,
                  tenantName: parsedTenant.business_name,
                  source: 'TenantAdminAuthContext'
                });

                setAdmin(parsedAdmin);
                setTenant(parsedTenant);
                setAccessToken(session.access_token);
                setToken(session.access_token);
                setRefreshToken(session.refresh_token || null);

                // Check for MFA requirement on initialization
                const factors = session.user?.factors ?? [];
                const hasVerifiedTotp = factors.some((f: { factor_type: string; status: string }) => f.factor_type === 'totp' && f.status === 'verified');

                if (hasVerifiedTotp) {
                  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                  if (aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2') {
                    logger.info("MFA required on session initialization");
                    setMfaRequired(true);
                    setLoading(false);
                    return;
                  }
                }
                setIsAuthenticated(true);

                // Store in localStorage for quick access
                safeStorage.setItem(ADMIN_KEY, JSON.stringify(parsedAdmin));
                safeStorage.setItem(TENANT_KEY, JSON.stringify(parsedTenant));
                safeStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
                if (session.refresh_token) {
                  safeStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
                }
                safeStorage.setItem('lastTenantSlug', parsedTenant.slug);

                setLoading(false);
                return; // Success - exit early
              }
            }
          } catch (dbError) {
            logger.error('[AUTH] Failed to fetch admin/tenant from database', dbError);
          }
        }

        // PRIORITY 2: Check if we have any auth tokens or cookies before trying to verify
        const storedToken = safeStorage.getItem(ACCESS_TOKEN_KEY);
        const hasCookies = document.cookie.includes('tenant_access_token');

        // Skip verification if no auth data exists (user not logged in as tenant admin)
        if (!storedToken && !hasCookies && !session) {
          setLoading(false);
          return;
        }

        // PRIORITY 1: Try cookie-based verification first (most secure)
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';

          // Check if token is expired before attempting verification
          let tokenToUse = storedToken;
          if (storedToken) {
            try {
              const expiration = getTokenExpiration(storedToken);
              if (expiration && expiration.getTime() - Date.now() < EXPIRATION_BUFFER_MS) {
                const storedRefreshToken = safeStorage.getItem(REFRESH_TOKEN_KEY);

                if (storedRefreshToken) {
                  try {
                    const refreshResponse = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ refresh_token: storedRefreshToken }),
                    });

                    if (refreshResponse.ok) {
                      const refreshData = await refreshResponse.json();
                      // Store with fallback
                      safeStorage.setItem(ACCESS_TOKEN_KEY, refreshData.access_token);
                      safeStorage.setItem(REFRESH_TOKEN_KEY, refreshData.refresh_token);
                      tokenToUse = refreshData.access_token;
                    } else if (refreshResponse.status === 401) {
                      // Refresh token is invalid - clear everything
                      logger.warn('[AUTH] Refresh token invalid during init - clearing state');
                      clearAuthState();
                      safeStorage.removeItem(ACCESS_TOKEN_KEY);
                      safeStorage.removeItem(REFRESH_TOKEN_KEY);
                      setLoading(false);
                      return;
                    }
                  } catch {
                    // Silent catch for network errors, but still clear if 401
                  }
                }
              }
            } catch {
              // Silent catch
            }
          }

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          // Include Authorization header if token exists
          if (tokenToUse) {
            headers['Authorization'] = `Bearer ${tokenToUse}`;
          }

          const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
            method: 'GET',
            credentials: 'include', // Include cookies
            headers,
          });

          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();

            // Set state from verified cookie data
            if (verifyData.admin) {
              parsedAdmin = {
                ...verifyData.admin,
                userId: verifyData.admin.userId || verifyData.user?.id || verifyData.admin.id,
              };
              setAdmin(parsedAdmin);
            }
            if (verifyData.tenant) {
              parsedTenant = verifyData.tenant;
              setTenant(verifyData.tenant);
            }

            // Store non-sensitive data in localStorage for quick access
            if (verifyData.admin) {
              safeStorage.setItem(ADMIN_KEY, JSON.stringify(verifyData.admin));
            }
            if (verifyData.tenant) {
              safeStorage.setItem(TENANT_KEY, JSON.stringify(verifyData.tenant));
            }

            setIsAuthenticated(true);
            setLoading(false);
            return; // Success - exit early
          } else {

            // Handle 401 Unauthorized - invalid or expired token
            if (verifyResponse.status === 401) {
              // Clear auth state and redirect to login
              clearAuthState();
              setLoading(false);
              redirectToLoginExpired();

              return;
            }

            // If 403 "No tenant access found", clear stale localStorage data
            if (verifyResponse.status === 403) {
              const errorData = await verifyResponse.json().catch((e) => { logger.warn('[TenantAdminAuth] Failed to parse verify response', { error: e }); return {}; });
              if (errorData.error === 'No tenant access found') {
                clearAuthState();
                setLoading(false);
                return;
              }
            }
          }
        } catch (cookieError) {
          // Check if this is a 401 authentication error
          const is401Error = cookieError instanceof Response && cookieError.status === 401;
          const hasAuthErrorMessage = cookieError instanceof Error && (
            cookieError.message.includes('401') ||
            cookieError.message.includes('Unauthorized') ||
            cookieError.message.includes('Invalid or expired token') ||
            cookieError.message.includes('Auth session missing')
          );

          // If it's an auth error (401), clear all state including localStorage
          if (is401Error || hasAuthErrorMessage) {
            // Clear ALL stored auth data
            safeStorage.removeItem(ADMIN_KEY);
            safeStorage.removeItem(TENANT_KEY);
            safeStorage.removeItem(ACCESS_TOKEN_KEY);
            safeStorage.removeItem(REFRESH_TOKEN_KEY);
            safeStorage.removeItem('lastTenantSlug');

            clearAuthState();
            setLoading(false);

            logger.warn('[AUTH] Session expired - cleared all stored credentials');
            redirectToLoginExpired();
            return;
          }

          // For non-auth errors (network issues, etc), we can try localStorage fallback
          logger.warn('[AUTH] Cookie verification failed, falling back to localStorage', {
            error: cookieError instanceof Error ? cookieError.message : String(cookieError)
          });
        }

        // PRIORITY 2: Fallback to localStorage (for backwards compatibility)
        const storedAdmin = safeStorage.getItem(ADMIN_KEY);
        const storedTenant = safeStorage.getItem(TENANT_KEY);

        if (!storedAdmin || !storedTenant) {
          // No stored data = not logged in
          // CRITICAL: Clear auth state to ensure redirect works
          setAdmin(null);
          setTenant(null);
          setToken(null);
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        // Parse stored data safely
        try {
          parsedAdmin = JSON.parse(storedAdmin);
        } catch {
          clearAuthState();
          setLoading(false);
          return;
        }
        try {
          parsedTenant = JSON.parse(storedTenant);
        } catch {
          clearAuthState();
          setLoading(false);
          return;
        }

        // Get current tenant slug from URL
        const currentPath = window.location.pathname;
        const urlTenantSlug = currentPath.split('/')[1];

        // Validate tenant slug matches URL
        if (urlTenantSlug && parsedTenant.slug !== urlTenantSlug) {
          clearAuthState();
          setLoading(false);
          return;
        }

        // Ensure tenant has limits and usage (fallback to defaults if missing)
        const tenantWithDefaults = {
          ...parsedTenant,
          limits: parsedTenant.limits || {
            customers: 50,
            menus: 3,
            products: 100,
            locations: 2,
            users: 3,
          },
          usage: parsedTenant.usage || {
            customers: 0,
            menus: 0,
            products: 0,
            locations: 0,
            users: 0,
          },
        };

        // Set state from localStorage (for quick UI rendering)
        setAdmin(parsedAdmin);
        setTenant(tenantWithDefaults);
        // Sync lastTenantSlug
        safeStorage.setItem('lastTenantSlug', tenantWithDefaults.slug);

        // CRITICAL: Set authenticated to true immediately with localStorage data
        // Use synchronous flag to prevent loading state clearing before auth state updates
        setIsAuthenticated(true);

        // CRITICAL FIX: Set loading=false immediately to unblock UI
        // The optional verification below should NOT block the dashboard from rendering
        setLoading(false);

        // Verify authentication via API (cookies sent automatically)
        // This is now optional and runs in background - if it fails, we already have localStorage auth
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';

        try {
          const { response: verifyResponse } = await resilientFetch(
            `${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`,
            {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 5000,
              retryConfig: {
                maxRetries: 1,
                initialDelay: 500,
              },
            }
          );

          // If 401, clear localStorage and state
          if (verifyResponse.status === 401) {
            safeStorage.removeItem(ADMIN_KEY);
            safeStorage.removeItem(TENANT_KEY);
            safeStorage.removeItem(ACCESS_TOKEN_KEY);
            safeStorage.removeItem(REFRESH_TOKEN_KEY);
            safeStorage.removeItem('lastTenantSlug');

            clearAuthState();
            setLoading(false);

            logger.warn('[AUTH] Background verification failed with 401 - cleared credentials');
            redirectToLoginExpired();
            return;
          }

          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();

            // Update state from verification response (more up-to-date than localStorage)
            if (verifyData.admin) setAdmin(verifyData.admin);
            if (verifyData.tenant) setTenant(verifyData.tenant);

            // For backwards compatibility, set token state (but don't store in localStorage)
            if (verifyData.access_token) {
              setAccessToken(verifyData.access_token);
              setToken(verifyData.access_token);
            }
          }
        } catch (verifyError: unknown) {
          // Check if it's a 401 error
          if (verifyError instanceof Response && verifyError.status === 401) {
            safeStorage.removeItem(ADMIN_KEY);
            safeStorage.removeItem(TENANT_KEY);
            safeStorage.removeItem(ACCESS_TOKEN_KEY);
            safeStorage.removeItem(REFRESH_TOKEN_KEY);
            safeStorage.removeItem('lastTenantSlug');

            clearAuthState();
            setLoading(false);

            logger.warn('[AUTH] Background verification error 401 - cleared credentials');
            redirectToLoginExpired();
            return;
          }

          // For other errors, just log (we already have localStorage auth)
          logger.debug('[AUTH] Background verification failed (non-auth error)', {
            error: verifyError instanceof Error ? verifyError.message : String(verifyError)
          });
        }

        logger.debug('[AUTH INIT] 🎉 Authentication complete');
      } catch (error: unknown) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error('[AUTH] Initialization error', errorObj, { component: 'TenantAdminAuthContext' });
        clearAuthState();
      } finally {
        // Note: setLoading(false) is already called in success/error paths above
        // This finally block exists only for safety cleanup
      }
    };

    // Safety timeout: force loading to false after 12 seconds
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      setInitialized(true);
    }, LOADING_TIMEOUT_MS);

    initializeAuth().finally(() => {
      clearTimeout(safetyTimeout);
      setInitialized(true);
    });

    // Cleanup timeout on unmount
    return () => {
      clearTimeout(safetyTimeout);
    };
    // Mount-only: initializeAuth captures refs, auth helpers, and location from closure.
    // Re-running on every dependency change would re-trigger the full auth flow on every
    // route navigation, causing login loops and session thrashing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic token validation - acts as a safety net alongside the visibility-aware timer.
  // The primary refresh mechanism is the createRefreshTimer (handles visibility + sleep detection).
  // This interval provides a fallback in case the timer misses (e.g., long-running tabs).
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const validateToken = async () => {
      try {
        if (tokenNeedsRefresh(token, REFRESH_BUFFER_MS)) {
          logger.debug('[AUTH] Periodic check: token expiring soon, refreshing proactively');
          await refreshAuthToken();
        }
      } catch (error) {
        logger.error('[AUTH] Periodic token validation failed', error instanceof Error ? error : new Error(String(error)), { component: 'TenantAdminAuthContext' });
      }
    };

    // Initial check
    validateToken();

    // Check every 2 minutes as a safety net (primary mechanism is visibility-aware timer)
    const interval = setInterval(validateToken, 120000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshAuthToken is a stable async function using refs; adding it would cause re-subscription loops
  }, [isAuthenticated, token]);

  // Track if a refresh is already in progress to prevent race conditions
  const isRefreshingRef = useRef(false);
  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

  const refreshAuthToken = async (): Promise<boolean> => {
    // STEP 1: Get the current refresh token
    const currentRefreshToken = refreshToken || safeStorage.getItem(REFRESH_TOKEN_KEY);

    // STEP 2: Validate refresh token exists and is not empty/invalid
    if (!isValidRefreshToken(currentRefreshToken)) {
      logger.warn('[AUTH] Cannot refresh token - no valid refresh token available');
      clearAuthState();
      redirectToLoginExpired();
      return false;
    }

    // STEP 3: Check if refresh is already in progress (prevent race conditions)
    if (isRefreshingRef.current && refreshPromiseRef.current) {
      logger.debug('[AUTH] Refresh already in progress, waiting for result');
      return refreshPromiseRef.current;
    }

    isRefreshingRef.current = true;

    const doRefresh = async (): Promise<boolean> => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';

        // STEP 4: Attempt to refresh the session via edge function
        const { response } = await resilientFetch(
          `${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: currentRefreshToken }),
            credentials: 'include',
            timeout: 15000,
            retryConfig: {
              maxRetries: 2,
              initialDelay: 500,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();

          // STEP 5: Update tokens on successful refresh
          setAccessToken(data.access_token);
          setToken(data.access_token);
          setRefreshToken(data.refresh_token);

          safeStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
          safeStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);

          // Sync with Supabase client for RLS to work properly
          try {
            await supabase.auth.setSession({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
            });
          } catch (syncError) {
            logger.warn('[AUTH] Failed to sync session with Supabase client', syncError);
          }

          // Setup new proactive refresh timer
          setupRefreshTimer(data.access_token);

          logger.debug('[AUTH] Token refresh successful');
          return true;
        }

        // Handle specific error cases
        const errorData = await response.json().catch((e) => { logger.warn('[TenantAdminAuth] Failed to parse refresh response', { error: e }); return {}; });

        if (response.status === 401) {
          // 401 is expected when using Supabase native auth (vs custom tenant sessions)
          // Don't log as error since we have a fallback - log as debug instead
          logger.debug('[AUTH] Edge function refresh returned 401, attempting Supabase native refresh fallback', { 
            reason: errorData?.reason 
          });

          try {
            const { data: supabaseRefreshData, error: supabaseRefreshError } = await supabase.auth.refreshSession({
              refresh_token: currentRefreshToken,
            });

            if (!supabaseRefreshError && supabaseRefreshData.session) {
              setAccessToken(supabaseRefreshData.session.access_token);
              setToken(supabaseRefreshData.session.access_token);
              setRefreshToken(supabaseRefreshData.session.refresh_token);

              safeStorage.setItem(ACCESS_TOKEN_KEY, supabaseRefreshData.session.access_token);
              safeStorage.setItem(REFRESH_TOKEN_KEY, supabaseRefreshData.session.refresh_token);

              setupRefreshTimer(supabaseRefreshData.session.access_token);
              logger.debug('[AUTH] Supabase native refresh successful');
              return true;
            }
          } catch (fallbackError) {
            logger.error('[AUTH] Supabase native refresh also failed', fallbackError);
          }

          // All refresh attempts failed, clear auth state and redirect
          clearAuthState();
          redirectToLoginExpired();
          return false;
        }

        return false;
      } catch (error) {
        logger.error('[AUTH] Token refresh exception', error);
        return false;
      } finally {
        isRefreshingRef.current = false;
        refreshPromiseRef.current = null;
      }
    };

    refreshPromiseRef.current = doRefresh();
    return refreshPromiseRef.current;
  };

  const setupRefreshTimer = (token: string) => {
    // Clean up any previous timer handle (visibility-aware timer)
    if (refreshTimerHandleRef.current) {
      refreshTimerHandleRef.current.cleanup();
      refreshTimerHandleRef.current = null;
    }

    // Also clear legacy timeout refs if still active
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    // Create a robust, visibility-aware refresh timer
    // This handles: tab backgrounding, wake-from-sleep, and regular scheduling
    refreshTimerHandleRef.current = createRefreshTimer({
      token,
      onRefresh: refreshAuthToken,
      onWarning: (secondsLeft) => {
        setSecondsUntilLogout(secondsLeft > 0 ? secondsLeft : 60);
        setShowTimeoutWarning(true);
      },
      bufferMs: REFRESH_BUFFER_MS,
      warningBufferMs: 60 * 1000,
    });
  };

  const verifyMfa = async (code: string) => {
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;

      const totpFactor = factors.totp.find(f => f.status === 'verified');
      if (!totpFactor) throw new Error("No verified TOTP factor found");

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.id,
        code
      });
      if (verifyError) throw verifyError;

      // MFA successful
      setMfaRequired(false);
      setIsAuthenticated(true);

      // Refresh session to get AAL2
      await supabase.auth.refreshSession();

      logger.info("MFA verification successful");
    } catch (error: unknown) {
      logger.error("MFA verification failed", error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  };

  const login = async (email: string, password: string, tenantSlug: string, rememberMe: boolean = false) => {
    const flowId = authFlowLogger.startFlow(AuthAction.LOGIN, { email, tenantSlug });

    try {
      authFlowLogger.logStep(flowId, AuthFlowStep.VALIDATE_INPUT);

      // Session fixation protection: Clear all pre-auth session data
      // This prevents an attacker from setting tokens before the user authenticates
      clearPreAuthSessionData('tenant_admin');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
      const url = `${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`;

      authFlowLogger.logStep(flowId, AuthFlowStep.NETWORK_REQUEST);
      authFlowLogger.logFetchAttempt(flowId, url, 1);

      const { response, category } = await resilientFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, tenantSlug, rememberMe }),
        timeout: 30000, // 30 seconds for login
        retryConfig: {
          maxRetries: 3,
          initialDelay: 1000,
        },
        onRetry: (attempt, error) => {
          const delay = 1000 * Math.pow(2, attempt - 1);
          authFlowLogger.logFetchRetry(flowId, url, attempt, error, Math.min(delay, 10000));
        },
        onError: (errorCategory) => {
          authFlowLogger.logFetchFailure(flowId, url, new Error(getErrorMessage(errorCategory)), errorCategory, 0);
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Login failed" }));
        const error: AuthError = new Error(errorData.error || "Login failed");
        error.status = response.status;

        // Extract retry-after header if present
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) {
          (error as AuthError & { retryAfter?: string }).retryAfter = retryAfter;
        }

        authFlowLogger.failFlow(flowId, error, category);
        throw error;
      }

      const fetchStartTime = performance.now();
      authFlowLogger.logFetchSuccess(flowId, url, response.status, performance.now() - fetchStartTime);
      authFlowLogger.logStep(flowId, AuthFlowStep.PARSE_RESPONSE);

      const data = await response.json();

      // Ensure tenant has limits and usage (fallback to defaults if missing)
      const tenantWithDefaults = {
        ...data.tenant,
        limits: data.tenant.limits || {
          customers: 50,
          menus: 3,
          products: 100,
          locations: 2,
          users: 3,
        },
        usage: data.tenant.usage || {
          customers: 0,
          menus: 0,
          products: 0,
          locations: 0,
          users: 0,
        },
      };

      // Sync tokens with Supabase client for RLS
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      setToken(data.access_token); // Backwards compatibility
      setAdmin(data.admin);
      setTenant(tenantWithDefaults);

      // Check for MFA
      const factors = data.session?.user?.factors ?? [];
      const hasVerifiedTotp = factors.some((f: { factor_type: string; status: string }) => f.factor_type === 'totp' && f.status === 'verified');

      if (hasVerifiedTotp) {
        logger.info("MFA required for user");
        setMfaRequired(true);
        // Do NOT set isAuthenticated(true) yet
      } else {
        setIsAuthenticated(true);
      }

      // Store tokens with mobile fallback
      // Note: With httpOnly cookies, these are not the primary auth mechanism
      safeStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      safeStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      safeStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
      safeStorage.setItem(TENANT_KEY, JSON.stringify(tenantWithDefaults));

      // Store user ID for encryption
      if (data.admin?.id) {
        safeStorage.setItem('floraiq_user_id', data.admin.id);
      }

      // Initialize encryption with user's password
      try {
        if (data.admin?.id) {
          await clientEncryption.initialize(password, data.admin.id);
          logger.debug('Encryption initialized successfully', { component: 'TenantAdminAuthContext' });
        }
      } catch (encryptionError) {
        // Log but don't block login - encryption is optional for now
        logger.warn('Encryption initialization failed', encryptionError instanceof Error ? encryptionError : new Error(String(encryptionError)), { component: 'TenantAdminAuthContext' });
      }

      // Setup proactive refresh timer
      setupRefreshTimer(data.access_token);

      authFlowLogger.logStep(flowId, AuthFlowStep.COMPLETE);
      authFlowLogger.completeFlow(flowId, { tenantId: data.tenant?.id });
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const category = errorObj.message.includes('Network')
        ? ErrorCategory.NETWORK
        : ErrorCategory.AUTH;
      authFlowLogger.failFlow(flowId, errorObj, category);
      logger.error("Login error", errorObj, { component: 'TenantAdminAuthContext' });

      // Show user-friendly error messages
      const { showErrorToast } = await import('@/lib/toastUtils');
      const { emitAuthError } = await import('@/hooks/useAuthError');

      let errorMessage = 'Login failed. Please try again.';
      let errorCode = 'LOGIN_FAILED';

      if (errorObj.message?.includes('Invalid email or password') || ('status' in errorObj && errorObj.status === 401)) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        errorCode = 'INVALID_CREDENTIALS';
      } else if (errorObj.message?.includes('network') || errorObj.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
        errorCode = 'NETWORK_ERROR';
      } else if (errorObj.message?.includes('timeout') || errorObj.message?.includes('timed out')) {
        errorMessage = 'Request timed out. Please try again.';
        errorCode = 'TIMEOUT';
      } else if ('status' in errorObj && errorObj.status === 403) {
        errorMessage = 'Access denied. Your account may be suspended. Please contact support.';
        errorCode = 'ACCESS_DENIED';
      } else if ('status' in errorObj && errorObj.status === 429) {
        const retryAfter = (errorObj as AuthError & { retryAfter?: string }).retryAfter;
        errorMessage = 'Account locked due to too many attempts.';
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds)) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            errorMessage += ` Try again in ${minutes}:${remainingSeconds.toString().padStart(2, '0')}.`;
          } else {
            errorMessage += ' Please wait a few minutes and try again.';
          }
        } else {
          errorMessage += ' Please wait a few minutes and try again.';
        }
        errorCode = 'RATE_LIMITED';
      } else if ('status' in errorObj && typeof errorObj.status === 'number' && errorObj.status >= 500) {
        errorMessage = 'Server error. We\'re working on it. Please try again in a few minutes.';
        errorCode = 'SERVER_ERROR';
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }

      showErrorToast(errorMessage, `Error code: ${errorCode}`);
      emitAuthError({ message: errorMessage, code: errorCode });

      throw error;
    }
  };



  // Listen for auth events from other tabs
  useEffect(() => {
    const channel = new BroadcastChannel('tenant_auth_channel');

    channel.onmessage = (event) => {
      if (event.data.type === 'LOGOUT') {
        logger.info('[AUTH] Received remote logout event', { component: 'TenantAdminAuthContext' });

        // Full cleanup (don't call API - already done by the tab that initiated logout)
        performFullLogout();

        // Clear context-specific React state
        clearAuthState();

        toast.info("You have been logged out from another tab.", {
          duration: 5000,
        });

        // Redirect to login
        if (tenant?.slug) {
          navigate(`/${tenant.slug}/admin/login`, { replace: true });
        } else if (window.location.pathname.includes('/admin')) {
          navigate('/');
        }
      }
    };

    return () => {
      channel.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearAuthState and performFullLogout are stable functions; adding them won't change behavior but would cause unnecessary re-subscriptions
  }, [tenant?.slug, navigate]);

  const logout = async () => {
    // Session fixation protection: Invalidate session nonce on logout
    // Prevents the old session marker from being reused
    invalidateSessionNonce();

    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Notify other tabs immediately
    broadcastLogout('tenant_auth_channel');

    try {
      // Call logout endpoint to clear cookies
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
      await resilientFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=logout`, {
        method: "POST",
        credentials: 'include',
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000,
        retryConfig: {
          maxRetries: 1,
          initialDelay: 500,
        },
      });
    } catch (error) {
      logger.error("[AUTH] Logout error", error);
    } finally {
      // Perform complete state cleanup (encryption, Supabase, storage, query cache)
      await performFullLogout();

      // Also clear context-specific React state
      clearAuthState();
    }
  };

  // Handle signup success (called from SignUpPage after successful signup)
  const handleSignupSuccess = async (signupResult: SignupResult) => {
    // No tokens to store! Cookies already set by edge function
    setAdmin(signupResult.user);
    setTenant(signupResult.tenant);
    setIsAuthenticated(true);

    // Store non-sensitive data for quick access
    safeStorage.setItem(ADMIN_KEY, JSON.stringify(signupResult.user));
    safeStorage.setItem(TENANT_KEY, JSON.stringify(signupResult.tenant));

    logger.info('[AUTH] Signup success, authenticated via cookies', {
      userId: signupResult.user.id,
      tenantSlug: signupResult.tenant.slug,
    });

    // Auto-approve tenant and tenant user records if feature flag is active (non-blocking)
    try {
      if (shouldAutoApprove('SIGNUPS')) {
        const tId = signupResult.tenant.id;
        const uId = signupResult.user.id;
        // Mark tenant as approved/active if a status field exists
        await supabase.from('tenants').update({ status: 'approved', onboarded: true }).eq('id', tId);
        // Mark tenant user record as approved
        const updateUser: Record<string, unknown> = { status: 'approved' };
        if (flags.AUTO_BYPASS_EMAIL_VERIFICATION) {
          updateUser.email_verified = true;
        }
        await supabase.from('tenant_users').update(updateUser).eq('tenant_id', tId).eq('user_id', uId);
        logger.info('[AUTH] Auto-approve applied to signup records');
      }
    } catch (e) {
      logger.warn('[AUTH] Auto-approve (signup) update failed (non-blocking)', e);
    }
  };



  // Tenant mismatch handler - called when URL tenant doesn't match context tenant
  const handleTenantMismatch = useCallback((urlSlug: string, currentSlug: string) => {
    logger.info(`[TenantAdmin] Tenant mismatch: URL="${urlSlug}" vs Context="${currentSlug}". Logging out.`);
    logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- logout is a stable function defined in the same context
  }, []);

  // Use the centralized tenant route guard for detecting tenant changes
  // This only triggers on tenant-admin routes (/:tenantSlug/admin/*), not global routes
  useTenantRouteGuard({
    currentTenantSlug: tenant?.slug,
    onTenantMismatch: handleTenantMismatch,
    enabled: !!tenant, // Only enable when we have a tenant context
    debounceMs: 150, // Small debounce to allow for route transitions
  });

  // Real-time subscription for tenant subscription changes
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`tenant-subscription-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${tenant.id}`,
        },
        async (payload) => {
          const updatedTenant = payload.new as Tenant;

          // Check if subscription plan or status changed
          if (
            updatedTenant.subscription_plan !== tenant.subscription_plan ||
            updatedTenant.subscription_status !== tenant.subscription_status
          ) {
            // Refresh tenant data
            const storedAdmin = safeStorage.getItem(ADMIN_KEY);
            if (storedAdmin) {
              try {
                JSON.parse(storedAdmin);
              } catch (parseError) {
                logger.error('Failed to parse stored admin data', parseError);
                return;
              }
              try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
                const { response } = await resilientFetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
                  method: "GET",
                  headers: {
                    "Authorization": `Bearer ${accessToken || safeStorage.getItem(ACCESS_TOKEN_KEY)}`,
                    "Content-Type": "application/json",
                  },
                  credentials: 'include',
                  timeout: 10000,
                  retryConfig: {
                    maxRetries: 1,
                    initialDelay: 500,
                  },
                });

                if (response.ok) {
                  const data = await response.json();
                  const tenantWithDefaults = {
                    ...data.tenant,
                    limits: data.tenant.limits || {
                      customers: 50,
                      menus: 3,
                      products: 100,
                      locations: 2,
                      users: 3,
                    },
                    usage: data.tenant.usage || {
                      customers: 0,
                      menus: 0,
                      products: 0,
                      locations: 0,
                      users: 0,
                    },
                  };
                  setTenant(tenantWithDefaults);
                  safeStorage.setItem(TENANT_KEY, JSON.stringify(tenantWithDefaults));

                  // Log subscription change
                  logger.info('Subscription plan changed', {
                    from: tenant.subscription_plan,
                    to: updatedTenant.subscription_plan,
                    component: 'TenantAdminAuthContext'
                  });
                }
              } catch (error) {
                logger.error('Failed to refresh tenant data after subscription change', error);
              }
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to tenant subscription changes', { tenantId: tenant.id, component: 'TenantAdminAuthContext' });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, tenant?.subscription_plan, tenant?.subscription_status, accessToken]);

  // Proactive token refresh effect - sets up visibility-aware timer
  useEffect(() => {
    if (accessToken) {
      setupRefreshTimer(accessToken);
    }

    return () => {
      if (refreshTimerHandleRef.current) {
        refreshTimerHandleRef.current.cleanup();
        refreshTimerHandleRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setupRefreshTimer is a stable function using refs internally
  }, [accessToken]);

  // Refresh tenant data from database
  const refreshTenant = useCallback(async () => {
    if (!tenant?.id) {
      logger.warn('[AUTH] Cannot refresh tenant - no tenant ID');
      return;
    }

    try {
      logger.info('[AUTH] Refreshing tenant data from database', { tenantId: tenant.id });
      const { data: freshTenant, error } = await supabase
        .from('tenants')
        .select('id, business_name, slug, subscription_plan, subscription_status, trial_ends_at, next_billing_date, grace_period_ends_at, payment_method_added, mrr, onboarding_completed, business_tier, created_at, is_free_tier, credits_enabled, limits, usage, features')
        .eq('id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('[AUTH] Failed to refresh tenant', error);
        return;
      }

      if (freshTenant) {
        const updatedTenant = freshTenant as unknown as Tenant;
        setTenant(updatedTenant);
        safeStorage.setItem(TENANT_KEY, JSON.stringify(updatedTenant));
        logger.info('[AUTH] Tenant data refreshed', {
          tenantId: updatedTenant.id,
          paymentMethodAdded: updatedTenant.payment_method_added,
          subscriptionStatus: updatedTenant.subscription_status
        });
      }
    } catch (error) {
      logger.error('[AUTH] Error refreshing tenant', error);
    }
  }, [tenant?.id]);

  // AUTO-POLL: Check for subscription changes every 30 seconds
  // This catches webhook-triggered updates that the frontend wouldn't otherwise know about
  useEffect(() => {
    if (!isAuthenticated || !tenant?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data: freshTenant, error } = await supabase
          .from('tenants')
          .select('subscription_status, subscription_plan, is_free_tier, credits_enabled, grace_period_ends_at, trial_ends_at')
          .eq('id', tenant.id)
          .maybeSingle();

        if (error || !freshTenant) return;

        // Only trigger full refresh if subscription state changed
        const subscriptionChanged =
          freshTenant.subscription_status !== tenant.subscription_status ||
          freshTenant.subscription_plan !== tenant.subscription_plan ||
          freshTenant.is_free_tier !== tenant.is_free_tier ||
          freshTenant.credits_enabled !== tenant.credits_enabled;

        if (subscriptionChanged) {
          logger.info('[AUTH_POLL] Subscription state changed, triggering refresh', {
            oldStatus: tenant.subscription_status,
            newStatus: freshTenant.subscription_status,
            oldPlan: tenant.subscription_plan,
            newPlan: freshTenant.subscription_plan,
          });
          await refreshTenant();
        }
      } catch (err) {
        // Silent fail - polling is best-effort
        logger.warn('[AUTH_POLL] Polling failed', err);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(pollInterval);
  }, [isAuthenticated, tenant?.id, tenant?.subscription_status, tenant?.subscription_plan, tenant?.is_free_tier, tenant?.credits_enabled, refreshTenant]);

  return (
    <TenantAdminAuthContext.Provider value={{
      admin,
      tenant,
      tenantSlug,
      token,
      accessToken,
      refreshToken: refreshToken,
      isAuthenticated,
      connectionStatus,
      loading,
      initialized,
      login,
      logout,
      refreshAuthToken,
      refreshTenant,
      handleSignupSuccess,
      mfaRequired,
      verifyMfa,
    }}>
      {children}
      <SessionTimeoutWarning
        open={showTimeoutWarning}
        secondsRemaining={secondsUntilLogout}
        onExtendSession={refreshAuthToken}
        onLogout={logout}
      />
      {/* Legacy onboarding dialog - kept for fallback if setup wizard is bypassed */}
      {onboardingOpen && !location.pathname.includes('/setup-wizard') && (
        <OnboardingWizard
          open={onboardingOpen}
          onOpenChange={setOnboardingOpen}
        />
      )}
      {/* Free Tier Onboarding - Only shows for free tier users after initial onboarding */}
      <FreeTierOnboardingFlow />
    </TenantAdminAuthContext.Provider>
  );
};

export const useTenantAdminAuth = () => {
  const context = useContext(TenantAdminAuthContext);
  if (context === undefined) {
    throw new Error("useTenantAdminAuth must be used within a TenantAdminAuthProvider");
  }
  return context;
};

