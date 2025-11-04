import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { logger } from "@/utils/logger";
import { apiFetch } from "@/lib/utils/apiClient";

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
}

interface CustomerAuthContextType {
  customer: Customer | null;
  tenant: Tenant | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

const TOKEN_KEY = "customer_token";
const CUSTOMER_KEY = "customer_user";
const TENANT_KEY = "customer_tenant_data";

export const CustomerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedCustomer = localStorage.getItem(CUSTOMER_KEY);
    const storedTenant = localStorage.getItem(TENANT_KEY);

    if (storedToken && storedCustomer && storedTenant) {
      setToken(storedToken);
      try {
        setCustomer(JSON.parse(storedCustomer));
        setTenant(JSON.parse(storedTenant));
        // Verify token is still valid
        verifyToken(storedToken);
      } catch (e) {
        // Invalid stored data, clear it
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(CUSTOMER_KEY);
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
      const response = await apiFetch(`${supabaseUrl}/functions/v1/customer-auth?action=verify`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${tokenToVerify}`,
        },
        skipAuth: true,
      });

      if (!response.ok) {
        throw new Error("Token verification failed");
      }

      const data = await response.json();
      setCustomer(data.customer);
      setTenant(data.tenant);
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data.customer));
      localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));
      setLoading(false);
    } catch (error) {
      logger.error("Token verification error", error);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CUSTOMER_KEY);
      localStorage.removeItem(TENANT_KEY);
      setToken(null);
      setCustomer(null);
      setTenant(null);
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, tenantSlug: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/customer-auth?action=login`, {
        method: "POST",
        body: JSON.stringify({ email, password, tenantSlug }),
        skipAuth: true,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }

      const data = await response.json();
      setToken(data.token);
      setCustomer(data.customer);
      setTenant(data.tenant);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(data.customer));
      localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));
    } catch (error) {
      logger.error("Login error", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        await apiFetch(`${supabaseUrl}/functions/v1/customer-auth?action=logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
          skipAuth: true,
        });
      }
    } catch (error) {
      logger.error("Logout error", error);
    } finally {
      setToken(null);
      setCustomer(null);
      setTenant(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CUSTOMER_KEY);
      localStorage.removeItem(TENANT_KEY);
    }
  };

  const refreshToken = async () => {
    // For customers, tokens last 30 days, so refresh might not be needed
    // But we can verify the token is still valid
    if (!token) return;
    await verifyToken(token);
  };

  return (
    <CustomerAuthContext.Provider value={{ customer, tenant, token, loading, login, logout, refreshToken }}>
      {children}
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

