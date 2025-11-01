import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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
  loading: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const TenantAdminAuthContext = createContext<TenantAdminAuthContextType | undefined>(undefined);

const TOKEN_KEY = "tenant_admin_token";
const ADMIN_KEY = "tenant_admin_user";
const TENANT_KEY = "tenant_data";

export const TenantAdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<TenantAdmin | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedAdmin = localStorage.getItem(ADMIN_KEY);
    const storedTenant = localStorage.getItem(TENANT_KEY);

    if (storedToken && storedAdmin && storedTenant) {
      setToken(storedToken);
      try {
        setAdmin(JSON.parse(storedAdmin));
        setTenant(JSON.parse(storedTenant));
        // Verify token is still valid
        verifyToken(storedToken);
      } catch (e) {
        // Invalid stored data, clear it
        localStorage.removeItem(TOKEN_KEY);
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
        throw new Error("Token verification failed");
      }

      const data = await response.json();
      setAdmin(data.admin);
      setTenant(data.tenant);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
      localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));
      setLoading(false);
    } catch (error) {
      console.error("Token verification error:", error);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(TENANT_KEY);
      setToken(null);
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
      setToken(data.token);
      setAdmin(data.admin);
      setTenant(data.tenant);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin));
      localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        await fetch(`${supabaseUrl}/functions/v1/tenant-admin-auth?action=logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setToken(null);
      setAdmin(null);
      setTenant(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(TENANT_KEY);
    }
  };

  const refreshToken = async () => {
    // For tenant admin, tokens last 7 days, so refresh might not be needed
    // But we can verify the token is still valid
    if (!token) return;
    await verifyToken(token);
  };

  return (
    <TenantAdminAuthContext.Provider value={{ admin, tenant, token, loading, login, logout, refreshToken }}>
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

