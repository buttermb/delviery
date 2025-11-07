import { ReactNode, useEffect, useState, useRef, memo } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { LoadingFallback } from '@/components/LoadingFallback';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { VerificationProvider } from '@/contexts/VerificationContext';
import { logger } from '@/utils/logger';

interface TenantAdminProtectedRouteProps {
  children: ReactNode;
}

// Verification timeout - 5 seconds (reduced from 8s)
const VERIFICATION_TIMEOUT_MS = 5000;
// Total wait timeout - 15 seconds before skip verification fallback
const TOTAL_WAIT_TIMEOUT_MS = 15000;
// Network timeout - 2 seconds (edge function is optimized)
const NETWORK_TIMEOUT_MS = 2000;
// Cache verification results for 2 minutes
const VERIFICATION_CACHE_DURATION = 2 * 60 * 1000;

export function TenantAdminProtectedRoute({ children }: TenantAdminProtectedRouteProps) {
  const { admin, tenant, token, loading } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [verifying, setVerifying] = useState(false); // CRITICAL FIX: Start as false, not true
  const [verified, setVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [skipVerification, setSkipVerification] = useState(false);
  const location = useLocation();
  const totalWaitStartRef = useRef<number | null>(null);
  
  // Use lock to prevent concurrent verification requests
  const verificationLockRef = useRef(false);
  
  // Cache verification results to avoid repeated checks
  const verificationCache = useRef<Record<string, { verified: boolean; timestamp: number }>>({});
  
  // Track auth values in refs to avoid re-triggering verification
  const authRef = useRef({ token, admin, tenant });
  
  // Update auth refs when auth changes (doesn't trigger verification)
  useEffect(() => {
    authRef.current = { token, admin, tenant };
  }, [token, admin, tenant]);

  // Safety timeout to unlock verification if it gets stuck
  useEffect(() => {
    if (!verifying) return;
    
    const timeout = setTimeout(() => {
      if (verificationLockRef.current) {
        logger.warn('[TenantAdminProtectedRoute] Verification timeout - unlocking', undefined, 'TenantAdminProtectedRoute');
        verificationLockRef.current = false;
        setVerifying(false);
      }
    }, VERIFICATION_TIMEOUT_MS);
    
    return () => clearTimeout(timeout);
  }, [verifying]);

  // Main verification effect with total wait timeout
  useEffect(() => {
    // Skip if already verified or skipped - MUST be first check to prevent loops
    if (verified || skipVerification) {
      return;
    }
    
    // Track total wait time
    if (!totalWaitStartRef.current) {
      totalWaitStartRef.current = Date.now();
    }
    
    // Total wait timeout: skip verification after 15 seconds
    const totalWaitTimeout = setTimeout(() => {
      const totalWait = Date.now() - (totalWaitStartRef.current || Date.now());
      if (totalWait >= TOTAL_WAIT_TIMEOUT_MS && !verified && !skipVerification) {
        logger.warn(`Total wait timeout (${totalWait}ms) - skipping verification`, undefined, 'TenantAdminProtectedRoute');
        setSkipVerification(true);
        setVerifying(false);
        setVerified(true); // Allow access after timeout
        verificationLockRef.current = false;
      }
    }, TOTAL_WAIT_TIMEOUT_MS);
    
    // If auth is still loading, wait (but with timeout protection)
    if (loading) {
      const loadingTimeout = setTimeout(() => {
        if (loading && !verified && !skipVerification) {
          logger.warn('Auth context loading timeout (>10s) - skipping verification', undefined, 'TenantAdminProtectedRoute');
          setSkipVerification(true);
          setVerifying(false);
          setVerified(true);
          verificationLockRef.current = false;
        }
      }, 10000);
      
      return () => {
        clearTimeout(loadingTimeout);
        clearTimeout(totalWaitTimeout);
      };
    }
    
    // If not authenticated, don't verify - let the redirect happen
    if (!admin || !tenant) {
      clearTimeout(totalWaitTimeout);
      setVerifying(false);
      setVerified(false);
      return;
    }
    
    // Skip if already checking
    if (verifying) {
      return () => clearTimeout(totalWaitTimeout);
    }

    // Use lock to prevent race conditions
    if (verificationLockRef.current) {
      return () => clearTimeout(totalWaitTimeout);
    }

    // Check cache
    const cacheKey = `${tenantSlug}-${location.pathname}`;
    const cached = verificationCache.current[cacheKey];
    if (cached && Date.now() - cached.timestamp < VERIFICATION_CACHE_DURATION) {
      clearTimeout(totalWaitTimeout);
      setVerified(true);
      return;
    }

    // Lock verification to prevent concurrent requests
    verificationLockRef.current = true;
    setVerifying(true);
    setVerificationError(null);
    
    // Set verification timeout (5 seconds)
    const verificationTimeout = setTimeout(() => {
      if (!verified && !skipVerification) {
        logger.warn(`Verification timeout (${VERIFICATION_TIMEOUT_MS}ms)`, undefined, 'TenantAdminProtectedRoute');
        setVerificationError('Verification timed out. Please try again.');
        setVerifying(false);
        verificationLockRef.current = false;
      }
    }, VERIFICATION_TIMEOUT_MS);

    // Local verification: compare tenant slug from URL with authenticated tenant
    const isValidSlug = tenant.slug === tenantSlug;
    
    if (!isValidSlug) {
      clearTimeout(verificationTimeout);
      clearTimeout(totalWaitTimeout);
      setVerificationError("Tenant mismatch. Please re-login.");
      setVerified(false);
      setVerifying(false);
      verificationLockRef.current = false;
      return;
    }

    // If we reach here, verification passed
    clearTimeout(verificationTimeout);
    clearTimeout(totalWaitTimeout);
    verificationCache.current[cacheKey] = {
      verified: true,
      timestamp: Date.now(),
    };
    
    setVerified(true);
    setVerifying(false);
    setVerificationError(null);
    verificationLockRef.current = false;
    
    return () => {
      clearTimeout(totalWaitTimeout);
      clearTimeout(verificationTimeout);
    };
    // Remove verified, skipVerification, and verifying from deps to prevent infinite loops
  }, [tenantSlug, location.pathname, admin, tenant, loading]);

  // Loading state - wait for auth AND verification (unless skipped)
  if ((loading || verifying || !verified) && !skipVerification) {
    return <LoadingFallback />;
  }

  // Not authenticated
  if (!admin || !tenant) {
    return <Navigate to={`/${tenantSlug}/admin/login`} replace />;
  }

  // Tenant slug mismatch
  if (tenant.slug !== tenantSlug) {
    return <Navigate to={`/${tenant.slug}/admin`} replace />;
  }

  // Show error UI after multiple failures
  if (verificationError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <h2 className="text-lg font-semibold">Authentication Error</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">{verificationError}</p>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                setVerificationError(null);
                setVerified(false);
                setVerifying(true);
                verificationLockRef.current = false;
              }}
            >
              Try Again
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = `/${tenantSlug}/admin/login`}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Cleanup verification lock on unmount
  useEffect(() => {
    return () => {
      verificationLockRef.current = false;
    };
  }, []);

  // Success - render protected content with verification context
  return (
    <VerificationProvider>
      {children}
    </VerificationProvider>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(TenantAdminProtectedRoute);
