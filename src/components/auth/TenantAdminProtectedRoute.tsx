import { logger } from '@/lib/logger';
import { ReactNode, useEffect, useState, useRef, memo } from 'react';
import { Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { LoadingFallback } from '@/components/LoadingFallback';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { VerificationProvider } from '@/contexts/VerificationContext';
import { handleError } from '@/utils/errorHandling/handlers';
import { intendedDestinationUtils } from '@/hooks/useIntendedDestination';
import { getTenantFromSlug } from '@/lib/tenant';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import TenantNotFoundPage from '@/pages/TenantNotFoundPage';

interface TenantAdminProtectedRouteProps {
  children: ReactNode;
}

// Verification timeout - 5 seconds (reduced from 8s)
const VERIFICATION_TIMEOUT_MS = 5000;
// Total wait timeout - 15 seconds before skip verification fallback
const TOTAL_WAIT_TIMEOUT_MS = 15000;
// Cache verification results for 2 minutes
const VERIFICATION_CACHE_DURATION = 2 * 60 * 1000;

export function TenantAdminProtectedRoute({ children }: TenantAdminProtectedRouteProps) {
  const { admin, tenant, token, loading, initialized } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  // Clerk logic removed
  const [verifying, setVerifying] = useState(false); // CRITICAL FIX: Start as false, not true
  const [verified, setVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [skipVerification, setSkipVerification] = useState(false);
  const [tenantSlugValid, setTenantSlugValid] = useState<boolean | null>(null);
  const location = useLocation();
  const totalWaitStartRef = useRef<number | null>(null);
  const tenantCheckSlugRef = useRef<string | null>(null);

  // Consolidated auth variables
  const effectiveLoading = loading;
  const effectiveAdmin = admin;
  const effectiveTenant = tenant;

  // Use lock to prevent concurrent verification requests
  const verificationLockRef = useRef(false);

  // Cache verification results to avoid repeated checks
  const verificationCache = useRef<Record<string, { verified: boolean; timestamp: number }>>({});

  // Track auth values in refs to avoid re-triggering verification
  const authRef = useRef({ token, admin: effectiveAdmin, tenant: effectiveTenant });

  // Update auth refs when auth changes (doesn't trigger verification)
  useEffect(() => {
    authRef.current = { token, admin: effectiveAdmin, tenant: effectiveTenant };
  }, [token, effectiveAdmin, effectiveTenant]);

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

  // Check if tenant slug exists in DB when user is not authenticated
  useEffect(() => {
    // Only check when auth is done loading and user is NOT authenticated
    if (effectiveLoading) return;
    if (effectiveAdmin && effectiveTenant) return;
    if (!tenantSlug) return;
    if (tenantCheckSlugRef.current === tenantSlug) return;

    tenantCheckSlugRef.current = tenantSlug;

    getTenantFromSlug(tenantSlug)
      .then((result) => {
        setTenantSlugValid(!!result);
        if (!result) {
          logger.warn('[PROTECTED ROUTE] Tenant slug not found in database', { tenantSlug });
        }
      })
      .catch(() => {
        // On error (RLS, network), assume valid to not block the login redirect
        setTenantSlugValid(true);
      });
  }, [effectiveLoading, effectiveAdmin, effectiveTenant, tenantSlug]);

  // Main verification effect with total wait timeout
  useEffect(() => {
    logger.debug('[PROTECTED ROUTE] 🔒 Verification check starting', {
      verified,
      skipVerification,
      loading: effectiveLoading,
      hasAdmin: !!effectiveAdmin,
      hasTenant: !!effectiveTenant,
      tenantSlug,
      pathname: location.pathname,
    });

    // Skip if already verified or skipped - MUST be first check to prevent loops
    if (verified || skipVerification) {
      logger.debug('[PROTECTED ROUTE] ⏩ Skipping verification (already verified or skipped)');
      return;
    }

    // CRITICAL FIX: If auth is complete (not loading) and we have admin/tenant, skip verification
    // This prevents infinite loading when auth completes successfully
    if (!effectiveLoading && effectiveAdmin && effectiveTenant && effectiveTenant.slug === tenantSlug) {
      logger.debug('[PROTECTED ROUTE] ✅ Auth complete and valid - bypassing verification');
      setVerified(true);
      setSkipVerification(true);
      return;
    }

    // Track total wait time
    if (!totalWaitStartRef.current) {
      totalWaitStartRef.current = Date.now();
      logger.debug('[PROTECTED ROUTE] ⏱️ Starting total wait timer');
    }

    // Total wait timeout: redirect to login after 15 seconds instead of granting access
    const totalWaitTimeout = setTimeout(() => {
      const totalWait = Date.now() - (totalWaitStartRef.current || Date.now());
      if (totalWait >= TOTAL_WAIT_TIMEOUT_MS && !verified && !skipVerification) {
        logger.debug('[PROTECTED ROUTE] ⏰ Total wait timeout triggered - redirecting to login', { totalWait });
        logger.warn(`Total wait timeout (${totalWait}ms) - redirecting to login for security`, undefined, 'TenantAdminProtectedRoute');
        setSkipVerification(true);
        setVerifying(false);
        setVerified(false); // CRITICAL: Do NOT allow access after timeout - redirect to login
        verificationLockRef.current = false;
      }
    }, TOTAL_WAIT_TIMEOUT_MS);

    // If auth is still loading, wait (but with timeout protection)
    if (effectiveLoading) {
      logger.debug('[PROTECTED ROUTE] ⏳ Auth context still loading, waiting...');
      const loadingTimeout = setTimeout(() => {
        if (effectiveLoading && !verified && !skipVerification) {
          logger.debug('[PROTECTED ROUTE] ⚠️ Auth context loading timeout (>10s) - redirecting to login');
          logger.warn('Auth context loading timeout (>10s) - redirecting to login for security', undefined, 'TenantAdminProtectedRoute');
          setSkipVerification(true);
          setVerifying(false);
          setVerified(false); // CRITICAL: Do NOT allow access after timeout
          verificationLockRef.current = false;
        }
      }, 10000);

      return () => {
        clearTimeout(loadingTimeout);
        clearTimeout(totalWaitTimeout);
      };
    }

    // If not authenticated, don't verify - let the redirect happen
    if (!effectiveAdmin || !effectiveTenant) {
      logger.debug('[PROTECTED ROUTE] ❌ Not authenticated, will redirect to login');
      clearTimeout(totalWaitTimeout);
      setVerifying(false);
      setVerified(false);
      return;
    }

    logger.debug('[PROTECTED ROUTE] ✅ Auth context loaded', {
      adminEmail: effectiveAdmin.email,
      tenantSlug: effectiveTenant.slug,
      authMethod: 'Supabase',
    });

    // Skip if already checking
    if (verifying) {
      logger.debug('[PROTECTED ROUTE] 🔄 Already verifying, skipping duplicate check');
      return () => clearTimeout(totalWaitTimeout);
    }

    // Use lock to prevent race conditions
    if (verificationLockRef.current) {
      logger.debug('[PROTECTED ROUTE] 🔒 Verification locked, skipping duplicate check');
      return () => clearTimeout(totalWaitTimeout);
    }

    // Check cache
    const cacheKey = `${tenantSlug}-${location.pathname}`;
    const cached = verificationCache.current[cacheKey];
    if (cached && Date.now() - cached.timestamp < VERIFICATION_CACHE_DURATION) {
      logger.debug('[PROTECTED ROUTE] 💾 Using cached verification result');
      clearTimeout(totalWaitTimeout);
      setVerified(true);
      return;
    }

    logger.debug('[PROTECTED ROUTE] 🔐 Starting local verification with retry logic...');
    // Lock verification to prevent concurrent requests
    verificationLockRef.current = true;
    setVerifying(true);
    setVerificationError(null);

    // Set verification timeout (5 seconds)
    const verificationTimeout = setTimeout(() => {
      if (!verified && !skipVerification) {
        logger.debug('[PROTECTED ROUTE] ⏰ Verification timeout triggered');
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
        const isValidSlug = effectiveTenant.slug === tenantSlug;
        logger.debug('[PROTECTED ROUTE] 🔍 Slug validation', {
          urlSlug: tenantSlug,
          tenantSlug: effectiveTenant.slug,
          isValid: isValidSlug,
          attempt: retryCount + 1,
        });

        if (!isValidSlug) {
          logger.debug('[PROTECTED ROUTE] ❌ Slug mismatch detected!');
          const { showErrorToast } = await import('@/lib/toastUtils');
          const { emitAuthError } = await import('@/hooks/useAuthError');

          const errorMessage = "Tenant mismatch. You may be logged into a different account.";
          showErrorToast(errorMessage, "Please log in with the correct account.");
          emitAuthError({ message: errorMessage, code: 'TENANT_MISMATCH' });

          setVerificationError(errorMessage);
          return false;
        }

        // Verification passed
        logger.debug('[PROTECTED ROUTE] ✅ Verification passed!');
        return true;
      } catch (error) {
        const message = handleError(error, {
          component: 'TenantAdminProtectedRoute',
          showToast: false,
          context: { action: 'verification_failed', retryCount }
        });

        // Retry with exponential backoff
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 500; // 500ms, 1s, 2s
          logger.debug(`[PROTECTED ROUTE] 🔄 Retrying verification in ${delay}ms (attempt ${retryCount + 1}/${maxRetries + 1})`);

          await new Promise(resolve => setTimeout(resolve, delay));
          return verifyWithRetry(retryCount + 1);
        }

        // Final failure after retries
        const { showErrorToast } = await import('@/lib/toastUtils');
        const { emitAuthError } = await import('@/hooks/useAuthError');

        let errorMessage = 'Verification failed after multiple attempts.';
        let errorCode = 'VERIFICATION_FAILED';

        if (message.includes('network')) {
          errorMessage = 'Network error during verification. Please check your connection.';
          errorCode = 'NETWORK_ERROR';
        } else if (message.includes('timeout')) {
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
      logger.error('[PROTECTED ROUTE] ❌ Unexpected verification error:', error);
      clearTimeout(verificationTimeout);
      clearTimeout(totalWaitTimeout);
      setVerifying(false);
      verificationLockRef.current = false;
    });

    return () => {
      clearTimeout(totalWaitTimeout);
      clearTimeout(verificationTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- verified, skipVerification, and verifying are intentionally omitted to prevent infinite verification loops
  }, [tenantSlug, location.pathname, effectiveAdmin, effectiveTenant, effectiveLoading]);

  // Show spinner while auth is initializing — prevents flash of login page
  if (!initialized) {
    return <LoadingFallback />;
  }

  // Loading state - wait for auth AND verification (unless skipped OR not authenticated)
  // If user is not authenticated (no admin/tenant), let it fall through to redirect
  if ((effectiveLoading || verifying || (!verified && (effectiveAdmin || effectiveTenant))) && !skipVerification) {
    return <LoadingFallback />;
  }

  // Not authenticated - check tenant exists then redirect to login
  if (!effectiveAdmin || !effectiveTenant) {
    // If tenant slug was checked and doesn't exist, show "Business not found"
    if (tenantSlugValid === false) {
      return <TenantNotFoundPage />;
    }

    // Still checking tenant existence, show loading
    if (tenantSlugValid === null && tenantSlug) {
      return <LoadingFallback />;
    }

    // Save the current path as intended destination before redirecting to login
    const currentPath = location.pathname + location.search;
    intendedDestinationUtils.save(currentPath);
    logger.debug('[PROTECTED ROUTE] Saved intended destination before login redirect', { currentPath });

    // Extract tenant slug from URL path
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const tenantSlugFromUrl = pathSegments[0];

    // Validate slug: not 'undefined', not a UUID, not empty
    const isValidSlug = tenantSlugFromUrl &&
      tenantSlugFromUrl !== 'undefined' &&
      !tenantSlugFromUrl.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    // Try URL slug first, then fallback to localStorage, then saas/login
    const redirectSlug = isValidSlug ? tenantSlugFromUrl :
      localStorage.getItem(STORAGE_KEYS.LAST_TENANT_SLUG);

    if (redirectSlug) {
      logger.debug('[PROTECTED ROUTE] Redirecting to tenant login', { redirectSlug, intendedDestination: currentPath });
      return <Navigate to={`/saas/login?tenant=${redirectSlug}`} replace />;
    }

    logger.debug('[PROTECTED ROUTE] No valid slug found, redirecting to saas login');
    return <Navigate to="/saas/login" replace />;
  }

  // Tenant slug mismatch
  if (effectiveTenant.slug !== tenantSlug) {
    return <Navigate to={`/${effectiveTenant.slug}/admin`} replace />;
  }

  // Check if payment method is required and not added
  // For Clerk users, we need to fetch tenant data from Supabase
  const needsPaymentMethod = !effectiveTenant?.payment_method_added &&
    effectiveTenant?.subscription_status !== 'active';
  const isOnSelectPlanPage = location.pathname.includes('/select-plan');
  const isOnboardingRoute = location.pathname.includes('/admin/welcome') ||
    location.pathname.includes('/admin/onboarding');

  // Redirect to plan selection if payment method not added (except if already on select-plan or onboarding)
  // Note: For Clerk users, payment method check may need to be fetched from Supabase
  if (needsPaymentMethod && !isOnSelectPlanPage && !isOnboardingRoute && effectiveTenant) {
    logger.debug('[PROTECTED ROUTE] Payment method not added, redirecting to plan selection');
    return <Navigate to={`/${effectiveTenant.slug}/admin/select-plan`} replace state={{ fromDashboard: true }} />;
  }

  // Show error UI after multiple failures
  if (verificationError) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4">
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
              onClick={() => navigate('/saas/login')}
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
