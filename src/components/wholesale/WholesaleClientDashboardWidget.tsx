import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ShoppingCart, DollarSign, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { Skeleton } from '@/components/ui/skeleton';

export function WholesaleClientDashboardWidget() {
  const { tenant } = useTenantAdminAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.wholesaleDashboard.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return null;

      const [clientsRes, ordersRes, revenueRes] = await Promise.all([
        supabase
          .from('wholesale_clients')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('status', 'active'),
        supabase
          .from('marketplace_orders')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', tenant.id)
          .gte('created_at', new Date(new Date().setDate(1)).toISOString()),
        supabase
          .from('marketplace_orders')
          .select('total_amount')
          .eq('seller_id', tenant.id)
          .gte('created_at', new Date(new Date().setDate(1)).toISOString()),
      ]);

      const revenue = revenueRes.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

      return {
        activeClients: clientsRes.count || 0,
        ordersThisMonth: ordersRes.count || 0,
        revenueThisMonth: revenue,
        overdueInvoices: 0,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wholesale Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              Active Clients
            </div>
            <div className="text-2xl font-bold">{stats?.activeClients || 0}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingCart className="h-4 w-4" />
              Orders (MTD)
            </div>
            <div className="text-2xl font-bold">{stats?.ordersThisMonth || 0}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Revenue (MTD)
            </div>
            <div className="text-2xl font-bold font-mono">
              ${(stats?.revenueThisMonth || 0).toFixed(0)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Overdue Invoices
            </div>
            <div className="text-2xl font-bold text-destructive">
              {stats?.overdueInvoices || 0}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
