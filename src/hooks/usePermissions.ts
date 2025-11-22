import { logger } from '@/lib/logger';
// @ts-nocheck
/**
 * usePermissions Hook
 * Role-based permission checking using new permission system
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { hasPermission } from '@/lib/permissions/checkPermissions';
import { ROLES, Role, mapDatabaseRoleToSystemRole, mapSystemRoleToDatabaseRole } from '@/lib/permissions/rolePermissions';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

/**
 * Get user role from tenant_users table
 * Falls back to 'owner' if role not found (tenant admin always has owner permissions)
 */
export function usePermissions() {
  const { admin, tenant } = useTenantAdminAuth();
  
  // Fetch user roles from user_roles table
  const { data: userRole } = useQuery<Role>({
    queryKey: ['user-role', admin?.id, tenant?.id],
    queryFn: async () => {
      if (!admin?.id || !tenant?.id) return ROLES.OWNER;

      try {
        // Check if user is super admin first (highest privilege)
        const { data: superAdminRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', admin.id)
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
          .eq('user_id', admin.id);

        if (error) {
          logger.warn('Error fetching user roles', error, { component: 'usePermissions' });
          return ROLES.OWNER;
        }

        if (!userRoles || userRoles.length === 0) {
          // Default to owner if no roles found
          return ROLES.OWNER;
        }

        // Get highest privilege role
        const rolePriority = [ROLES.OWNER, ROLES.ADMIN, ROLES.TEAM_MEMBER, ROLES.VIEWER];
        for (const priorityRole of rolePriority) {
          const dbRole = mapSystemRoleToDatabaseRole(priorityRole);
          if (userRoles.some((r: any) => r.role === dbRole)) {
            return priorityRole;
          }
        }

        return ROLES.VIEWER; // Default to viewer if no matching role
      } catch (error) {
        logger.warn('Error fetching user role', error, { component: 'usePermissions' });
        return ROLES.OWNER;
      }
    },
    enabled: !!admin?.id && !!tenant?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  // Default to 'owner' for tenant admins if role not yet loaded
  const role: Role = userRole || ROLES.OWNER;

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

  return {
    role,
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,
    hasPermission: checkPermission,
    isLoading: !userRole && !!admin?.id && !!tenant?.id,
  };
}
