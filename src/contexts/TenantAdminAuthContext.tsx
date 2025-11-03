import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getTokenExpiration } from "@/lib/auth/jwt";

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
}

interface TenantAdminAuthContextType {
  admin: TenantAdmin | null;
  tenant: Tenant | null;
  token: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthToken: () => Promise<void>;
}

const TenantAdminAuthContext = createContext<TenantAdminAuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = "tenant_admin_access_token";
const REFRESH_TOKEN_KEY = "tenant_admin_refresh_token";
const ADMIN_KEY = "tenant_admin_user";
const TENANT_KEY = "tenant_data";

// Token refresh buffer (5 minutes before expiration)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;
// Token expiration safety buffer (60 seconds)
const EXPIRATION_BUFFER_MS = 60 * 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const TenantAdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<TenantAdmin | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null); // For backwards compatibility
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Initialize from localStorage
  useEffect(() => {
    const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const storedAdmin = localStorage.getItem(ADMIN_KEY);
    const storedTenant = localStorage.getItem(TENANT_KEY);

    if (storedAccessToken && storedRefreshToken && storedAdmin && storedTenant) {
      setAccessToken(storedAccessToken);
      setRefreshToken(storedRefreshToken);
      setToken(storedAccessToken);
      try {
        setAdmin(JSON.parse(storedAdmin));
        setTenant(JSON.parse(storedTenant));
        verifyToken(storedAccessToken);
      } catch (e) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(ADMIN_KEY);
        localStorage.removeItem(TENANT_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string, retryCount = 0): Promise<boolean> => {
    const maxRetries = 3;
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Check if token will expire soon (within 60 seconds)
      const tokenExpiration = getTokenExpiration(tokenToVerify);
      if (tokenExpiration && tokenExpiration.getTime() - Date.now() < EXPIRATION_BUFFER_MS) {
        console.log("Token expires soon, attempting refresh before verification");
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (storedRefreshToken) {
          await refreshAuthToken();
          const newToken = localStorage.getItem(ACCESS_TOKEN_KEY);
          if (newToken && newToken !== tokenToVerify) {
            tokenToVerify = newToken;
          }
        }
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=verify`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${tokenToVerify}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        // If token verification fails with 401, try to refresh
        if (response.status === 401) {
          console.log("Token verification failed with 401, attempting refresh");
          const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          if (storedRefreshToken) {
            try {
              const refreshResponse = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`, {
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
              console.error("Token refresh failed:", refreshError);
              throw new Error("Token expired and refresh failed");
            }
          }
        }
        
        // Retry with exponential backoff
        if (retryCount < maxRetries) {
          const backoffMs = Math.pow(2, retryCount) * 100; // 100ms, 200ms, 400ms
          console.log(`Retrying token verification in ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries})`);
          await sleep(backoffMs);
          return verifyToken(tokenToVerify, retryCount + 1);
        }
        
        throw new Error("Token verification failed");
      }

      const data = await response.json();
      
      if (data.admin && data.tenant) {
        setAdmin(data.admin);
        setTenant(data.tenant);
        localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
        localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));
      }
      
      setLoading(false);
      return true;
    } catch (error) {
      console.error("Token verification error:", error);
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
      setLoading(false);
      return false;
    }
  };

  const setupRefreshTimer = (token: string) => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    // Get token expiration
    const expiration = getTokenExpiration(token);
    if (!expiration) {
      console.warn("Could not get token expiration, skipping proactive refresh");
      return;
    }

    // Calculate time until refresh (5 minutes before expiration)
    const timeUntilRefresh = expiration.getTime() - Date.now() - REFRESH_BUFFER_MS;
    
    if (timeUntilRefresh <= 0) {
      // Token expires very soon, refresh immediately
      console.log("Token expires very soon, refreshing immediately");
      refreshAuthToken();
      return;
    }

    console.log(`Setting up proactive token refresh in ${Math.round(timeUntilRefresh / 1000 / 60)} minutes`);
    
    // Set timer to refresh token before it expires
    refreshTimerRef.current = setTimeout(() => {
      console.log("Proactively refreshing token before expiration");
      refreshAuthToken();
    }, timeUntilRefresh);
  };

  const login = async (email: string, password: string, tenantSlug: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, tenantSlug }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }

      const data = await response.json();
      
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      setToken(data.access_token); // Backwards compatibility
      setAdmin(data.admin);
      setTenant(data.tenant);
      
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
      localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));
      
      // Setup proactive refresh timer
      setupRefreshTimer(data.access_token);
    } catch (error) {
      console.error("Login error:", error);
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
      if (accessToken) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setToken(null);
      setAccessToken(null);
      setRefreshToken(null);
      setAdmin(null);
      setTenant(null);
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(TENANT_KEY);
    }
  };

  const refreshAuthToken = async () => {
    const currentRefreshToken = refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!currentRefreshToken) {
      console.warn("No refresh token available");
      return;
    }
    
    try {
      console.log("Refreshing access token...");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: currentRefreshToken }),
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      setToken(data.access_token); // Backwards compatibility
      
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
      
      // Setup next proactive refresh
      setupRefreshTimer(data.access_token);
      
      console.log("Token refreshed successfully");
    } catch (error) {
      console.error("Token refresh error:", error);
      // If refresh fails, clear everything
      logout();
    }
  };

  // Proactive token refresh effect
  useEffect(() => {
    if (accessToken) {
      setupRefreshTimer(accessToken);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [accessToken]);

  return (
    <TenantAdminAuthContext.Provider value={{ admin, tenant, token, accessToken, refreshToken: refreshToken, loading, login, logout, refreshAuthToken }}>
      {children}
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

