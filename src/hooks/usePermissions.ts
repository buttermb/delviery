/**
 * usePermissions Hook
 * Role-based permission checking
 */

import { useMemo } from 'react';
import { hasPermission, Permission, Role } from '@/lib/constants/permissions';

// Get user role from context - for now defaulting to 'owner'
// In production, this should come from auth context
export function usePermissions() {
  // TODO: Get from auth context
  const role: Role = 'owner';

  const checkPermission = (permission: Permission): boolean => {
    return hasPermission(role, permission);
  };

  const checkAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(perm => hasPermission(role, perm));
  };

  const checkAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(perm => hasPermission(role, perm));
  };

  return {
    role,
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,
    hasPermission: checkPermission,
  };
}

