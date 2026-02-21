/**
 * ProtectedRoute Component
 *
 * Wrapper component that protects routes using useAuthGuard.
 * Shows a loading spinner while checking auth, redirects to login
 * with a return URL if not authenticated, and optionally checks
 * required role or permissions before rendering children.
 */

import { type ReactNode, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { logger } from '@/lib/logger';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Role, Permission } from '@/lib/permissions/rolePermissions';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Required role for access (uses role hierarchy: owner > admin > team_member > viewer) */
  requiredRole?: Role;
  /** Required permissions for access */
  requiredPermissions?: Permission[];
  /** If true, user needs at least one of the permissions instead of all */
  requireAnyPermission?: boolean;
  /** Custom redirect path for unauthenticated users */
  redirectTo?: string;
  /** Custom fallback component when user lacks role/permissions (defaults to access denied message) */
  accessDeniedFallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermissions,
  requireAnyPermission = false,
  redirectTo,
  accessDeniedFallback,
}: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasRedirected = useRef(false);

  const { isAuthorized, isLoading, user, tenantSlug } = useAuthGuard({
    requiredRole,
    requiredPermissions,
    requireAnyPermission,
    redirectTo,
    enabled: false, // We handle redirect ourselves to include returnUrl
  });

  const isAuthenticated = !!user;

  useEffect(() => {
    if (isLoading || hasRedirected.current) return;

    if (!isAuthenticated) {
      hasRedirected.current = true;
      const currentPath = location.pathname + location.search + location.hash;
      const loginPath = redirectTo ?? getLoginPath(tenantSlug);
      const separator = loginPath.includes('?') ? '&' : '?';
      const loginWithReturn = `${loginPath}${separator}returnUrl=${encodeURIComponent(currentPath)}`;

      logger.debug('[ProtectedRoute] Not authenticated, redirecting to login', {
        loginPath: loginWithReturn,
        returnUrl: currentPath,
      });

      navigate(loginWithReturn, { replace: true });
    }
  }, [isLoading, isAuthenticated, location, navigate, redirectTo, tenantSlug]);

  // Reset redirect flag when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      hasRedirected.current = false;
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isAuthorized) {
    if (accessDeniedFallback) {
      return <>{accessDeniedFallback}</>;
    }

    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 space-y-4">
          <div className="rounded-full bg-destructive/10 p-3 w-12 h-12 mx-auto flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-muted-foreground text-sm">
            You don&apos;t have the required permissions to access this page.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              size="sm"
              onClick={() => navigate(tenantSlug ? `/${tenantSlug}/admin/dashboard` : '/')}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function getLoginPath(tenantSlug: string | undefined): string {
  if (tenantSlug && tenantSlug !== 'undefined') {
    return `/${tenantSlug}/admin/login`;
  }

  try {
    const lastSlug = localStorage.getItem('lastTenantSlug');
    if (lastSlug) {
      return `/${lastSlug}/admin/login`;
    }
  } catch {
    // Ignore storage errors
  }

  return '/saas/login';
}
