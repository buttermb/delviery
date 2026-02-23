import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/lib/permissions/rolePermissions';

interface PermissionGuardProps {
  required: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
  requireAll?: boolean;
}

export function PermissionGuard({
  required,
  children,
  fallback,
  requireAll = true,
}: PermissionGuardProps) {
  const { checkPermission, checkAnyPermission, checkAllPermissions, isLoading } = usePermissions();

  if (isLoading) {
    return null;
  }

  const hasAccess = Array.isArray(required)
    ? requireAll
      ? checkAllPermissions(required)
      : checkAnyPermission(required)
    : checkPermission(required);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return null;
}
