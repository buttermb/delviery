/**
 * DashboardRefreshButton - Manual refresh button for dashboard data
 *
 * Allows users to manually trigger a refresh of all dashboard stats.
 * Uses TanStack Query's invalidateQueries to refetch the dashboard data.
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DashboardRefreshButtonProps {
  className?: string;
}

export function DashboardRefreshButton({ className }: DashboardRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  const handleRefresh = async () => {
    if (!tenant?.id || isRefreshing) return;

    setIsRefreshing(true);

    try {
      // Invalidate all dashboard-related queries to trigger refetch
      await queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.stats(tenant.id),
      });

      toast.success('Dashboard refreshed');
    } catch {
      toast.error('Failed to refresh dashboard');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isRefreshing || !tenant?.id}
      className={cn('gap-2', className)}
    >
      <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
      {isRefreshing ? 'Refreshing...' : 'Refresh'}
    </Button>
  );
}
