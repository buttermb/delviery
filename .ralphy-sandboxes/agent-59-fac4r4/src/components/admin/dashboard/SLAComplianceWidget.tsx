/**
 * SLA Compliance Widget - Dashboard widget showing SLA compliance metrics
 */

import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import Clock from 'lucide-react/dist/esm/icons/clock';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import XCircle from 'lucide-react/dist/esm/icons/x-circle';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';

import { supabase } from '@/integrations/supabase/client';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { calculateSLAComplianceSummary } from '@/lib/sla/slaCalculations';
import { cn } from '@/lib/utils';
import type { OrderWithSLATimestamps } from '@/types/sla';
import { DEFAULT_SLA_TARGETS } from '@/types/sla';
import { logger } from '@/lib/logger';

interface SLAComplianceWidgetProps {
  className?: string;
}

export function SLAComplianceWidget({ className }: SLAComplianceWidgetProps) {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();

  const { data: complianceData, isLoading } = useQuery({
    queryKey: [...queryKeys.orders.lists(), 'sla-compliance', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;

      // Fetch active orders (non-terminal statuses)
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('id, status, created_at, accepted_at, courier_assigned_at, courier_accepted_at, delivered_at')
        .eq('tenant_id', tenant.id)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        logger.error('Failed to fetch orders for SLA compliance', error);
        throw error;
      }

      // Transform to OrderWithSLATimestamps
      const orders: OrderWithSLATimestamps[] = (ordersData || []).map(order => ({
        id: order.id,
        status: order.status as OrderWithSLATimestamps['status'],
        created_at: order.created_at,
        accepted_at: order.accepted_at,
        courier_assigned_at: order.courier_assigned_at,
        courier_accepted_at: order.courier_accepted_at,
        delivered_at: order.delivered_at,
        // Use accepted_at as status_changed_at for confirmed+ statuses
        status_changed_at: order.accepted_at || null,
      }));

      // TODO: In the future, get SLA targets from tenant settings
      // const tenantSLATargets = tenant.features?.sla_targets || DEFAULT_SLA_TARGETS;

      return calculateSLAComplianceSummary(orders, DEFAULT_SLA_TARGETS);
    },
    enabled: !!tenant?.id,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-24 w-full mb-4" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  if (!complianceData || complianceData.totalOrders === 0) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            SLA Compliance
          </h3>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No active orders to track</p>
        </div>
      </Card>
    );
  }

  const { totalOrders, onTrackCount, approachingCount, overdueCount, compliancePercentage } = complianceData;

  // Determine compliance color
  const getComplianceColor = () => {
    if (compliancePercentage >= 90) return 'text-green-600 dark:text-green-400';
    if (compliancePercentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressColor = () => {
    if (compliancePercentage >= 90) return 'bg-green-500';
    if (compliancePercentage >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          SLA Compliance
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('orders')}
        >
          View Orders
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Main Compliance Score */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-2">
          <span className={cn('text-4xl font-bold', getComplianceColor())}>
            {compliancePercentage}%
          </span>
          <span className="text-muted-foreground text-sm">
            compliance ({totalOrders} active orders)
          </span>
        </div>
        <Progress
          value={compliancePercentage}
          className="h-2"
          indicatorClassName={getProgressColor()}
        />
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-lg font-bold text-green-600 dark:text-green-400">
              {onTrackCount}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">On Track</span>
        </div>

        <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-center gap-1 mb-1">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
              {approachingCount}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Approaching</span>
        </div>

        <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-center gap-1 mb-1">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-lg font-bold text-red-600 dark:text-red-400">
              {overdueCount}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Overdue</span>
        </div>
      </div>

      {/* Overdue Alert */}
      {overdueCount > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {overdueCount} order{overdueCount > 1 ? 's' : ''} past SLA target
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
