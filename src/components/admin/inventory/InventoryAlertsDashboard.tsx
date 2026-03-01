import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { humanizeError } from '@/lib/humanizeError';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';

interface InventoryAlert {
  id: string;
  product_name: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  current_quantity: number;
  reorder_point: number;
  message: string;
  is_resolved: boolean;
  created_at: string;
}

export function InventoryAlertsDashboard() {
  const queryClient = useQueryClient();
  const { tenant } = useTenantAdminAuth();

  const { data: alerts, isLoading } = useQuery({
    queryKey: queryKeys.inventoryAlerts.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('inventory_alerts')
        .select('id, product_name, alert_type, severity, current_quantity, reorder_point, message, is_resolved, created_at')
        .eq('tenant_id', tenant.id)
        .eq('is_resolved', false)
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InventoryAlert[];
    },
    enabled: !!tenant?.id,
    refetchInterval: 30000,
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.rpc('resolve_inventory_alert', {
        alert_id: alertId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventoryAlerts.all });
      toast.success('Alert resolved');
    },
    onError: (error: Error) => {
      toast.error(humanizeError(error, 'Failed to resolve alert'));
    },
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-warning" />;
      default:
        return <AlertCircle className="h-5 w-5 text-info" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      critical: 'destructive',
      warning: 'default',
      info: 'secondary',
    } as const;
    return variants[severity as keyof typeof variants] || 'secondary';
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Loading alerts...</p>
      </Card>
    );
  }

  const criticalAlerts = alerts?.filter((a) => a.severity === 'critical') ?? [];
  const warningAlerts = alerts?.filter((a) => a.severity === 'warning') ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Critical Alerts</p>
              <p className="text-3xl font-bold text-destructive">{criticalAlerts.length}</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-destructive opacity-20" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Warnings</p>
              <p className="text-3xl font-bold text-warning">{warningAlerts.length}</p>
            </div>
            <AlertCircle className="h-10 w-10 text-warning opacity-20" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Active</p>
              <p className="text-3xl font-bold">{alerts?.length ?? 0}</p>
            </div>
            <CheckCircle2 className="h-10 w-10 opacity-20" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Active Alerts</h3>
        {!alerts || alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-2 opacity-50" />
            <p className="text-muted-foreground">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  {getSeverityIcon(alert.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-semibold">{alert.product_name}</h4>
                    <Badge variant={getSeverityBadge(alert.severity)}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Current: {alert.current_quantity} lbs</span>
                    <span>Reorder: {alert.reorder_point} lbs</span>
                    <span>{format(new Date(alert.created_at), 'MMM dd, HH:mm')}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => resolveAlertMutation.mutate(alert.id)}
                  disabled={resolveAlertMutation.isPending}
                >
                  {resolveAlertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
