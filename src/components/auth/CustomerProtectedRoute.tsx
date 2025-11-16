import { ReactNode, useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { Loader2 } from "lucide-react";
import { logger } from "@/utils/logger";

interface CustomerProtectedRouteProps {
  children: ReactNode;
}

export function CustomerProtectedRoute({ children }: CustomerProtectedRouteProps) {
  const { customer, tenant, token, loading } = useCustomerAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const location = useLocation();
  const [verifying, setVerifying] = useState(false); // CRITICAL FIX: Start as false, not true
  
  // Track auth values in refs to avoid re-triggering verification
  const authRef = useRef({ token, customer, tenant });
  const verificationLockRef = useRef(false);
  
  // Cache verification results to avoid repeated checks
  const verificationCache = useRef(new Map<string, { result: boolean; timestamp: number }>());
  const VERIFICATION_CACHE_MS = 2 * 60 * 1000; // 2 minutes

  const isVerificationCacheValid = (email: string, tenantSlug: string): boolean => {
    const cacheKey = `${email}:${tenantSlug}`;
    const cached = verificationCache.current.get(cacheKey);
    
    if (!cached) return false;
    
    const age = Date.now() - cached.timestamp;
    const isValid = age < VERIFICATION_CACHE_MS && cached.result;
    
    if (!isValid && cached) {
      verificationCache.current.delete(cacheKey);
    }
    
    return isValid;
  };

  // Update auth ref when values change
  useEffect(() => {
    authRef.current = { token, customer, tenant };
  }, [token, customer, tenant]);

  // Safety timeout to unlock verification if it gets stuck
  useEffect(() => {
    if (!verifying) return;
    
    const timeout = setTimeout(() => {
      if (verificationLockRef.current) {
        logger.warn('[CustomerProtectedRoute] Verification timeout - unlocking', undefined, 'CustomerProtectedRoute');
        verificationLockRef.current = false;
        setVerifying(false);
      }
    }, 5000); // 5 second timeout
    
    return () => clearTimeout(timeout);
  }, [verifying]);

  // Verify access on route change or auth change
  useEffect(() => {
    const verifyAccess = async () => {
      // CRITICAL: Check verifying and lock FIRST to prevent re-entry
      // This must be the first check to avoid infinite loops
      if (verifying || verificationLockRef.current) {
        return;
      }

      // If auth is still loading, wait
      if (loading) {
        return;
      }

      // If not authenticated, don't verify - let the redirect happen
      if (!token || !customer || !tenant) {
        setVerifying(false);
        if (tenantSlug) {
          navigate(`/${tenantSlug}/shop/login`, { replace: true });
        } else {
          navigate("/shop/login", { replace: true });
        }
        return;
      }

      // Set lock and verifying state atomically to prevent race conditions
      verificationLockRef.current = true;
      setVerifying(true);

      try {
        // Local validation: verify tenant slug matches
        if (tenantSlug && tenant.slug !== tenantSlug) {
          setVerifying(false);
          verificationLockRef.current = false;
          navigate(`/${tenant.slug}/shop/login`, { replace: true });
          return;
        }

        // Check verification cache
        const cacheKey = `${customer.email}:${tenant.slug}`;
        if (isVerificationCacheValid(customer.email, tenant.slug)) {
          setVerifying(false);
          verificationLockRef.current = false;
          return;
        }

        // Local verification passed - cache the result
        verificationCache.current.set(cacheKey, {
          result: true,
          timestamp: Date.now()
        });

        setVerifying(false);
        verificationLockRef.current = false;
      } catch (err) {
        logger.error('[CustomerProtectedRoute] Verification error', err, 'CustomerProtectedRoute');
        setVerifying(false);
        verificationLockRef.current = false;
      }
    };

    verifyAccess();
    // NOTE: verifying is intentionally NOT in the dependency array
    // to prevent infinite loops. The lock ref handles concurrency.
    // isVerificationCacheValid is stable (only uses refs) and doesn't need to be included.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, location.pathname, loading, token, customer, tenant, navigate]);

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!token || !customer || !tenant) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
