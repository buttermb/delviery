import { ReactNode, useEffect, useState, useRef, memo } from 'react';
import { Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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

  // Cleanup verification lock on unmount - MUST be before any conditional returns
  useEffect(() => {
    return () => {
      verificationLockRef.current = false;
    };
  }, []);

  // Safety timeout to unlock verification if it gets stuck
  useEffect(() => {
    if (!verifying) return;
    
    const timeout = setTimeout(() => {
      if (verificationLockRef.current) {
        logger.warn('[TenantAdminProtectedRoute] Verification timeout - unlocking', { component: 'TenantAdminProtectedRoute' });
        verificationLockRef.current = false;
        setVerifying(false);
      }
    }, VERIFICATION_TIMEOUT_MS);
    
    return () => clearTimeout(timeout);
  }, [verifying]);

  // Main verification effect with total wait timeout
  useEffect(() => {
    console.log('[PROTECTED ROUTE] 🔒 Verification check starting', {
      verified,
      skipVerification,
      loading,
      hasAdmin: !!admin,
      hasTenant: !!tenant,
      tenantSlug,
      pathname: location.pathname,
    });
    
    // Skip if already verified or skipped - MUST be first check to prevent loops
    if (verified || skipVerification) {
      console.log('[PROTECTED ROUTE] ⏩ Skipping verification (already verified or skipped)');
      return;
    }
    
    // CRITICAL FIX: If auth is complete (not loading) and we have admin/tenant, skip verification
    // This prevents infinite loading when auth completes successfully
    if (!loading && admin && tenant && tenant.slug === tenantSlug) {
      console.log('[PROTECTED ROUTE] ✅ Auth complete and valid - bypassing verification');
      setVerified(true);
      setSkipVerification(true);
      return;
    }
    
    // Track total wait time
    if (!totalWaitStartRef.current) {
      totalWaitStartRef.current = Date.now();
      console.log('[PROTECTED ROUTE] ⏱️ Starting total wait timer');
    }
    
    // Total wait timeout: skip verification after 15 seconds
    const totalWaitTimeout = setTimeout(() => {
      const totalWait = Date.now() - (totalWaitStartRef.current || Date.now());
      if (totalWait >= TOTAL_WAIT_TIMEOUT_MS && !verified && !skipVerification) {
        console.log('[PROTECTED ROUTE] ⏰ Total wait timeout triggered', { totalWait });
        logger.warn(`Total wait timeout (${totalWait}ms) - skipping verification`, undefined, 'TenantAdminProtectedRoute');
        setSkipVerification(true);
        setVerifying(false);
        setVerified(true); // Allow access after timeout
        verificationLockRef.current = false;
      }
    }, TOTAL_WAIT_TIMEOUT_MS);
    
    // If auth is still loading, wait (but with timeout protection)
    if (loading) {
      console.log('[PROTECTED ROUTE] ⏳ Auth context still loading, waiting...');
      const loadingTimeout = setTimeout(() => {
        if (loading && !verified && !skipVerification) {
          console.log('[PROTECTED ROUTE] ⚠️ Auth context loading timeout (>10s)');
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
      console.log('[PROTECTED ROUTE] ❌ Not authenticated, will redirect to login');
      clearTimeout(totalWaitTimeout);
      setVerifying(false);
      setVerified(false);
      return;
    }
    
    console.log('[PROTECTED ROUTE] ✅ Auth context loaded', {
      adminEmail: admin.email,
      tenantSlug: tenant.slug,
    });
    
    // Skip if already checking
    if (verifying) {
      console.log('[PROTECTED ROUTE] 🔄 Already verifying, skipping duplicate check');
      return () => clearTimeout(totalWaitTimeout);
    }

    // Use lock to prevent race conditions
    if (verificationLockRef.current) {
      console.log('[PROTECTED ROUTE] 🔒 Verification locked, skipping duplicate check');
      return () => clearTimeout(totalWaitTimeout);
    }

    // Check cache
    const cacheKey = `${tenantSlug}-${location.pathname}`;
    const cached = verificationCache.current[cacheKey];
    if (cached && Date.now() - cached.timestamp < VERIFICATION_CACHE_DURATION) {
      console.log('[PROTECTED ROUTE] 💾 Using cached verification result');
      clearTimeout(totalWaitTimeout);
      setVerified(true);
      return;
    }

    console.log('[PROTECTED ROUTE] 🔐 Starting local verification with retry logic...');
    // Lock verification to prevent concurrent requests
    verificationLockRef.current = true;
    setVerifying(true);
    setVerificationError(null);
    
    // Set verification timeout (5 seconds)
    const verificationTimeout = setTimeout(() => {
      if (!verified && !skipVerification) {
        console.log('[PROTECTED ROUTE] ⏰ Verification timeout triggered');
        logger.warn(`Verification timeout (${VERIFICATION_TIMEOUT_MS}ms)`, undefined, 'TenantAdminProtectedRoute');
        setVerificationError('Verification timed out. Please try again.');
        setVerifying(false);
        verificationLockRef.current = false;
      }
    }, VERIFICATION_TIMEOUT_MS);

    // Verification with retry logic
    const verifyWithRetry = async (retryCount = 0): Promise<boolean> => {
      const maxRetries = 2;
      
      try {
        // Local verification: compare tenant slug from URL with authenticated tenant
        const isValidSlug = tenant.slug === tenantSlug;
        console.log('[PROTECTED ROUTE] 🔍 Slug validation', {
          urlSlug: tenantSlug,
          tenantSlug: tenant.slug,
          isValid: isValidSlug,
          attempt: retryCount + 1,
        });
        
        if (!isValidSlug) {
          console.log('[PROTECTED ROUTE] ❌ Slug mismatch detected!');
          const { showErrorToast } = await import('@/lib/toastUtils');
          const { emitAuthError } = await import('@/hooks/useAuthError');
          
          const errorMessage = "Tenant mismatch. You may be logged into a different account.";
          showErrorToast(errorMessage, "Please log in with the correct account.");
          emitAuthError({ message: errorMessage, code: 'TENANT_MISMATCH' });
          
          setVerificationError(errorMessage);
          return false;
        }

        // Verification passed
        console.log('[PROTECTED ROUTE] ✅ Verification passed!');
        return true;
      } catch (error: any) {
        console.error('[PROTECTED ROUTE] ❌ Verification error:', error);
        
        // Retry with exponential backoff
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
          console.log(`[PROTECTED ROUTE] 🔄 Retrying verification in ${delay}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          return verifyWithRetry(retryCount + 1);
        }
        
        // Final failure after retries
        const { showErrorToast } = await import('@/lib/toastUtils');
        const { emitAuthError } = await import('@/hooks/useAuthError');
        
        let errorMessage = 'Verification failed after multiple attempts.';
        let errorCode = 'VERIFICATION_FAILED';
        
        if (error.message?.includes('network')) {
          errorMessage = 'Network error during verification. Please check your connection.';
          errorCode = 'NETWORK_ERROR';
        } else if (error.message?.includes('timeout')) {
          errorMessage = 'Verification timed out. Please try again.';
          errorCode = 'TIMEOUT';
        }
        
        showErrorToast(errorMessage, 'Please refresh the page or log in again.');
        emitAuthError({ message: errorMessage, code: errorCode });
        setVerificationError(errorMessage);
        
        return false;
      }
    };

    // Run verification with retry
    verifyWithRetry().then((success) => {
      clearTimeout(verificationTimeout);
      clearTimeout(totalWaitTimeout);
      
      if (success) {
        verificationCache.current[cacheKey] = {
          verified: true,
          timestamp: Date.now(),
        };
        
        setVerified(true);
        setVerificationError(null);
      } else {
        setVerified(false);
      }
      
      setVerifying(false);
      verificationLockRef.current = false;
    }).catch((error) => {
      console.error('[PROTECTED ROUTE] ❌ Unexpected verification error:', error);
      clearTimeout(verificationTimeout);
      clearTimeout(totalWaitTimeout);
      setVerifying(false);
      verificationLockRef.current = false;
    });
    
    return () => {
      clearTimeout(totalWaitTimeout);
      clearTimeout(verificationTimeout);
    };
    // Remove verified, skipVerification, and verifying from deps to prevent infinite loops
  }, [tenantSlug, location.pathname, admin, tenant, loading]);

  // Loading state - wait for auth AND verification (unless skipped OR not authenticated)
  // If user is not authenticated (no admin/tenant), let it fall through to redirect
  if ((loading || verifying || (!verified && (admin || tenant))) && !skipVerification) {
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
              onClick={() => navigate(`/${tenantSlug}/admin/login`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return to Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Success - render protected content with verification context
  return (
    <VerificationProvider>
      {children}
    </VerificationProvider>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(TenantAdminProtectedRoute);
