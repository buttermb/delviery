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

// Verification timeout - 5 seconds
const VERIFICATION_TIMEOUT = 5000;
// Cache verification results for 2 minutes
const VERIFICATION_CACHE_DURATION = 2 * 60 * 1000;

export function TenantAdminProtectedRoute({ children }: TenantAdminProtectedRouteProps) {
  const { admin, tenant, token, loading } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const location = useLocation();
  
  // Use lock to prevent concurrent verification requests
  const verificationLockRef = useRef(false);
  
  // Cache verification results to avoid repeated checks
  const verificationCache = useRef<Record<string, { verified: boolean; timestamp: number }>>({});
  
  // Safety timeout to unlock verification if it gets stuck
  useEffect(() => {
    if (!verifying) return;
    
    const timeout = setTimeout(() => {
      if (verificationLockRef.current) {
        console.warn('[TenantAdminProtectedRoute] Verification timeout - unlocking');
        verificationLockRef.current = false;
        setVerifying(false);
      }
    }, VERIFICATION_TIMEOUT);
    
    return () => clearTimeout(timeout);
  }, [verifying]);

  // Trigger verification when URL changes or initial mount
  useEffect(() => {
    // Skip if not authenticated
    if (!admin || !tenant) {
      // If auth is loaded but no admin/tenant, stop verifying
      if (!loading) {
        setVerifying(false);
      }
      return;
    }

    // Use lock to prevent race conditions
    if (verificationLockRef.current) {
      return;
    }

    // Check cache
    const cacheKey = `${tenantSlug}-${location.pathname}`;
    const cached = verificationCache.current[cacheKey];
    if (cached && Date.now() - cached.timestamp < VERIFICATION_CACHE_DURATION) {
      setVerified(true);
      setVerifying(false);
      return;
    }

    // Lock verification to prevent concurrent requests
    verificationLockRef.current = true;
    setVerifying(true);
    setVerificationError(null);

    // Local verification: compare tenant slug from URL with authenticated tenant
    const isValidSlug = tenant.slug === tenantSlug;
    
    if (!isValidSlug) {
      setVerificationError("Tenant mismatch. Please re-login.");
      setVerified(false);
      setVerifying(false);
      verificationLockRef.current = false;
      return;
    }

    // If we reach here, verification passed
    verificationCache.current[cacheKey] = {
      verified: true,
      timestamp: Date.now(),
    };
    
    setVerified(true);
    setVerifying(false);
    verificationLockRef.current = false;
  }, [tenantSlug, location.pathname, admin, tenant, loading]);

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
