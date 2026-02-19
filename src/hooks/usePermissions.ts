import { useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { hasPermission } from '@/lib/permissions/checkPermissions';
import { ROLES, Role, Permission, mapSystemRoleToDatabaseRole } from '@/lib/permissions/rolePermissions';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

/**
 * usePermissions Hook
 * Role-based permission checking using new permission system
 *
 * Provides module-based permission checks for common operations:
 * - canView(module): Check if user can view a module
 * - canEdit(module): Check if user can edit/modify a module
 * - canDelete(module): Check if user can delete items in a module
 * - canExport(module): Check if user can export data from a module
 */

/**
 * Supported modules for permission checks
 */
export type PermissionModule =
  | 'orders'
  | 'products'
  | 'customers'
  | 'vendors'
  | 'inventory'
  | 'analytics'
  | 'settings'
  | 'menus'
  | 'wholesale-orders'
  | 'finance'
  | 'team'
  | 'reports'
  | 'fleet'
  | 'api';

/**
 * Module-to-permission mapping for different actions
 * Maps each module to its corresponding permission strings
 */
const MODULE_PERMISSION_MAP: Record<PermissionModule, {
  view: Permission;
  edit: Permission;
  delete: Permission;
  export: Permission;
}> = {
  orders: {
    view: 'orders:view',
    edit: 'orders:edit',
    delete: 'orders:delete',
    export: 'reports:export',
  },
  products: {
    view: 'products:view',
    edit: 'products:edit',
    delete: 'products:delete',
    export: 'reports:export',
  },
  customers: {
    view: 'customers:view',
    edit: 'customers:edit',
    delete: 'customers:delete',
    export: 'reports:export',
  },
  vendors: {
    view: 'customers:view', // Vendors use customer permissions
    edit: 'customers:edit',
    delete: 'customers:delete',
    export: 'reports:export',
  },
  inventory: {
    view: 'inventory:view',
    edit: 'inventory:edit',
    delete: 'inventory:delete',
    export: 'reports:export',
  },
  analytics: {
    view: 'reports:view',
    edit: 'reports:view', // Analytics is view-only
    delete: 'reports:view', // No delete for analytics
    export: 'reports:export',
  },
  settings: {
    view: 'settings:view',
    edit: 'settings:edit',
    delete: 'settings:edit', // Settings delete uses edit permission
    export: 'settings:view', // Settings export uses view permission
  },
  menus: {
    view: 'menus:view',
    edit: 'menus:edit',
    delete: 'menus:delete',
    export: 'reports:export',
  },
  'wholesale-orders': {
    view: 'wholesale-orders:view',
    edit: 'wholesale-orders:edit',
    delete: 'wholesale-orders:delete',
    export: 'reports:export',
  },
  finance: {
    view: 'finance:view',
    edit: 'finance:edit',
    delete: 'finance:edit',
    export: 'finance:reports',
  },
  team: {
    view: 'team:view',
    edit: 'team:edit',
    delete: 'team:remove',
    export: 'team:view',
  },
  reports: {
    view: 'reports:view',
    edit: 'reports:view',
    delete: 'reports:view',
    export: 'reports:export',
  },
  fleet: {
    view: 'fleet:view',
    edit: 'fleet:manage',
    delete: 'fleet:manage',
    export: 'reports:export',
  },
  api: {
    view: 'api:view',
    edit: 'api:manage',
    delete: 'api:manage',
    export: 'api:view',
  },
};

/**
 * Get user role from tenant_users table
 * Falls back to 'owner' if role not found (tenant admin always has owner permissions)
 */
export function usePermissions() {
  const { admin, tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Realtime subscription: auto-invalidate role query when tenant_users record changes
  useEffect(() => {
    if (!admin?.userId || !tenant?.id) return;

    const channel = supabase
      .channel(`role-change-${admin.userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenant_users',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const updated = payload.new as { user_id?: string; role?: string };
          if (updated.user_id === admin.userId) {
            logger.info('Role change detected via realtime, refreshing permissions', {
              newRole: updated.role,
              component: 'usePermissions',
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.permissions.all });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [admin?.userId, tenant?.id, queryClient]);

  // Fetch user roles from user_roles table
  const { data: userRole } = useQuery<Role>({
    queryKey: queryKeys.permissions.role(admin?.userId, tenant?.id),
    queryFn: async () => {
      // SECURITY: Default to least privilege (VIEWER) when context is missing
      if (!admin?.userId || !tenant?.id) return ROLES.VIEWER;

      try {
        // Check if user is super admin first (highest privilege)
        const { data: superAdminRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', admin.userId)
          .eq('role', 'super_admin')
          .maybeSingle();

        if (superAdminRole) {
          return ROLES.OWNER; // Super admins have owner-level permissions
        }

        // Check if user is tenant owner
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('owner_email')
          .eq('id', tenant.id)
          .maybeSingle();

        if (tenantData?.owner_email?.toLowerCase() === admin.email?.toLowerCase()) {
          return ROLES.OWNER;
        }

        // Get role from user_roles table for tenant context
        const { data: userRoles, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', admin.userId);

        if (error) {
          logger.warn('Error fetching user roles', error, { component: 'usePermissions' });
          // SECURITY: Default to least privilege on error
          return ROLES.VIEWER;
        }

        if (!userRoles || userRoles.length === 0) {
          // SECURITY: Default to least privilege if no roles found
          return ROLES.VIEWER;
        }

        // Get highest privilege role
        const rolePriority = [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER, ROLES.VIEWER];
        for (const priorityRole of rolePriority) {
          const dbRole = mapSystemRoleToDatabaseRole(priorityRole);
          if (userRoles.some((r: { role: string }) => r.role === dbRole)) {
            return priorityRole;
          }
        }

        return ROLES.VIEWER; // Default to viewer if no matching role
      } catch (error) {
        logger.warn('Error fetching user role', error, { component: 'usePermissions' });
        // SECURITY: Default to least privilege on error
        return ROLES.VIEWER;
      }
    },
    enabled: !!admin?.userId && !!tenant?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  // SECURITY: Default to least privilege (VIEWER) while role is loading
  const role: Role = userRole || ROLES.VIEWER;

  const checkPermission = useMemo(() => {
    return (permission: Permission): boolean => {
      return hasPermission(role, permission);
    };
  }, [role]);

  const checkAnyPermission = useMemo(() => {
    return (permissions: Permission[]): boolean => {
      return permissions.some(perm => hasPermission(role, perm));
    };
  }, [role]);

  const checkAllPermissions = useMemo(() => {
    return (permissions: Permission[]): boolean => {
      return permissions.every(perm => hasPermission(role, perm));
    };
  }, [role]);

  /**
   * Check if user can view a specific module
   * @param module - The module to check (orders, products, customers, etc.)
   * @returns true if user has view permission for the module
   */
  const canView = useCallback(
    (module: PermissionModule): boolean => {
      const modulePermissions = MODULE_PERMISSION_MAP[module];
      if (!modulePermissions) {
        logger.warn('Unknown module for permission check', { module, component: 'usePermissions' });
        return false;
      }
      return hasPermission(role, modulePermissions.view);
    },
    [role]
  );

  /**
   * Check if user can edit/modify items in a specific module
   * @param module - The module to check
   * @returns true if user has edit permission for the module
   */
  const canEdit = useCallback(
    (module: PermissionModule): boolean => {
      const modulePermissions = MODULE_PERMISSION_MAP[module];
      if (!modulePermissions) {
        logger.warn('Unknown module for permission check', { module, component: 'usePermissions' });
        return false;
      }
      return hasPermission(role, modulePermissions.edit);
    },
    [role]
  );

  /**
   * Check if user can delete items in a specific module
   * @param module - The module to check
   * @returns true if user has delete permission for the module
   */
  const canDelete = useCallback(
    (module: PermissionModule): boolean => {
      const modulePermissions = MODULE_PERMISSION_MAP[module];
      if (!modulePermissions) {
        logger.warn('Unknown module for permission check', { module, component: 'usePermissions' });
        return false;
      }
      return hasPermission(role, modulePermissions.delete);
    },
    [role]
  );

  /**
   * Check if user can export data from a specific module
   * @param module - The module to check
   * @returns true if user has export permission for the module
   */
  const canExport = useCallback(
    (module: PermissionModule): boolean => {
      const modulePermissions = MODULE_PERMISSION_MAP[module];
      if (!modulePermissions) {
        logger.warn('Unknown module for permission check', { module, component: 'usePermissions' });
        return false;
      }
      return hasPermission(role, modulePermissions.export);
    },
    [role]
  );

  /**
   * Memoized object containing all module permissions for the current user
   * Useful for components that need to check multiple permissions at once
   */
  const modulePermissions = useMemo(() => {
    const modules: PermissionModule[] = [
      'orders',
      'products',
      'customers',
      'vendors',
      'inventory',
      'analytics',
      'settings',
      'menus',
      'wholesale-orders',
      'finance',
      'team',
      'reports',
      'fleet',
      'api',
    ];

    return modules.reduce(
      (acc, module) => {
        const permissions = MODULE_PERMISSION_MAP[module];
        acc[module] = {
          canView: hasPermission(role, permissions.view),
          canEdit: hasPermission(role, permissions.edit),
          canDelete: hasPermission(role, permissions.delete),
          canExport: hasPermission(role, permissions.export),
        };
        return acc;
      },
      {} as Record<PermissionModule, { canView: boolean; canEdit: boolean; canDelete: boolean; canExport: boolean }>
    );
  }, [role]);

  return {
    // Role info
    role,
    isLoading: !userRole && !!admin?.userId && !!tenant?.id,

    // Legacy permission checks
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,
    hasPermission: checkPermission,

    // Module-based permission checks
    canView,
    canEdit,
    canDelete,
    canExport,

    // Precomputed module permissions
    modulePermissions,
  };
}

