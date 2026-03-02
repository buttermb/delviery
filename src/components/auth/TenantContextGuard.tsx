import { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { LoadingFallback } from '@/components/LoadingFallback';
import { logger } from '@/lib/logger';

interface TenantContextGuardProps {
  children: ReactNode;
}

/**
 * TenantContextGuard ensures that the tenant context (admin + tenant data)
 * is fully loaded before rendering protected admin routes.
 *
 * This prevents flashing of unauthorized content or incorrect tenant data
 * while the auth context is still initializing. It sits between
 * TenantAdminProtectedRoute and the actual page content.
 *
 * If tenant data is loaded but the slug doesn't match the URL, it redirects
 * to the correct tenant's admin panel.
 */
export function TenantContextGuard({ children }: TenantContextGuardProps) {
  const { admin, tenant, loading } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  // Still loading auth context - show loading state
  if (loading) {
    return <LoadingFallback />;
  }

  // Not authenticated - redirect to login
  if (!admin || !tenant) {
    logger.debug('[TenantContextGuard] No auth data, redirecting to login', {
      component: 'TenantContextGuard',
      hasAdmin: !!admin,
      hasTenant: !!tenant,
      tenantSlug,
    });

    if (tenantSlug) {
      return <Navigate to={`/saas/login?tenant=${tenantSlug}`} replace />;
    }
    return <Navigate to="/saas/login" replace />;
  }

  // Tenant slug mismatch - redirect to correct tenant
  if (tenantSlug && tenant.slug !== tenantSlug) {
    logger.warn('[TenantContextGuard] Tenant slug mismatch, redirecting', {
      component: 'TenantContextGuard',
      urlSlug: tenantSlug,
      tenantSlug: tenant.slug,
    });
    return <Navigate to={`/${tenant.slug}/admin/dashboard`} replace />;
  }

  // Tenant context is loaded and valid - render children
  return <>{children}</>;
}
