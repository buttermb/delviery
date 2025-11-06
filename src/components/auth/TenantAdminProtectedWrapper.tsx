/**
 * Tenant Admin Protected Wrapper
 * Combines AuthErrorBoundary with TenantAdminProtectedRoute
 */

import { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { AuthErrorBoundary } from './AuthErrorBoundary';
import { TenantAdminProtectedRoute } from './TenantAdminProtectedRoute';

interface TenantAdminProtectedWrapperProps {
  children: ReactNode;
}

export function TenantAdminProtectedWrapper({ children }: TenantAdminProtectedWrapperProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  return (
    <AuthErrorBoundary userType="tenant_admin" tenantSlug={tenantSlug}>
      <TenantAdminProtectedRoute>
        {children}
      </TenantAdminProtectedRoute>
    </AuthErrorBoundary>
  );
}
