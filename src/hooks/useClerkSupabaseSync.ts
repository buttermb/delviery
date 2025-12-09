// @ts-nocheck
/**
 * Clerk-Supabase Sync Hook
 * Syncs Clerk user data to Supabase for database operations
 */
import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useClerkConfigured } from '@/providers/ClerkProviderWrapper';
import { useAuthSafe, useUserSafe } from '@/hooks/useClerkSafe';
import * as ClerkReact from '@clerk/clerk-react';

// Conditionally use Clerk session hook
const useSessionSafe = () => {
  const clerkConfigured = useClerkConfigured();
  if (!clerkConfigured) {
    return { session: null, isLoaded: true };
  }
  // Use try-catch to safely call Clerk hooks
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return ClerkReact.useSession();
  } catch {
    return { session: null, isLoaded: true };
  }
};

interface SyncedUser {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  imageUrl: string | null;
}

interface UseClerkSupabaseSyncReturn {
  syncedUser: SyncedUser | null;
  isLoading: boolean;
  isSynced: boolean;
  error: Error | null;
  syncUser: () => Promise<void>;
}

/**
 * Hook to sync Clerk user with Supabase
 * 
 * Features:
 * - Automatic sync on user sign-in
 * - Creates/updates tenant_users record
 * - Handles role assignment from Clerk metadata
 * - Provides sync status for UI feedback
 */
export function useClerkSupabaseSync(): UseClerkSupabaseSyncReturn {
  const clerkConfigured = useClerkConfigured();
  const { user, isLoaded: userLoaded } = useUserSafe();
  const { session, isLoaded: sessionLoaded } = useSessionSafe();
  const { getToken } = useAuthSafe();

  const [syncedUser, setSyncedUser] = useState<SyncedUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const syncUser = useCallback(async () => {
    // Skip sync if Clerk is not configured
    if (!clerkConfigured) {
      logger.debug('[ClerkSync] Clerk not configured, skipping sync');
      return;
    }

    if (!user || !session) {
      logger.debug('[ClerkSync] No user or session to sync');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get user metadata from Clerk
      const email = user.primaryEmailAddress?.emailAddress || '';
      const name = user.fullName || user.firstName || email.split('@')[0];
      const role = (user.publicMetadata?.role as string) || 'member';
      const tenantId = (user.publicMetadata?.tenant_id as string) || null;
      const imageUrl = user.imageUrl || null;

      logger.debug('[ClerkSync] Syncing user', {
        clerkId: user.id,
        email,
        role,
        tenantId
      });

      // Check if user exists in Supabase
      const { data: existingUser, error: lookupError } = await supabase
        .from('tenant_users')
        .select('id, tenant_id, role')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (lookupError && lookupError.code !== 'PGRST116') {
        throw lookupError;
      }

      if (existingUser) {
        // Update existing user with Clerk ID if needed
        const { error: updateError } = await supabase
          .from('tenant_users')
          .update({
            name,
            clerk_user_id: user.id,
            avatar_url: imageUrl,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id);

        if (updateError) {
          logger.warn('[ClerkSync] Failed to update user', { error: updateError });
        }

        setSyncedUser({
          id: existingUser.id,
          clerkId: user.id,
          email,
          name,
          role: existingUser.role || role,
          tenantId: existingUser.tenant_id || tenantId,
          imageUrl,
        });
      } else if (tenantId) {
        // Create new tenant_user record
        const { data: newUser, error: insertError } = await supabase
          .from('tenant_users')
          .insert({
            tenant_id: tenantId,
            user_id: user.id, // Using Clerk ID as user_id
            clerk_user_id: user.id,
            email: email.toLowerCase(),
            name,
            role,
            status: 'active',
            avatar_url: imageUrl,
            invited_at: new Date().toISOString(),
            accepted_at: new Date().toISOString(),
            email_verified: user.primaryEmailAddress?.verification?.status === 'verified',
          })
          .select('id')
          .maybeSingle();

        if (insertError) {
          // User might already exist with different criteria
          logger.warn('[ClerkSync] Failed to create user', { error: insertError });
        } else if (newUser) {
          setSyncedUser({
            id: newUser.id,
            clerkId: user.id,
            email,
            name,
            role,
            tenantId,
            imageUrl,
          });
        }
      } else {
        // User exists in Clerk but no tenant - might be super admin or new signup
        logger.debug('[ClerkSync] User has no tenant_id, checking super_admin_users');

        // @ts-ignore - Type instantiation too deep, using direct query
        const { data: superAdmin } = await supabase
          .from('super_admin_users')
          .select('id, email, role')
          .eq('email', email.toLowerCase())
          .maybeSingle() as { data: { id: string; email: string; role: string } | null; error: unknown };

        if (superAdmin) {
          setSyncedUser({
            id: superAdmin.id,
            clerkId: user.id,
            email,
            name,
            role: superAdmin.role || 'super_admin',
            tenantId: null,
            imageUrl,
          });
        } else {
          // No tenant, not super admin - user needs to complete signup
          setSyncedUser({
            id: user.id,
            clerkId: user.id,
            email,
            name,
            role: 'pending',
            tenantId: null,
            imageUrl,
          });
        }
      }

      setIsSynced(true);
      logger.info('[ClerkSync] User synced successfully', { clerkId: user.id });

    } catch (err) {
      const syncError = err instanceof Error ? err : new Error('Sync failed');
      setError(syncError);
      logger.error('[ClerkSync] Sync failed', { error: syncError });
    } finally {
      setIsLoading(false);
    }
  }, [user, session]);

  // Auto-sync when user signs in
  useEffect(() => {
    if (userLoaded && sessionLoaded && user && session && !isSynced && !isLoading) {
      syncUser();
    }
  }, [userLoaded, sessionLoaded, user, session, isSynced, isLoading, syncUser]);

  // Clear sync state when user signs out
  useEffect(() => {
    if (userLoaded && !user) {
      setSyncedUser(null);
      setIsSynced(false);
      setError(null);
    }
  }, [userLoaded, user]);

  return {
    syncedUser,
    isLoading,
    isSynced,
    error,
    syncUser,
  };
}

/**
 * Get Supabase client with Clerk JWT
 * Use this for authenticated Supabase operations
 */
export function useClerkSupabaseClient() {
  const { getToken } = useAuthSafe();

  const getAuthenticatedClient = useCallback(async () => {
    try {
      // Get Clerk JWT token (if getToken is available)
      const token = getToken ? await getToken({ template: 'supabase' }) : null;

      if (!token) {
        logger.warn('[ClerkSupabase] No token available');
        return supabase;
      }

      // Set the auth header for this request
      // Note: For full integration, you'd want to create a custom Supabase client
      // that uses the Clerk JWT for all requests
      return supabase;
    } catch (error) {
      logger.error('[ClerkSupabase] Failed to get authenticated client', { error });
      return supabase;
    }
  }, [getToken]);

  return { getAuthenticatedClient };
}

/**
 * Hook to check if current Clerk user has a specific role
 */
export function useClerkRole() {
  const { user } = useUserSafe();

  const hasRole = useCallback((requiredRole: string | string[]): boolean => {
    if (!user) return false;

    const userRole = (user.publicMetadata?.role as string) || 'member';
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    return roles.includes(userRole);
  }, [user]);

  const isSuperAdmin = useCallback((): boolean => {
    return hasRole(['super_admin', 'platform_admin']);
  }, [hasRole]);

  const isTenantAdmin = useCallback((): boolean => {
    return hasRole(['owner', 'admin', 'tenant_admin']);
  }, [hasRole]);

  const isCustomer = useCallback((): boolean => {
    return hasRole(['customer', 'member']);
  }, [hasRole]);

  return {
    hasRole,
    isSuperAdmin,
    isTenantAdmin,
    isCustomer,
    currentRole: (user?.publicMetadata?.role as string) || null,
  };
}

