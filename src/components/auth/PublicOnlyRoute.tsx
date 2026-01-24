import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentUserType, getDashboardUrl } from '@/lib/utils/authHelpers';
import { LoadingFallback } from '@/components/LoadingFallback';

interface PublicOnlyRouteProps {
  children: ReactNode;
}

/**
 * Route wrapper for public-only pages (login, signup).
 * Redirects authenticated users to their dashboard.
 * Renders children for unauthenticated users.
 */
export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  if (user) {
    const userType = getCurrentUserType();
    const dashboardUrl = userType
      ? getDashboardUrl(userType)
      : '/marketing';

    return <Navigate to={dashboardUrl} replace />;
  }

  return <>{children}</>;
}
