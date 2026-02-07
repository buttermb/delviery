/**
 * Permission Guard Component
 * Conditionally renders children based on user permissions
 * Uses the new role-based permission system from src/lib/permissions
 */

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/lib/permissions/rolePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface PermissionGuardProps {
  permission: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
  requireAll?: boolean;
  showMessage?: boolean;
}

export function PermissionGuard({
  permission,
  children,
  fallback,
  requireAll = false,
  showMessage = true,
}: PermissionGuardProps) {
  const { checkPermission, checkAnyPermission, checkAllPermissions } = usePermissions();

  const hasAccess = Array.isArray(permission)
    ? requireAll
      ? checkAllPermissions(permission)
      : checkAnyPermission(permission)
    : checkPermission(permission);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showMessage) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access this resource.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

