/**
 * useAuthGuard Hook
 *
 * Checks authentication status and redirects to login if not authenticated.
 * Supports role-based and permission-based access control with tenant context
 * for multi-tenant routes.
 */

import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { logger } from '@/lib/logger';
import type { Role, Permission } from '@/lib/permissions/rolePermissions';

interface UseAuthGuardOptions {
  /** Required role for access (e.g., 'owner', 'admin') */
  requiredRole?: Role;
  /** Required permissions for access (all must be satisfied) */
  requiredPermissions?: Permission[];
  /** If true, user needs at least one of the permissions instead of all */
  requireAnyPermission?: boolean;
  /** Custom redirect path (defaults to tenant login or /saas/login) */
  redirectTo?: string;
  /** Whether the guard is enabled (default: true) */
  enabled?: boolean;
}

interface UseAuthGuardResult {
  /** Whether the user is fully authorized (authenticated + role + permissions) */
  isAuthorized: boolean;
  /** Whether auth state is still loading */
  isLoading: boolean;
  /** The authenticated admin user, or null */
  user: {
    id: string;
    email: string;
    name?: string;
    role: string;
    tenant_id: string;
    userId: string;
  } | null;
  /** The current tenant context */
  tenant: {
    id: string;
    business_name: string;
    slug: string;
  } | null;
  /** The tenant slug from URL params */
  tenantSlug: string | undefined;
}

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  team_member: 2,
  viewer: 1,
};

export function useAuthGuard(options: UseAuthGuardOptions = {}): UseAuthGuardResult {
  const {
    requiredRole,
    requiredPermissions,
    requireAnyPermission = false,
    redirectTo,
    enabled = true,
  } = options;

  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { admin, tenant, loading: authLoading, isAuthenticated } = useTenantAdminAuth();
  const { role: userRole, checkAnyPermission, checkAllPermissions, isLoading: permissionsLoading } = usePermissions();

  const isLoading = authLoading || permissionsLoading;

  const hasRequiredRole = useMemo(() => {
    if (!requiredRole) return true;
    if (!userRole) return false;

    const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
    const userLevel = ROLE_HIERARCHY[userRole as Role] ?? 0;
    return userLevel >= requiredLevel;
  }, [requiredRole, userRole]);

  const hasRequiredPermissions = useMemo(() => {
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    if (requireAnyPermission) {
      return checkAnyPermission(requiredPermissions);
    }
    return checkAllPermissions(requiredPermissions);
  }, [requiredPermissions, requireAnyPermission, checkAnyPermission, checkAllPermissions]);

  const isAuthentic = !!admin && !!tenant && isAuthenticated;
  const isAuthorized = isAuthentic && hasRequiredRole && hasRequiredPermissions;

  useEffect(() => {
    if (!enabled || isLoading) return;

    if (!isAuthentic) {
      const loginPath = redirectTo ?? getLoginPath(tenantSlug);
      logger.debug('[useAuthGuard] Not authenticated, redirecting', {
        loginPath,
        tenantSlug,
      });
      navigate(loginPath, { replace: true });
      return;
    }

    // Tenant slug mismatch check for multi-tenant routes
    if (tenantSlug && tenant && tenant.slug !== tenantSlug) {
      logger.warn('[useAuthGuard] Tenant slug mismatch', {
        urlSlug: tenantSlug,
        tenantSlug: tenant.slug,
      });
      navigate(`/${tenant.slug}/admin`, { replace: true });
      return;
    }

    if (!hasRequiredRole) {
      logger.warn('[useAuthGuard] Insufficient role', {
        requiredRole,
        userRole,
        tenantSlug: tenant?.slug,
      });
    }

    if (!hasRequiredPermissions) {
      logger.warn('[useAuthGuard] Insufficient permissions', {
        requiredPermissions,
        userRole,
        tenantSlug: tenant?.slug,
      });
    }
  }, [
    enabled,
    isLoading,
    isAuthentic,
    hasRequiredRole,
    hasRequiredPermissions,
    tenantSlug,
    tenant,
    redirectTo,
    navigate,
    requiredRole,
    requiredPermissions,
    userRole,
  ]);

  return {
    isAuthorized,
    isLoading,
    user: admin,
    tenant: tenant ? { id: tenant.id, business_name: tenant.business_name, slug: tenant.slug } : null,
    tenantSlug,
  };
}

function getLoginPath(tenantSlug: string | undefined): string {
  if (tenantSlug && tenantSlug !== 'undefined') {
    return `/${tenantSlug}/admin/login`;
  }

  // Try localStorage fallback
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
