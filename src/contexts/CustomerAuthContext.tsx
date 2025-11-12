import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { logger } from "@/utils/logger";
import { apiFetch } from "@/lib/utils/apiClient";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { getTokenExpiration } from "@/lib/auth/jwt";
import { SessionTimeoutWarning } from "@/components/auth/SessionTimeoutWarning";

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
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

const TOKEN_KEY = STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN;
const CUSTOMER_KEY = STORAGE_KEYS.CUSTOMER_USER;
const TENANT_KEY = STORAGE_KEYS.CUSTOMER_TENANT_DATA;

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

export const CustomerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [secondsUntilLogout, setSecondsUntilLogout] = useState(300);
  
  // Validate environment on mount
  useEffect(() => {
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
      logger.error('Environment validation failed:', envCheck.error);
      console.error('[CustomerAuth] Configuration error:', envCheck.error);
      setLoading(false);
    }
  }, []);

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
      const envCheck = validateEnvironment();
      if (!envCheck.valid) {
        throw new Error(envCheck.error || 'Environment configuration error');
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await getSafeFetch()(`${supabaseUrl}/functions/v1/customer-auth?action=verify`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${tokenToVerify}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Token verification failed:", response.status, errorText);
        throw new Error(`Token verification failed: ${response.status}`);
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
      const envCheck = validateEnvironment();
      if (!envCheck.valid) {
        throw new Error(envCheck.error || 'Environment configuration error');
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await getSafeFetch()(`${supabaseUrl}/functions/v1/customer-auth?action=login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, tenantSlug }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Login failed" }));
        // Check if email verification is required
        if (response.status === 403 && error.requires_verification) {
          const verificationError = new Error(error.message || "Email not verified");
          (verificationError as any).requires_verification = true;
          (verificationError as any).customer_user_id = error.customer_user_id;
          throw verificationError;
        }
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
        await getSafeFetch()(`${supabaseUrl}/functions/v1/customer-auth?action=logout`, {
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

  // Token expiration monitoring - check and verify token before expiry
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
      const oneDay = 24 * 60 * 60 * 1000;
      const fiveMinutes = 5 * 60 * 1000;

      // Show warning if less than 5 minutes until expiry
      if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
        setSecondsUntilLogout(Math.floor(timeUntilExpiry / 1000));
        setShowTimeoutWarning(true);
      } else if (timeUntilExpiry < oneDay && timeUntilExpiry >= fiveMinutes) {
        // Auto-verify between 5 minutes and 1 day before expiry
        logger.info("Token expiring soon, verifying...", undefined, 'CustomerAuth');
        refreshToken();
      } else if (timeUntilExpiry <= 0) {
        logger.warn("Token expired, logging out...", undefined, 'CustomerAuth');
        setShowTimeoutWarning(false);
        logout();
      }
    };

    // Check immediately
    checkAndRefreshToken();

    // Check every hour for customer tokens (they last 30 days)
    refreshIntervalRef.current = setInterval(checkAndRefreshToken, 60 * 60 * 1000);

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
    <CustomerAuthContext.Provider value={{ customer, tenant, token, loading, login, logout, refreshToken }}>
      {children}
      <SessionTimeoutWarning
        open={showTimeoutWarning}
        onStayLoggedIn={handleStayLoggedIn}
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

