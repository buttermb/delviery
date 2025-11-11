/**
 * Permission Check Utilities for Edge Functions
 * PHASE 4: Updated to use user_roles table for role-based access control
 * Use this in edge functions to validate user permissions
 */

import { createClient } from '../_shared/deps.ts';

/**
 * Get user roles from user_roles table
 * Returns all roles the user has (can have multiple)
 * Note: Requires service role client for auth.admin access
 */
export async function getUserRoles(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string[]> {
  const { data: userRoles, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }

  return (userRoles as Array<{ role: string }> || []).map(r => r.role);
}

/**
 * Check if user has a specific role using has_role() database function
 */
export async function hasRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  role: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('has_role' as any, {
      _user_id: userId,
      _role: role,
    } as any);

    if (error) {
      console.error('has_role RPC error:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('has_role check failed:', error);
    return false;
  }
}

/**
 * Get primary user role for a tenant context
 * Returns the highest privilege role the user has
 * Priority: super_admin > owner > admin > member > viewer
 */
export async function getPrimaryRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tenantId?: string,
  userEmail?: string
): Promise<string | null> {
  // Check for super_admin first (highest privilege)
  const isSuperAdmin = await hasRole(supabase, userId, 'super_admin');
  if (isSuperAdmin) {
    return 'super_admin';
  }

  // Check if user is tenant owner (if tenant context provided)
  if (tenantId && userEmail) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('owner_email')
      .eq('id', tenantId)
      .maybeSingle();

    const tenantData = tenant as { owner_email: string } | null;
    if (tenantData?.owner_email?.toLowerCase() === userEmail.toLowerCase()) {
      return 'owner';
    }
  }

  // Get all roles and return highest privilege one
  const roles = await getUserRoles(supabase, userId);
  
  if (roles.length === 0) {
    return null;
  }

  // Priority order
  const rolePriority = ['super_admin', 'owner', 'admin', 'member', 'viewer', 'courier', 'user'];
  
  for (const priorityRole of rolePriority) {
    if (roles.includes(priorityRole)) {
      return priorityRole;
    }
  }

  return roles[0]; // Return first role as fallback
}

/**
 * Check if user has permission
 * Super admins always have all permissions
 * Owners have all permissions within their tenant
 */
export async function checkUserPermission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  permission: string,
  userEmail?: string
): Promise<boolean> {
  // Super admins have all permissions
  const isSuperAdmin = await hasRole(supabase, userId, 'super_admin');
  if (isSuperAdmin) {
    console.log(`Super admin ${userId} granted permission: ${permission}`);
    return true;
  }

  // Get primary role
  const role = await getPrimaryRole(supabase, userId, tenantId, userEmail);
  
  if (!role) {
    console.log(`No role found for user ${userId}`);
    return false;
  }

  // Owner has all permissions
  if (role === 'owner') {
    console.log(`Owner ${userId} granted permission: ${permission}`);
    return true;
  }

  // Check permission using role permissions mapping
  // For now, simple role-based checks (can be extended with has_permission RPC if needed)
  const rolePermissions: Record<string, string[]> = {
    admin: [
      'orders:view', 'orders:create', 'orders:edit', 'orders:delete',
      'inventory:view', 'inventory:edit',
      'products:view', 'products:create', 'products:edit', 'products:delete',
      'customers:view', 'customers:create', 'customers:edit',
      'team:view', 'team:invite',
      'finance:view', 'finance:payments',
    ],
    member: [
      'orders:view', 'orders:create', 'orders:edit',
      'inventory:view', 'inventory:edit',
      'products:view',
      'customers:view',
    ],
    viewer: [
      'orders:view',
      'inventory:view',
      'products:view',
      'customers:view',
    ],
  };

  const allowedPermissions = rolePermissions[role] || [];
  const hasPermission = allowedPermissions.includes(permission);

  console.log(`User ${userId} (${role}) ${hasPermission ? 'granted' : 'denied'} permission: ${permission}`);
  return hasPermission;
}

/**
 * Check permission and throw error if denied
 * Use this in edge functions for critical operations
 */
export async function requirePermission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  permission: string,
  userEmail?: string
): Promise<void> {
  const hasPermission = await checkUserPermission(supabase, userId, tenantId, permission, userEmail);
  
  if (!hasPermission) {
    throw new Error(`Permission denied: ${permission} required`);
  }
}

/**
 * DEPRECATED: Use getUserRoles() instead
 * Kept for backward compatibility
 */
export async function getUserRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  userEmail?: string
): Promise<string | null> {
  return getPrimaryRole(supabase, userId, tenantId, userEmail);
}
