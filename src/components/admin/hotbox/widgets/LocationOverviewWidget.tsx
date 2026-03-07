/**
 * Location Overview Widget
 * Simplified table: Name + status dot + Revenue + Orders
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight } from 'lucide-react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface LocationMetrics {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  status: 'good' | 'warning' | 'alert';
}

export function LocationOverviewWidget() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const { data: locations, isLoading } = useQuery({
    queryKey: queryKeys.hotbox.locations(tenant?.id),
    queryFn: async (): Promise<LocationMetrics[]> => {
      if (!tenant?.id) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Try to fetch locations
      const { data: locs } = await supabase
        .from('locations')
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .limit(10);

      const locationList = locs && locs.length > 0
        ? locs
        : [{ id: 'main', name: 'Main' }];

      // Get today's orders
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .gte('created_at', today.toISOString())
        .not('status', 'in', '("cancelled","rejected","refunded")');

      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) ?? 0;
      const totalOrders = orders?.length ?? 0;

      // Check for stock issues
      const { count: outOfStock } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .lte('stock_quantity', 0)
        .eq('status', 'active');

      const { count: lowStock } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .gt('stock_quantity', 0)
        .lt('stock_quantity', 10)
        .eq('status', 'active');

      const issues = (outOfStock ?? 0) + (lowStock ?? 0);

      return locationList.map((loc) => {
        const locCount = locationList.length;
        const locRevenue = Math.round(totalRevenue / Math.max(1, locCount));
        const locOrders = Math.round(totalOrders / Math.max(1, locCount));

        let status: 'good' | 'warning' | 'alert' = 'good';
        if (issues > 5) status = 'alert';
        else if (issues > 0) status = 'warning';

        return {
          id: loc.id,
          name: loc.name,
          revenue: locRevenue,
          orders: locOrders,
          status,
        };
      });
    },
    enabled: !!tenant?.id,
    staleTime: 60 * 1000,
  });

  const STATUS_DOT: Record<string, string> = {
    good: 'bg-emerald-500',
    warning: 'bg-amber-500',
    alert: 'bg-red-500',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Location Overview</CardTitle>
          <button
            onClick={() => navigate(`/${tenantSlug}/admin/locations`)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-2 h-2 rounded-full" />
                <Skeleton className="flex-1 h-4" />
                <Skeleton className="w-16 h-4" />
                <Skeleton className="w-8 h-4" />
              </div>
            ))}
          </div>
        ) : locations && locations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th scope="col" className="text-left py-2 font-medium text-muted-foreground text-xs">Location</th>
                  <th scope="col" className="text-right py-2 font-medium text-muted-foreground text-xs">Revenue</th>
                  <th scope="col" className="text-right py-2 font-medium text-muted-foreground text-xs">Orders</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id} className="border-b last:border-0">
                    <td className="py-2.5 font-medium flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[loc.status]}`} />
                      {loc.name}
                    </td>
                    <td className="text-right py-2.5 tabular-nums">{formatCurrency(loc.revenue)}</td>
                    <td className="text-right py-2.5 tabular-nums">{loc.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No location data yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
