import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { logger } from "@/utils/logger";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { getTokenExpiration } from "@/lib/auth/jwt";
import { SessionTimeoutWarning } from "@/components/auth/SessionTimeoutWarning";

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

const TOKEN_KEY = STORAGE_KEYS.SUPER_ADMIN_ACCESS_TOKEN;
const SUPER_ADMIN_KEY = STORAGE_KEYS.SUPER_ADMIN_USER;

// Bound fetch to prevent "Illegal invocation" error in production builds
const safeFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

export const SuperAdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [secondsUntilLogout, setSecondsUntilLogout] = useState(60);

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
      const response = await safeFetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=verify`, {
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
      const response = await safeFetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
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
        await safeFetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
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
      const response = await safeFetch(`${supabaseUrl}/functions/v1/super-admin-auth?action=refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
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
        logger.info("Token expiring soon, refreshing...", undefined, 'SuperAdminAuth');
        refreshToken();
      } else if (timeUntilExpiry <= 0) {
        logger.warn("Token expired, logging out...", undefined, 'SuperAdminAuth');
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
    <SuperAdminAuthContext.Provider value={{ superAdmin, token, loading, login, logout, refreshToken }}>
      {children}
      <SessionTimeoutWarning
        open={showTimeoutWarning}
        onStayLoggedIn={handleStayLoggedIn}
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

