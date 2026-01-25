import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission } from '@/lib/permissions/rolePermissions';

export interface PermissionGuardProps {
  /** Required permission(s) - use 'required' or 'permission' (both work) */
  required?: Permission | Permission[];
  /** @deprecated Use 'required' instead. Alias for backwards compatibility. */
  permission?: Permission | Permission[];
  children: ReactNode;
  fallback?: ReactNode;
  requireAll?: boolean;
  /** Whether to show access denied message when permission is denied */
  showMessage?: boolean;
}

export function PermissionGuard({
  required,
  permission,
  children,
  fallback,
  requireAll = true,
  showMessage = true,
}: PermissionGuardProps) {
  const { checkPermission, checkAnyPermission, checkAllPermissions, isLoading } = usePermissions();

  // Support both 'required' and 'permission' prop names
  const permissionToCheck = required ?? permission;

  if (isLoading) {
    return null;
  }

  if (!permissionToCheck) {
    // No permission specified, render children
    return <>{children}</>;
  }

  const hasAccess = Array.isArray(permissionToCheck)
    ? requireAll
      ? checkAllPermissions(permissionToCheck)
      : checkAnyPermission(permissionToCheck)
    : checkPermission(permissionToCheck);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showMessage) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        You don't have permission to access this resource.
      </div>
    );
  }

  return null;
}
