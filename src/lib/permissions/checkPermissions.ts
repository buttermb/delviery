import { logger } from '@/lib/logger';
/**
 * Permission Check Utilities
 * Functions for checking user permissions in components and edge functions
 */

import { hasRolePermission, Role, Permission, ROLES, mapDatabaseRoleToSystemRole, getRolePermissions } from './rolePermissions';

/**
 * Check if a role has a specific permission
 * @param role - User role (from database or system)
 * @param permission - Permission to check (format: 'resource:action')
 * @returns true if role has permission, false otherwise
 */
export function hasPermission(role: Role | string | null | undefined, permission: Permission): boolean {
  if (!role) {
    logger.debug('Permission check failed: no role provided', { permission });
    return false;
  }

  // Map database role to system role if needed
  const systemRole = typeof role === 'string' && !Object.values(ROLES).includes(role as Role)
    ? mapDatabaseRoleToSystemRole(role)
    : (role as Role);

  return hasRolePermission(systemRole, permission);
}

/**
 * Check permission and throw error if denied
 * Use this in edge functions or critical paths where denial should fail fast
 * @param role - User role
 * @param permission - Permission to check
 * @throws Error if permission denied
 */
export function checkPermission(role: Role | string | null | undefined, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    const error = new Error(`Permission denied: ${permission} required`);
    logger.warn('Permission check failed', error, { role, permission });
    throw error;
  }
}

/**
 * Get all permissions for a user role
 * @param role - User role (from database or system)
 * @returns Array of permissions the role has access to
 */
export function getUserPermissions(role: Role | string | null | undefined): Permission[] {
  if (!role) {
    return [];
  }

  // Map database role to system role if needed
  const systemRole = typeof role === 'string' && !Object.values(ROLES).includes(role as Role)
    ? mapDatabaseRoleToSystemRole(role)
    : (role as Role);

  return getRolePermissions(systemRole);
}

/**
 * Check if user has any of the specified permissions
 * @param role - User role
 * @param permissions - Array of permissions to check
 * @returns true if user has at least one permission
 */
export function hasAnyPermission(role: Role | string | null | undefined, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if user has all of the specified permissions
 * @param role - User role
 * @param permissions - Array of permissions to check
 * @returns true if user has all permissions
 */
export function hasAllPermissions(role: Role | string | null | undefined, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

