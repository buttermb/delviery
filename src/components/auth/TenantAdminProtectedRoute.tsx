import { ReactNode, useEffect, useState, useRef } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { LoadingFallback } from '@/components/LoadingFallback';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { VerificationProvider } from '@/contexts/VerificationContext';

interface TenantAdminProtectedRouteProps {
  children: ReactNode;
}

// Verification timeout - 8 seconds
const VERIFICATION_TIMEOUT_MS = 8000;
// Network timeout - 2 seconds (edge function is optimized)
const NETWORK_TIMEOUT_MS = 2000;
// Cache verification results for 2 minutes
const VERIFICATION_CACHE_MS = 2 * 60 * 1000;

export function TenantAdminProtectedRoute({ children }: TenantAdminProtectedRouteProps) {
  const { admin, tenant, token, loading } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationAttempts, setVerificationAttempts] = useState(0);
  const location = useLocation();
  
  // Track auth values in refs to avoid re-triggering verification
  const authRef = useRef({ token, admin, tenant });
  const verificationLockRef = useRef(false);

  // Cache verification results to avoid repeated API calls
  const verificationCache = useRef(new Map<string, { result: boolean; timestamp: number }>());

  const isVerificationCacheValid = (email: string, tenantSlug: string): boolean => {
    const cacheKey = `${email}:${tenantSlug}`;
    const cached = verificationCache.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < VERIFICATION_CACHE_MS) {
      return cached.result;
    }
    return false;
  };

  // Update auth refs when auth changes (doesn't trigger verification)
  useEffect(() => {
    authRef.current = { token, admin, tenant };
  }, [token, admin, tenant]);

  // Main verification effect - only depends on tenantSlug and location
  useEffect(() => {
    // Skip if already verified
    if (verified) {
      console.log('[TenantAdminProtectedRoute] Already verified, skipping');
      return;
    }

    // Prevent concurrent verification attempts
    if (verificationLockRef.current) {
      console.log('[TenantAdminProtectedRoute] Verification in progress, skipping');
      return;
    }

    const verifyAccess = () => {
      const { token: currentToken, admin: currentAdmin, tenant: currentTenant } = authRef.current;
      
      if (!currentToken || !currentAdmin || !currentTenant || !tenantSlug) {
        console.log('[TenantAdminProtectedRoute] Waiting for auth data...');
        setVerifying(false);
        return;
      }

      // Lock verification
      verificationLockRef.current = true;

      // Check cache first
      if (isVerificationCacheValid(currentAdmin.email, tenantSlug)) {
        console.log('[TenantAdminProtectedRoute] Using cached verification result');
        setVerified(true);
        setVerifying(false);
        setVerificationError(null);
        verificationLockRef.current = false;
        return;
      }

      console.log('[TenantAdminProtectedRoute] Starting verification...');
      setVerifying(true);
      setVerificationError(null);

      try {
        // Simple local verification: check if tenant slug matches
        // Auth context already validated user has access to this tenant
        if (currentTenant.slug.toLowerCase() !== tenantSlug.toLowerCase()) {
          console.error('[TenantAdminProtectedRoute] Tenant slug mismatch');
          setVerificationError('Access denied - tenant mismatch');
          setVerifying(false);
          verificationLockRef.current = false;
          return;
        }

        // Cache successful verification
        const cacheKey = `${currentAdmin.email}:${tenantSlug}`;
        verificationCache.current.set(cacheKey, {
          result: true,
          timestamp: Date.now()
        });

        console.log('[TenantAdminProtectedRoute] Verification successful');
        setVerified(true);
        setVerifying(false);
        setVerificationError(null);
        verificationLockRef.current = false;
      } catch (err) {
        console.error('[TenantAdminProtectedRoute] Verification error:', err);
        setVerificationAttempts(prev => prev + 1);
        
        if (verificationAttempts >= 2) {
          setVerificationError('Verification failed. Please try again.');
          setVerifying(false);
          verificationLockRef.current = false;
        } else {
          verificationLockRef.current = false;
          setTimeout(() => verifyAccess(), 500);
        }
      }
    };

    verifyAccess();

    // Safety timeout
    const timeout = setTimeout(() => {
      if (verifying && !verified) {
        console.error('[TenantAdminProtectedRoute] Verification timeout');
        setVerificationError('Verification timed out. Please try again.');
        setVerifying(false);
        verificationLockRef.current = false;
      }
    }, VERIFICATION_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [tenantSlug, location.pathname]); // Only re-run if tenantSlug or route changes

  // Loading state - wait for auth AND verification
  if (loading || verifying || !verified) {
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
                setVerificationAttempts(0);
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

  // Success - render protected content with verification context
  return (
    <VerificationProvider>
      {children}
    </VerificationProvider>
  );
}
