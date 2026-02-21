import { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';
import { LoadingFallback } from '@/components/LoadingFallback';
import { intendedDestinationUtils } from '@/hooks/useIntendedDestination';

interface PublicOnlyRouteProps {
  children: ReactNode;
  portal?: 'tenant-admin' | 'super-admin' | 'saas';
}

/**
 * PublicOnlyRoute wraps auth pages (login, signup, etc.) and redirects
 * already-authenticated users to their appropriate dashboard.
 *
 * - For tenant-admin portal: redirects to /:tenantSlug/admin/dashboard
 * - For super-admin portal: redirects to /super-admin/dashboard
 * - For saas portal: redirects based on tenant slug or super admin status
 */
export function PublicOnlyRoute({ children, portal = 'saas' }: PublicOnlyRouteProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { admin, tenant, loading: tenantLoading } = useTenantAdminAuth();
  const { superAdmin, token: superAdminToken, loading: superAdminLoading } = useSuperAdminAuth();

  if (portal === 'super-admin') {
    if (superAdminLoading) {
      return <LoadingFallback />;
    }

    if (superAdmin && superAdminToken) {
      return <Navigate to="/super-admin/dashboard" replace />;
    }

    return <>{children}</>;
  }

  if (portal === 'tenant-admin') {
    if (tenantLoading) {
      return <LoadingFallback />;
    }

    if (admin && tenant) {
      const slug = tenantSlug || tenant.slug;
      // Check for intended destination (user was redirected to login from a deep link)
      const intended = intendedDestinationUtils.consume();
      return <Navigate to={intended || `/${slug}/admin/dashboard`} replace />;
    }

    return <>{children}</>;
  }

  // 'saas' portal - check both auth systems
  const isLoading = tenantLoading || superAdminLoading;

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (superAdmin && superAdminToken) {
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  if (admin && tenant) {
    // Check for intended destination (user was redirected to login from a deep link)
    const intended = intendedDestinationUtils.consume();
    return <Navigate to={intended || `/${tenant.slug}/admin/dashboard`} replace />;
  }

  return <>{children}</>;
}
