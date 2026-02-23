import { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import AccessDeniedPage from '@/pages/admin/AccessDeniedPage';

type AdminRole = 'owner' | 'admin' | 'manager' | 'staff' | 'viewer';

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRoles: AdminRole[];
  fallbackPath?: string;
}

/**
 * Role hierarchy for tenant admin users.
 * Higher roles inherit access from lower roles.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  staff: 40,
  viewer: 20,
};

/**
 * RoleProtectedRoute restricts access to admin pages based on the
 * authenticated user's role. Used within the tenant admin portal
 * to gate pages like settings, team management, etc. to higher roles.
 *
 * Uses a role hierarchy - if the user's role level is >= the minimum
 * required level among allowedRoles, access is granted.
 */
export function RoleProtectedRoute({ children, allowedRoles, fallbackPath }: RoleProtectedRouteProps) {
  const { admin, tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (!admin || !tenant) {
    // Should not happen if used within TenantAdminProtectedRoute, but handle gracefully
    const slug = tenantSlug || tenant?.slug;
    return <Navigate to={slug ? `/${slug}/admin/login` : '/saas/login'} replace />;
  }

  const userRole = (admin.role || 'viewer').toLowerCase();
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;

  // Find minimum required level from allowed roles
  const minRequiredLevel = Math.min(
    ...allowedRoles.map(role => ROLE_HIERARCHY[role] ?? 0)
  );

  if (userLevel >= minRequiredLevel) {
    return <>{children}</>;
  }

  logger.warn('Role access denied', {
    component: 'RoleProtectedRoute',
    userRole,
    allowedRoles,
    path: window.location.pathname,
  });

  // If a specific fallback path is provided, redirect there
  if (fallbackPath) {
    return <Navigate to={fallbackPath} replace />;
  }

  // Show Access Denied page instead of silently redirecting
  return <AccessDeniedPage userRole={userRole} requiredRoles={allowedRoles} />;
}
