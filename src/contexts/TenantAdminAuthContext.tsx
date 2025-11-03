import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export const TenantAdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<TenantAdmin | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null); // For backwards compatibility
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
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
              
              setLoading(false);
              return; // Successfully refreshed
            } catch (refreshError) {
              // If refresh also fails, clear everything
              throw new Error("Token expired and refresh failed");
            }
          }
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
    }
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
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
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
    if (!refreshToken) return;
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
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
    } catch (error) {
      console.error("Token refresh error:", error);
      // If refresh fails, clear everything
      logout();
    }
  };

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

