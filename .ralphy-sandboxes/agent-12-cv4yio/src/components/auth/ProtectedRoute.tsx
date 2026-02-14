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
        <div className="text-center max-w-md mx-auto p-6">
          <div className="rounded-full bg-destructive/10 p-3 w-12 h-12 mx-auto mb-4 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-sm">
            You don&apos;t have the required permissions to access this page.
          </p>
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
