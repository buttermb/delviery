import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTokenExpiration } from "@/lib/auth/jwt";
import { logger } from "@/utils/logger";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { SessionTimeoutWarning } from "@/components/auth/SessionTimeoutWarning";

interface TenantAdmin {
  id: string;
  email: string;
  name?: string;
  role: string;
  tenant_id: string;
}

interface Tenant {
  id: string;
  business_name: string;
  slug: string;
  subscription_plan: string;
  subscription_status: string;
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

interface TenantAdminAuthContextType {
  admin: TenantAdmin | null;
  tenant: Tenant | null;
  token: string | null; // For backwards compatibility
  accessToken: string | null; // For backwards compatibility
  refreshToken: string | null; // For backwards compatibility
  isAuthenticated: boolean; // New: cookie-based authentication state
  loading: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthToken: () => Promise<void>;
  handleSignupSuccess?: (signupResult: any) => Promise<void>; // For signup flow
}

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get bound fetch (prevents "Illegal invocation" error)
const getSafeFetch = () => (typeof window !== 'undefined' ? window.fetch.bind(window) : fetch);

// Validate environment variables
const validateEnvironment = (): { valid: boolean; error?: string } => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
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

export const TenantAdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<TenantAdmin | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null); // For backwards compatibility
  const [accessToken, setAccessToken] = useState<string | null>(null); // For backwards compatibility
  const [refreshToken, setRefreshToken] = useState<string | null>(null); // For backwards compatibility
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Cookie-based auth state
  const [loading, setLoading] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [secondsUntilLogout, setSecondsUntilLogout] = useState(60);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Validate environment on mount
  useEffect(() => {
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
      logger.error('Environment validation failed:', envCheck.error);
      console.error('[TenantAdminAuth] Configuration error:', envCheck.error);
      setLoading(false);
    }
  }, []);

  // Sync with Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.access_token) {
          // Update tokens when Supabase refreshes them
          const currentAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
          if (currentAccessToken !== session.access_token) {
            setAccessToken(session.access_token);
            setToken(session.access_token);
            localStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
            if (session.refresh_token) {
              setRefreshToken(session.refresh_token);
              localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
            }
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Initialize authentication (cookie-based)
  useEffect(() => {
    const LOADING_TIMEOUT_MS = 12000; // 12-second safety timeout
    const startTime = Date.now();
    
    const initializeAuth = async () => {
      // Declare variables outside try block for catch block access
      let parsedAdmin: TenantAdmin | null = null;
      let parsedTenant: Tenant | null = null;
      
      try {
        // Quick check: Do we have user/tenant data in localStorage?
        const storedAdmin = localStorage.getItem(ADMIN_KEY);
        const storedTenant = localStorage.getItem(TENANT_KEY);
        
        if (!storedAdmin || !storedTenant) {
          // No stored data = not logged in
          logger.debug('[AUTH] No stored user/tenant data, not authenticated');
          setLoading(false);
          return;
        }

        // Parse stored data
        parsedAdmin = JSON.parse(storedAdmin);
        parsedTenant = JSON.parse(storedTenant);
        
        // Get current tenant slug from URL
        const currentPath = window.location.pathname;
        const urlTenantSlug = currentPath.split('/')[1];
        
        // Validate tenant slug matches URL
        if (urlTenantSlug && parsedTenant.slug !== urlTenantSlug) {
          logger.debug(`[AUTH] Tenant mismatch: stored=${parsedTenant.slug}, url=${urlTenantSlug}. Clearing auth.`);
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
        localStorage.setItem('lastTenantSlug', tenantWithDefaults.slug);
        
        // Verify authentication via API (cookies sent automatically)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const verifyResponse = await getSafeFetch()(
          `${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`,
          {
            method: 'GET',
            credentials: 'include', // ⭐ Send httpOnly cookies
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          
          // Update state from verification response (more up-to-date)
          setAdmin(verifyData.admin || parsedAdmin);
          setTenant(verifyData.tenant || tenantWithDefaults);
          setIsAuthenticated(true);
          
          // For backwards compatibility, set token state (but don't store in localStorage)
          if (verifyData.access_token) {
            setAccessToken(verifyData.access_token);
            setToken(verifyData.access_token);
          }
          
          logger.info('[AUTH] Authenticated via cookies', {
            userId: verifyData.admin?.id,
            tenantSlug: verifyData.tenant?.slug,
          });
        } else {
          // Verification failed - clear everything
          logger.warn('[AUTH] Cookie verification failed, clearing auth state');
          clearAuthState();
        }
      } catch (error: any) {
        // Special handling for "Failed to fetch" - edge function might be down
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
          logger.warn('[AUTH] Verify endpoint unavailable, using localStorage-only auth', {
            error: error.message,
            hasAdmin: !!parsedAdmin,
            hasTenant: !!parsedTenant,
          });
          
          // Trust localStorage data if verify endpoint is down
          setIsAuthenticated(true);
          logger.info('[AUTH] Authenticated via localStorage (verify endpoint unavailable)');
        } else {
          logger.error('[AUTH] Initialization error', error);
          clearAuthState();
        }
      } finally {
        setLoading(false);
      }
    };

    // Safety timeout: force loading to false after 12 seconds
    const safetyTimeout = setTimeout(() => {
      const duration = Date.now() - startTime;
      logger.warn(`[AUTH] Initialization timeout after ${duration}ms - forcing loading to false`);
      setLoading(false);
    }, LOADING_TIMEOUT_MS);

    initializeAuth().finally(() => {
      clearTimeout(safetyTimeout);
    });
    
    // Cleanup timeout on unmount
    return () => {
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Helper function to clear auth state
  const clearAuthState = () => {
    setAdmin(null);
    setTenant(null);
    setToken(null);
    setAccessToken(null);
    setRefreshToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem(ADMIN_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem('lastTenantSlug'); // Clear tenant slug cache
    // Note: We don't remove ACCESS_TOKEN_KEY/REFRESH_TOKEN_KEY here
    // as they may not exist if using cookies
  };

  const verifyToken = async (tokenToVerify: string, retryCount = 0): Promise<boolean> => {
    const maxRetries = 1; // Fail-fast: only 1 retry
    const VERIFY_TIMEOUT_MS = 8000; // 8-second timeout (fail-fast approach)
    
    try {
      const envCheck = validateEnvironment();
      if (!envCheck.valid) {
        throw new Error(envCheck.error || 'Environment configuration error');
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Check if token will expire soon (within 60 seconds)
      const tokenExpiration = getTokenExpiration(tokenToVerify);
      if (tokenExpiration && tokenExpiration.getTime() - Date.now() < EXPIRATION_BUFFER_MS) {
        logger.debug("Token expires soon, attempting refresh before verification");
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (storedRefreshToken) {
          await refreshAuthToken();
          const newToken = localStorage.getItem(ACCESS_TOKEN_KEY);
          if (newToken && newToken !== tokenToVerify) {
            tokenToVerify = newToken;
          }
        }
      }
      
      // Create AbortController for timeout (8 seconds - fail-fast approach)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        logger.warn(`Token verification timed out after ${VERIFY_TIMEOUT_MS}ms`, undefined, 'TenantAdminAuthContext');
        controller.abort();
      }, VERIFY_TIMEOUT_MS);
      
      const startTime = Date.now();
      let response: Response;
      
      try {
        // Use cookies for verification (credentials: 'include')
        // Fall back to Authorization header if token provided (backwards compatibility)
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        
        // Only add Authorization header if token is provided (for backwards compatibility)
        if (tokenToVerify) {
          headers["Authorization"] = `Bearer ${tokenToVerify}`;
        }
        
        response = await getSafeFetch()(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
          method: "GET",
          credentials: 'include', // ⭐ Send httpOnly cookies
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        const duration = Date.now() - startTime;
        logger.debug(`Token verification completed in ${duration}ms`, undefined, 'TenantAdminAuthContext');
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        
        if (fetchError.name === 'AbortError') {
          logger.warn(`Token verification aborted after ${duration}ms (timeout)`, fetchError, 'TenantAdminAuthContext');
          
          // Retry once if not already retried (fail-fast: max 1 retry)
          if (retryCount < maxRetries) {
            logger.debug(`Retrying token verification (attempt ${retryCount + 1}/${maxRetries + 1})`, undefined, 'TenantAdminAuthContext');
            await sleep(Math.pow(2, retryCount) * 100); // Exponential backoff: 100ms, 200ms
            return verifyToken(tokenToVerify, retryCount + 1);
          }
          
          // Clear auth state on timeout after retries exhausted
          logger.error('Token verification failed after timeout and retries', fetchError, 'TenantAdminAuthContext');
          setLoading(false);
          setToken(null);
          setAccessToken(null);
          setRefreshToken(null);
          setAdmin(null);
          setTenant(null);
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(ADMIN_KEY);
          localStorage.removeItem(TENANT_KEY);
          return false;
        }
        
        throw fetchError; // Re-throw non-abort errors
      }

      if (!response.ok) {
        // If token verification fails with 401, try to refresh
        if (response.status === 401) {
          logger.debug("Token verification failed with 401, attempting refresh");
          const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          if (storedRefreshToken) {
            try {
              const refreshResponse = await getSafeFetch()(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ refresh_token: storedRefreshToken }),
              });

              if (!refreshResponse.ok) {
                throw new Error("Token refresh failed");
              }

              const refreshData = await refreshResponse.json();
              
              // Sync refreshed tokens with Supabase client
              await supabase.auth.setSession({
                access_token: refreshData.access_token,
                refresh_token: refreshData.refresh_token,
              });
              
              setAccessToken(refreshData.access_token);
              setRefreshToken(refreshData.refresh_token);
              setToken(refreshData.access_token);
              
              localStorage.setItem(ACCESS_TOKEN_KEY, refreshData.access_token);
              localStorage.setItem(REFRESH_TOKEN_KEY, refreshData.refresh_token);
              
              // Setup proactive refresh timer with new token
              setupRefreshTimer(refreshData.access_token);
              
              setLoading(false);
              return true; // Successfully refreshed
            } catch (refreshError) {
              logger.error("Token refresh failed", refreshError);
              throw new Error("Token expired and refresh failed");
            }
          }
        }
        
        // Retry with exponential backoff (only if not already retried due to timeout)
        if (retryCount < maxRetries) {
          const backoffMs = Math.pow(2, retryCount) * 100; // 100ms, 200ms
          logger.debug(`Retrying token verification in ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries + 1})`, undefined, 'TenantAdminAuthContext');
          await sleep(backoffMs);
          return verifyToken(tokenToVerify, retryCount + 1);
        }
        
        throw new Error("Token verification failed");
      }

      const data = await response.json();
      
      if (data.admin && data.tenant) {
        // Ensure Supabase client has the session
        const currentToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        const currentRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        
        if (currentToken && currentRefreshToken) {
          await supabase.auth.setSession({
            access_token: currentToken,
            refresh_token: currentRefreshToken,
          }).catch(error => {
            logger.warn('Failed to set Supabase session during verification', error, 'TenantAdminAuthContext');
          });
        }
        
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
        
        setAdmin(data.admin);
        setTenant(tenantWithDefaults);
        setIsAuthenticated(true);
        localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
        localStorage.setItem(TENANT_KEY, JSON.stringify(tenantWithDefaults));
      }
      
      setLoading(false);
      return true;
    } catch (error) {
      logger.error("Token verification error", error);
      // Clear all auth data
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(TENANT_KEY);
      setToken(null);
      setAccessToken(null);
      setRefreshToken(null);
      setAdmin(null);
      setTenant(null);
      setIsAuthenticated(false);
      setLoading(false);
      return false;
    }
  };

  const setupRefreshTimer = (token: string) => {
    // Clear existing timers
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    // Get token expiration
    const expiration = getTokenExpiration(token);
    if (!expiration) {
      logger.warn("Could not get token expiration, skipping proactive refresh");
      return;
    }

    // Calculate time until refresh (5 minutes before expiration)
    const timeUntilRefresh = expiration.getTime() - Date.now() - REFRESH_BUFFER_MS;
    const timeUntilWarning = expiration.getTime() - Date.now() - (60 * 1000); // 1 minute before expiry
    
    if (timeUntilRefresh <= 0) {
      // Token expires very soon, refresh immediately
      logger.debug("Token expires very soon, refreshing immediately");
      refreshAuthToken();
      return;
    }

    // Set timer to show warning 1 minute before expiration
    if (timeUntilWarning > 0 && timeUntilWarning < timeUntilRefresh) {
      logger.debug(`Setting up session timeout warning in ${Math.round(timeUntilWarning / 1000)} seconds`);
      warningTimerRef.current = setTimeout(() => {
        const secondsLeft = Math.floor((expiration.getTime() - Date.now()) / 1000);
        setSecondsUntilLogout(secondsLeft > 0 ? secondsLeft : 60);
        setShowTimeoutWarning(true);
      }, timeUntilWarning);
    }

    logger.debug(`Setting up proactive token refresh in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);
    
    // Set timer to refresh token before it expires
    refreshTimerRef.current = setTimeout(() => {
      logger.debug("Proactively refreshing token before expiration");
      refreshAuthToken();
    }, timeUntilRefresh);
  };

  const login = async (email: string, password: string, tenantSlug: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Add timeout to fetch call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s for login
      
      const response = await getSafeFetch()(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, tenantSlug }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }

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
      setIsAuthenticated(true);
      
      // Store tokens in localStorage for backwards compatibility
      // Note: With httpOnly cookies, these are not the primary auth mechanism
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
      localStorage.setItem(TENANT_KEY, JSON.stringify(tenantWithDefaults));
      
      // Setup proactive refresh timer
      setupRefreshTimer(data.access_token);
    } catch (error) {
      logger.error("Login error", error);
      throw error;
    }
  };

  const logout = async () => {
    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    try {
      // Call logout endpoint to clear cookies
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      await getSafeFetch()(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=logout`, {
        method: "POST",
        credentials: 'include', // ⭐ Send cookies to be cleared
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      logger.error("[AUTH] Logout error", error);
    } finally {
      // Clear Supabase session
      await supabase.auth.signOut();
      
      // Always clear local state
      clearAuthState();
    }
  };

  // Handle signup success (called from SignUpPage after successful signup)
  const handleSignupSuccess = async (signupResult: any) => {
    // No tokens to store! Cookies already set by edge function
    setAdmin(signupResult.user);
    setTenant(signupResult.tenant);
    setIsAuthenticated(true);
    
    // Store non-sensitive data for quick access
    localStorage.setItem(ADMIN_KEY, JSON.stringify(signupResult.user));
    localStorage.setItem(TENANT_KEY, JSON.stringify(signupResult.tenant));
    
    logger.info('[AUTH] Signup success, authenticated via cookies', {
      userId: signupResult.user.id,
      tenantSlug: signupResult.tenant.slug,
    });
  };

  const refreshAuthToken = async () => {
    const currentRefreshToken = refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!currentRefreshToken) {
      logger.warn("No refresh token available");
      return;
    }
    
    try {
      logger.debug("Refreshing access token...");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Add timeout to fetch call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await getSafeFetch()(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: currentRefreshToken }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      
      // Sync refreshed tokens with Supabase client
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      setToken(data.access_token); // Backwards compatibility
      
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      
      // Setup next proactive refresh
      setupRefreshTimer(data.access_token);
      
      logger.debug("Token refreshed successfully");
    } catch (error) {
      logger.error("Token refresh error", error);
      // If refresh fails, clear everything
      logout();
    }
  };

  // Detect tenant slug changes in URL
  useEffect(() => {
    const handleTenantChange = () => {
      const currentPath = window.location.pathname;
      const urlTenantSlug = currentPath.split('/')[1];
      
      if (tenant && urlTenantSlug && tenant.slug !== urlTenantSlug) {
        logger.debug(`URL tenant changed from ${tenant.slug} to ${urlTenantSlug}. Logging out.`);
        logout();
      }
    };

    // Check on mount and when location changes
    handleTenantChange();
    
    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', handleTenantChange);
    return () => window.removeEventListener('popstate', handleTenantChange);
  }, [tenant]);

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
          const updatedTenant = payload.new as any;
          
          // Check if subscription plan or status changed
          if (
            updatedTenant.subscription_plan !== tenant.subscription_plan ||
            updatedTenant.subscription_status !== tenant.subscription_status
          ) {
            // Refresh tenant data
            const storedAdmin = localStorage.getItem(ADMIN_KEY);
            if (storedAdmin) {
              try {
                const adminData = JSON.parse(storedAdmin);
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const response = await getSafeFetch()(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
                  method: "GET",
                  headers: {
                    "Authorization": `Bearer ${accessToken || localStorage.getItem(ACCESS_TOKEN_KEY)}`,
                    "Content-Type": "application/json",
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
                  localStorage.setItem(TENANT_KEY, JSON.stringify(tenantWithDefaults));
                  
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

  // Proactive token refresh effect
  useEffect(() => {
    if (accessToken) {
      setupRefreshTimer(accessToken);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, [accessToken]);

  const handleStayLoggedIn = () => {
    setShowTimeoutWarning(false);
    refreshAuthToken();
  };

  const handleLogoutFromWarning = () => {
    setShowTimeoutWarning(false);
    logout();
  };

  return (
    <TenantAdminAuthContext.Provider value={{ 
      admin, 
      tenant, 
      token, 
      accessToken, 
      refreshToken: refreshToken, 
      isAuthenticated,
      loading, 
      login, 
      logout, 
      refreshAuthToken,
      handleSignupSuccess,
    }}>
      {children}
      <SessionTimeoutWarning
        open={showTimeoutWarning}
        onStayLoggedIn={handleStayLoggedIn}
        onLogout={handleLogoutFromWarning}
        secondsRemaining={secondsUntilLogout}
      />
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

