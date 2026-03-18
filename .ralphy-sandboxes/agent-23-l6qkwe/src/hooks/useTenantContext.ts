/**
 * Unified Tenant Context Hook
 *
 * Wraps useTenantAdminAuth() and provides commonly needed derived state.
 * Use this hook instead of calling useTenantAdminAuth() directly in admin components.
 *
 * Benefits:
 * - Memoized derived values for better performance
 * - Convenient access to commonly used properties
 * - Role-based permission checks
 */

import { useMemo } from 'react';

import { useTenantAdminAuth, type TenantAdminAuthContextType } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

/**
 * Permission strings that can be derived from user roles
 */
export type Permission =
  | 'view:dashboard'
  | 'view:orders'
  | 'manage:orders'
  | 'view:products'
  | 'manage:products'
  | 'view:inventory'
  | 'manage:inventory'
  | 'view:customers'
  | 'manage:customers'
  | 'view:analytics'
  | 'manage:analytics'
  | 'view:settings'
  | 'manage:settings'
  | 'view:team'
  | 'manage:team'
  | 'view:billing'
  | 'manage:billing'
  | 'view:storefront'
  | 'manage:storefront'
  | 'view:menus'
  | 'manage:menus'
  | 'view:deliveries'
  | 'manage:deliveries'
  | 'view:reports'
  | 'manage:reports'
  | 'impersonate:users'
  | 'access:super_admin';

/**
 * Role hierarchy for permission derivation
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: [
    'view:dashboard',
    'view:orders',
    'manage:orders',
    'view:products',
    'manage:products',
    'view:inventory',
    'manage:inventory',
    'view:customers',
    'manage:customers',
    'view:analytics',
    'manage:analytics',
    'view:settings',
    'manage:settings',
    'view:team',
    'manage:team',
    'view:billing',
    'manage:billing',
    'view:storefront',
    'manage:storefront',
    'view:menus',
    'manage:menus',
    'view:deliveries',
    'manage:deliveries',
    'view:reports',
    'manage:reports',
    'impersonate:users',
    'access:super_admin',
  ],
  admin: [
    'view:dashboard',
    'view:orders',
    'manage:orders',
    'view:products',
    'manage:products',
    'view:inventory',
    'manage:inventory',
    'view:customers',
    'manage:customers',
    'view:analytics',
    'manage:analytics',
    'view:settings',
    'manage:settings',
    'view:team',
    'manage:team',
    'view:billing',
    'manage:billing',
    'view:storefront',
    'manage:storefront',
    'view:menus',
    'manage:menus',
    'view:deliveries',
    'manage:deliveries',
    'view:reports',
    'manage:reports',
  ],
  owner: [
    'view:dashboard',
    'view:orders',
    'manage:orders',
    'view:products',
    'manage:products',
    'view:inventory',
    'manage:inventory',
    'view:customers',
    'manage:customers',
    'view:analytics',
    'manage:analytics',
    'view:settings',
    'manage:settings',
    'view:team',
    'manage:team',
    'view:billing',
    'manage:billing',
    'view:storefront',
    'manage:storefront',
    'view:menus',
    'manage:menus',
    'view:deliveries',
    'manage:deliveries',
    'view:reports',
    'manage:reports',
  ],
  manager: [
    'view:dashboard',
    'view:orders',
    'manage:orders',
    'view:products',
    'manage:products',
    'view:inventory',
    'manage:inventory',
    'view:customers',
    'manage:customers',
    'view:analytics',
    'view:settings',
    'view:team',
    'view:storefront',
    'manage:storefront',
    'view:menus',
    'manage:menus',
    'view:deliveries',
    'manage:deliveries',
    'view:reports',
  ],
  staff: [
    'view:dashboard',
    'view:orders',
    'manage:orders',
    'view:products',
    'view:inventory',
    'view:customers',
    'view:menus',
    'view:deliveries',
    'manage:deliveries',
  ],
  viewer: [
    'view:dashboard',
    'view:orders',
    'view:products',
    'view:inventory',
    'view:customers',
    'view:menus',
    'view:deliveries',
    'view:reports',
  ],
  courier: [
    'view:dashboard',
    'view:orders',
    'view:deliveries',
    'manage:deliveries',
  ],
};

/**
 * Admin roles that have administrative privileges
 */
const ADMIN_ROLES = ['super_admin', 'admin', 'owner'];

/**
 * Staff roles that have general access but not full admin privileges
 */
const STAFF_ROLES = ['manager', 'staff', 'courier', 'viewer'];

export interface TenantContextValue {
  // Identity
  tenantId: string | null;
  tenantSlug: string | null;
  userId: string | null;
  userRole: string | null;

  // Role-based flags
  isAdmin: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  isOwner: boolean;
  isManager: boolean;
  isCourier: boolean;

  // Permissions
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;

  // Loading and auth state
  loading: boolean;
  isAuthenticated: boolean;
  isReady: boolean;

  // Full context for advanced usage
  admin: TenantAdminAuthContextType['admin'];
  tenant: TenantAdminAuthContextType['tenant'];

  // Actions from parent context
  logout: TenantAdminAuthContextType['logout'];
  refreshTenant: TenantAdminAuthContextType['refreshTenant'];
}

/**
 * Unified hook for tenant context with commonly needed derived state.
 *
 * @example
 * ```tsx
 * const { tenantId, tenantSlug, isAdmin, hasPermission, isReady } = useTenantContext();
 *
 * if (!isReady) return <Spinner />;
 *
 * if (hasPermission('manage:orders')) {
 *   // Show order management UI
 * }
 * ```
 */
export function useTenantContext(): TenantContextValue {
  const authContext = useTenantAdminAuth();

  const {
    admin,
    tenant,
    tenantSlug,
    loading,
    isAuthenticated,
    logout,
    refreshTenant,
  } = authContext;

  // Derive basic identifiers
  const tenantId = useMemo(() => tenant?.id ?? null, [tenant?.id]);
  const userId = useMemo(() => admin?.userId ?? admin?.id ?? null, [admin?.userId, admin?.id]);
  const userRole = useMemo(() => admin?.role?.toLowerCase() ?? null, [admin?.role]);

  // Derive role-based flags
  const roleFlags = useMemo(() => {
    const role = userRole ?? '';
    return {
      isAdmin: ADMIN_ROLES.includes(role),
      isStaff: STAFF_ROLES.includes(role) || ADMIN_ROLES.includes(role),
      isSuperAdmin: role === 'super_admin',
      isOwner: role === 'owner',
      isManager: role === 'manager',
      isCourier: role === 'courier',
    };
  }, [userRole]);

  // Derive permissions based on role
  const permissions = useMemo((): Permission[] => {
    if (!userRole) return [];
    return ROLE_PERMISSIONS[userRole] ?? [];
  }, [userRole]);

  // Permission check helpers
  const hasPermission = useMemo(
    () => (permission: Permission): boolean => {
      return permissions.includes(permission);
    },
    [permissions]
  );

  const hasAnyPermission = useMemo(
    () => (perms: Permission[]): boolean => {
      return perms.some((p) => permissions.includes(p));
    },
    [permissions]
  );

  const hasAllPermissions = useMemo(
    () => (perms: Permission[]): boolean => {
      return perms.every((p) => permissions.includes(p));
    },
    [permissions]
  );

  // Determine if context is ready for use
  const isReady = useMemo(() => {
    const ready = !loading && isAuthenticated && !!tenantId && !!userId;
    if (!ready && !loading) {
      logger.debug('[useTenantContext] Context not ready', {
        loading,
        isAuthenticated,
        hasTenantId: !!tenantId,
        hasUserId: !!userId,
      });
    }
    return ready;
  }, [loading, isAuthenticated, tenantId, userId]);

  return {
    // Identity
    tenantId,
    tenantSlug: tenantSlug ?? null,
    userId,
    userRole,

    // Role flags
    ...roleFlags,

    // Permissions
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,

    // State
    loading,
    isAuthenticated,
    isReady,

    // Full context
    admin,
    tenant,

    // Actions
    logout,
    refreshTenant,
  };
}

export default useTenantContext;
