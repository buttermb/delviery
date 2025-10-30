import { supabase } from "@/integrations/supabase/client";

/**
 * Server-side admin verification
 * CRITICAL: This must be called from server context (Edge Functions)
 * DO NOT rely on client-side checks alone
 */
export async function verifyAdminAccess(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_admin', {
      _user_id: userId
    });

    if (error) {
      console.error('Admin verification error:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Admin verification failed:', error);
    return false;
  }
}

/**
 * Client-side admin check with server verification
 * This provides immediate feedback but must be backed by server-side checks
 */
export async function checkAdminStatus(): Promise<{
  isAdmin: boolean;
  verified: boolean;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { isAdmin: false, verified: false };
    }

    // Check user roles
    const { data: roles, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (error || !roles) {
      return { isAdmin: false, verified: true };
    }

    return { isAdmin: true, verified: true };
  } catch (error) {
    console.error('Client admin check failed:', error);
    return { isAdmin: false, verified: false };
  }
}
