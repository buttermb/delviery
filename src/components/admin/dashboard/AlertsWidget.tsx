/**
 * Alerts Widget - Unread notifications with dismiss action
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import Bell from "lucide-react/dist/esm/icons/bell";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Package from "lucide-react/dist/esm/icons/package";
import Clock from "lucide-react/dist/esm/icons/clock";
import FileWarning from "lucide-react/dist/esm/icons/file-warning";
import X from "lucide-react/dist/esm/icons/x";
import CheckCheck from "lucide-react/dist/esm/icons/check-check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';

interface Alert {
  id: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  product_name: string;
  current_quantity: number;
  created_at: string;
  is_resolved: boolean | null;
  dismissed_at: string | null;
}

export function AlertsWidget() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const getFullPath = (href: string) => {
    if (href.startsWith('/admin') && tenantSlug) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  // Fetch unread/undismissed alerts
  const { data: alerts, isLoading, refetch } = useQuery({
    queryKey: queryKeys.dashboard.alerts(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('inventory_alerts')
        .select('*')
        .eq('tenant_id', tenant.id)
        .is('dismissed_at', null)
        .or('is_resolved.is.null,is_resolved.eq.false')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        logger.error('Failed to fetch alerts', { error });
        return [];
      }

      return (data ?? []) as Alert[];
    },
    enabled: !!tenant?.id,
    staleTime: 10000,
  });

  // Set up real-time subscription
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`alerts-widget-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_alerts',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, refetch]);

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('inventory_alerts')
        .update({
          dismissed_at: new Date().toISOString(),
          dismissed_by: admin?.id || null,
        })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.alerts(tenant?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts() });
      toast.success('Alert dismissed');
    },
    onError: (error: Error) => {
      logger.error('Failed to dismiss alert', { error });
      toast.error('Failed to dismiss alert', {
        description: humanizeError(error),
      });
    },
  });

  // Dismiss all mutation
  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      if (!alerts?.length) return;

      const alertIds = alerts.map((a) => a.id);
      const { error } = await supabase
        .from('inventory_alerts')
        .update({
          dismissed_at: new Date().toISOString(),
          dismissed_by: admin?.id || null,
        })
        .in('id', alertIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.alerts(tenant?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts() });
      toast.success('All alerts dismissed');
    },
    onError: (error: Error) => {
      logger.error('Failed to dismiss all alerts', { error });
      toast.error('Failed to dismiss all alerts', {
        description: humanizeError(error),
      });
    },
  });

  const handleDismiss = (e: React.MouseEvent, alertId: string) => {
    e.stopPropagation();
    dismissMutation.mutate(alertId);
  };

  const handleDismissAll = () => {
    dismissAllMutation.mutate();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500';
      case 'warning':
        return 'bg-orange-500';
      case 'info':
      default:
        return 'bg-blue-500';
    }
  };

  const getSeverityBadgeVariant = (severity: string): 'destructive' | 'outline' | 'secondary' => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'low_stock':
      case 'out_of_stock':
        return <Package className="h-4 w-4" />;
      case 'expiring':
        return <Clock className="h-4 w-4" />;
      case 'compliance':
        return <FileWarning className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatAlertType = (alertType: string) => {
    return alertType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const unreadCount = alerts?.length ?? 0;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5 text-orange-500" />
          Alerts
        </h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <>
              <Badge variant="destructive">{unreadCount}</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleDismissAll}
                disabled={dismissAllMutation.isPending}
              >
                {dismissAllMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <CheckCheck className="mr-1 h-3 w-3" />
                Dismiss All
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-6 rounded" />
            </div>
          ))
        ) : alerts && alerts.length > 0 ? (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => navigate(getFullPath('/admin/inventory/alerts'))}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(getFullPath('/admin/inventory/alerts')); } }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-full ${getSeverityColor(alert.severity)} shadow-sm`}
                >
                  {getAlertIcon(alert.alert_type)}
                  <span className="sr-only">{alert.alert_type}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {alert.product_name}
                    </span>
                    <Badge
                      variant={getSeverityBadgeVariant(alert.severity)}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {formatAlertType(alert.alert_type)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate max-w-[200px] sm:max-w-none">{alert.message}</span>
                    <span className="opacity-60 whitespace-nowrap">
                      • {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => handleDismiss(e, alert.id)}
                disabled={dismissMutation.isPending}
                title="Dismiss alert"
                aria-label="Dismiss alert"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No active alerts</p>
            <p className="text-xs mt-1">You're all caught up!</p>
          </div>
        )}
      </div>

      {alerts && alerts.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4"
          onClick={() => navigate(getFullPath('/admin/inventory/alerts'))}
        >
          View All Alerts
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </Card>
  );
}
