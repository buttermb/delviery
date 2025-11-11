/**
 * usePermissions Hook
 * Role-based permission checking using new permission system
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { hasPermission, Permission } from '@/lib/permissions/checkPermissions';
import { ROLES, Role, mapDatabaseRoleToSystemRole } from '@/lib/permissions/rolePermissions';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

/**
 * Get user role from tenant_users table
 * Falls back to 'owner' if role not found (tenant admin always has owner permissions)
 */
export function usePermissions() {
  const { admin, tenant } = useTenantAdminAuth();
  
  // Fetch user role from tenant_users table
  const { data: userRole } = useQuery<Role>({
    queryKey: ['user-role', admin?.id, tenant?.id],
    queryFn: async () => {
      if (!admin?.id || !tenant?.id) return ROLES.OWNER;

      try {
        // Get role from tenant_users table
        // admin.id could be either tenant_users.id or auth.users.id (for owners)
        // So we query by email and tenant_id for reliability
        const { data, error } = await supabase
          .from('tenant_users')
          .select('role')
          .eq('email', admin.email)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (error) {
          logger.warn('Error fetching user role from tenant_users', error, { component: 'usePermissions' });
          return ROLES.OWNER;
        }

        if (!data || !data.role) {
          // No role found in tenant_users - check if user is tenant owner
          // If owner_email matches, they're owner
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('owner_email')
            .eq('id', tenant.id)
            .maybeSingle();

          if (tenantData?.owner_email?.toLowerCase() === admin.email?.toLowerCase()) {
            return ROLES.OWNER;
          }

          // Default to owner if no role found (tenant admin always has owner permissions)
          return ROLES.OWNER;
        }

        // Map database role to system role
        return mapDatabaseRoleToSystemRole(data.role);
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
