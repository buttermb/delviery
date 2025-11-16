/**
 * Protected Route for Super Admin / Platform Admin
 * Uses server-side role validation via user_roles table
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { LoadingFallback } from '@/components/LoadingFallback';
import { logger } from '@/lib/logger';

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
        // Check admin_users table for super_admin role
        const { data, error } = await supabase
          .from('admin_users')
          .select('role, is_active')
          .eq('user_id', user.id)
          .eq('role', 'super_admin')
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          logger.error('Error checking admin status', error instanceof Error ? error : new Error(String(error)), { userId: user.id, component: 'SuperAdminProtectedRoute' });
          setIsPlatformAdmin(false);
        } else {
          setIsPlatformAdmin(data !== null);
        }
      } catch (error) {
        logger.error('Error checking platform admin status', error instanceof Error ? error : new Error(String(error)), { userId: user.id, component: 'SuperAdminProtectedRoute' });
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
