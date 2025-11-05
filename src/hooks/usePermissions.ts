/**
 * usePermissions Hook
 * Role-based permission checking
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { hasPermission, Permission, Role } from '@/lib/constants/permissions';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

/**
 * Get user role from database
 * Falls back to 'owner' if role not found (tenant admin always has owner permissions)
 */
export function usePermissions() {
  const { admin, tenant } = useTenantAdminAuth();
  
  // Fetch user role from database
  const { data: userRole } = useQuery<Role>({
    queryKey: ['user-role', admin?.id, tenant?.id],
    queryFn: async () => {
      if (!admin?.id || !tenant?.id) return 'owner' as Role;

      try {
        // Check if user_roles table exists and has role for this tenant
        const { data, error }: any = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', admin.id)
          .eq('tenant_id', tenant.id)
          .single();

        if (error && error.code === '42P01') {
          // Table doesn't exist, default to owner
          return 'owner' as Role;
        }

        if (error && error.code === 'PGRST116') {
          // No role found, default to owner (tenant admin)
          return 'owner' as Role;
        }

        if (error) {
          console.warn('Error fetching user role:', error);
          return 'owner' as Role;
        }

        // Validate role exists in our ROLES enum
        const validRoles: Role[] = ['owner', 'manager', 'runner', 'warehouse', 'viewer'];
        return validRoles.includes(data?.role as Role) ? (data.role as Role) : 'owner';
      } catch (error) {
        console.warn('Error fetching user role:', error);
        return 'owner' as Role;
      }
    },
    enabled: !!admin?.id && !!tenant?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  // Default to 'owner' for tenant admins if role not yet loaded
  const role: Role = userRole || 'owner';

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
