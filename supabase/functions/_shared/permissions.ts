/**
 * Permission Check Utilities for Edge Functions
 * Use this in edge functions to validate user permissions
 */

import { createClient } from '../_shared/deps.ts';

/**
 * Get user role from tenant_users table
 * Note: Requires service role client for auth.admin access
 */
export async function getUserRole(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  userEmail?: string
): Promise<string | null> {
  // Check if user is tenant owner first
  if (userEmail) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('owner_email')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenant?.owner_email?.toLowerCase() === userEmail.toLowerCase()) {
      return 'owner';
    }
  }

  // Get role from tenant_users
  const { data: tenantUser } = await supabase
    .from('tenant_users')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .maybeSingle();

  return tenantUser?.role || null;
}

/**
 * Check if user has permission using database function
 */
export async function checkUserPermission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  permission: string,
  userEmail?: string
): Promise<boolean> {
  const role = await getUserRole(supabase, userId, tenantId, userEmail);
  
  if (!role) {
    return false;
  }

  // Owner has all permissions
  if (role === 'owner') {
    return true;
  }

  // Use database function to check permission
  const { data, error } = await supabase.rpc('has_permission', {
    user_role: role,
    permission_name: permission,
  });

  if (error) {
    console.error('Permission check error:', error);
    // If function doesn't exist yet, return false (permission system not fully deployed)
    return false;
  }

  return data === true;
}

/**
 * Check permission and throw error if denied
 * Use this in edge functions for critical operations
 */
export async function requirePermission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string,
  permission: string
): Promise<void> {
  const hasPermission = await checkUserPermission(supabase, userId, tenantId, permission);
  
  if (!hasPermission) {
    throw new Error(`Permission denied: ${permission} required`);
  }
}

