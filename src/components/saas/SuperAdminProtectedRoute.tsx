/**
 * Protected Route for Super Admin / Platform Admin
 * Ensures only platform admins can access SAAS admin pages
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { LoadingFallback } from '@/components/LoadingFallback';

interface SuperAdminProtectedRouteProps {
  children: React.ReactNode;
}

export function SuperAdminProtectedRoute({ children }: SuperAdminProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkPlatformAdmin() {
      if (!user) {
        setIsPlatformAdmin(false);
        setChecking(false);
        return;
      }

      try {
        // Method 1: Check user metadata
        const metadata = user.user_metadata || {};
        const isMetadataAdmin = 
          metadata.role === 'platform_admin' ||
          metadata.platform_admin === true ||
          metadata.is_super_admin === true;

        if (isMetadataAdmin) {
          setIsPlatformAdmin(true);
          setChecking(false);
          return;
        }

        // Method 2: Check tenant_users for super_admin role
        const { data: tenantUser } = await (supabase as any)
          .from('tenant_users')
          .select('role')
          .eq('email', user.email)
          .eq('role', 'super_admin')
          .maybeSingle();

        if (tenantUser) {
          setIsPlatformAdmin(true);
          setChecking(false);
          return;
        }

        // Method 3: Check email whitelist (same as in login)
        const platformAdminEmails = [
          'admin@platform.com',
          'superadmin@platform.com',
          'sake121211@gmail.com',
          'sake2605@icloud.com',
        ];

        if (platformAdminEmails.includes(user.email?.toLowerCase() || '')) {
          setIsPlatformAdmin(true);
          setChecking(false);
          return;
        }

        setIsPlatformAdmin(false);
      } catch (error) {
        console.error('Error checking platform admin status:', error);
        setIsPlatformAdmin(false);
      } finally {
        setChecking(false);
      }
    }

    if (!authLoading) {
      checkPlatformAdmin();
    }
  }, [user, authLoading]);

  if (authLoading || checking) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/saas/login" replace />;
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/marketing" replace />;
  }

  return <>{children}</>;
}
