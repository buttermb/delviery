import { ReactNode, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import type { Role } from '@/lib/permissions/rolePermissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

interface RoleGuardProps {
  requiredRoles: Role[];
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function RoleGuard({
  requiredRoles,
  children,
  fallback,
  redirectTo,
}: RoleGuardProps) {
  const { role, isLoading } = usePermissions();
  const { admin, tenant, tenantSlug } = useTenantAdminAuth();
  const navigate = useNavigate();
  const hasLoggedRef = useRef(false);

  const isAuthorized = requiredRoles.includes(role);

  useEffect(() => {
    if (isLoading || isAuthorized || hasLoggedRef.current) return;

    hasLoggedRef.current = true;

    logger.warn('Unauthorized access attempt', {
      component: 'RoleGuard',
      userRole: role,
      requiredRoles,
      userId: admin?.userId,
      tenantId: tenant?.id,
      tenantSlug,
    });

    if (redirectTo) {
      navigate(redirectTo, { replace: true });
    }
  }, [isLoading, isAuthorized, role, requiredRoles, admin?.userId, tenant?.id, tenantSlug, redirectTo, navigate]);

  if (isLoading) {
    return null;
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  if (redirectTo) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Alert variant="destructive">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Access Denied</AlertTitle>
      <AlertDescription>
        You do not have the required role to access this resource.
        Required: {requiredRoles.join(', ')}.
      </AlertDescription>
    </Alert>
  );
}
