import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { logger } from "@/utils/logger";
import { apiFetch } from "@/lib/utils/apiClient";

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
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextType | undefined>(undefined);

const TOKEN_KEY = "super_admin_token";
const SUPER_ADMIN_KEY = "super_admin_user";

export const SuperAdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedAdmin = localStorage.getItem(SUPER_ADMIN_KEY);

    if (storedToken && storedAdmin) {
      setToken(storedToken);
      try {
        setSuperAdmin(JSON.parse(storedAdmin));
        // Verify token is still valid
        verifyToken(storedToken);
      } catch (e) {
        // Invalid stored data, clear it
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SUPER_ADMIN_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=verify`, {
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
      setSuperAdmin(data.superAdmin);
      localStorage.setItem(SUPER_ADMIN_KEY, JSON.stringify(data.superAdmin));
      setLoading(false);
    } catch (error) {
      logger.error("Token verification error", error);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SUPER_ADMIN_KEY);
      setToken(null);
      setSuperAdmin(null);
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=login`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Login failed");
      }

      const data = await response.json();
      setToken(data.token);
      setSuperAdmin(data.superAdmin);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(SUPER_ADMIN_KEY, JSON.stringify(data.superAdmin));
    } catch (error) {
      logger.error("Login error", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        await apiFetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=logout`, {
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
      setSuperAdmin(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SUPER_ADMIN_KEY);
    }
  };

  const refreshToken = async () => {
    if (!token) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await apiFetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=refresh`, {
        method: "POST",
        body: JSON.stringify({ token }),
        skipAuth: true,
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();
      setToken(data.token);
      localStorage.setItem(TOKEN_KEY, data.token);
    } catch (error) {
      logger.error("Token refresh error", error);
      // If refresh fails, logout
      await logout();
    }
  };

  return (
    <SuperAdminAuthContext.Provider value={{ superAdmin, token, loading, login, logout, refreshToken }}>
      {children}
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

