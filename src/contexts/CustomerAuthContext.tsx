import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { logger } from "@/lib/logger";
import { clientEncryption } from "@/lib/encryption/clientEncryption";
import { apiFetch } from "@/lib/utils/apiClient";
import { STORAGE_KEYS } from "@/constants/storageKeys";
import { safeStorage } from "@/utils/safeStorage";
import { getTokenExpiration } from "@/lib/auth/jwt";
import { SessionTimeoutWarning } from "@/components/auth/SessionTimeoutWarning";
import { safeFetch } from "@/utils/safeFetch";

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
  
  // Validate environment on mount
  useEffect(() => {
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
      logger.error('Environment validation failed:', envCheck.error);
      logger.error('[CustomerAuth] Configuration error:', envCheck.error);
      setLoading(false);
    }
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
        // Invalid stored data, clear it
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
      const response = await safeFetch(`${supabaseUrl}/functions/v1/customer-auth?action=verify`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${tokenToVerify}`,
          "Content-Type": "application/json",
        },
      });

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
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
      const response = await safeFetch(`${supabaseUrl}/functions/v1/customer-auth?action=login`, {
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
      safeStorage.setItem(TOKEN_KEY, data.token);
      safeStorage.setItem(CUSTOMER_KEY, JSON.stringify(data.customer));
      safeStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant));

      // Store user ID for encryption
      if (data.customer?.id) {
        safeStorage.setItem('floraiq_user_id', data.customer.id);
        safeStorage.setItem('floraiq_user_id', data.customer.id);
      }

      // Initialize encryption with user's password
      try {
        if (data.customer?.id) {
          await clientEncryption.initialize(password, data.customer.id);
          logger.debug('Encryption initialized successfully', { userId: data.customer.id, component: 'CustomerAuthContext' });
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
      
      // Enhanced error logging with context
      logger.error("Customer login error", errorObj, {
        component: 'CustomerAuthContext',
        email: email,
        tenantSlug: tenantSlug,
        hasResponse: errorObj instanceof Error && 'response' in errorObj,
      });
      
      // Re-throw with user-friendly message if needed
      if (errorObj.message?.includes('Network') || errorObj.message?.includes('network')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else if (errorObj.message?.includes('timeout') || errorObj.message?.includes('timed out')) {
        throw new Error('Request timed out. Please try again.');
      }
      
      throw errorObj;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aejugtmhwwknrowfyzie.supabase.co';
        await safeFetch(`${supabaseUrl}/functions/v1/customer-auth?action=logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      }
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error("Customer logout error", errorObj, {
        component: 'CustomerAuthContext',
        hadToken: !!token,
      });
    } finally {
      // Destroy encryption session before logout
      clientEncryption.destroy();
      
      setToken(null);
      setCustomer(null);
      setTenant(null);
      safeStorage.removeItem(TOKEN_KEY);
      safeStorage.removeItem(CUSTOMER_KEY);
      safeStorage.removeItem(TENANT_KEY);
      
      // Clear user ID from storage
      safeStorage.removeItem('floraiq_user_id');
      safeStorage.removeItem('floraiq_user_id');
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
        logger.info("Token expiring soon, verifying...", { component: 'CustomerAuth' });
        refreshToken();
      } else if (timeUntilExpiry <= 0) {
        logger.warn("Token expired, logging out...", { component: 'CustomerAuth' });
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

