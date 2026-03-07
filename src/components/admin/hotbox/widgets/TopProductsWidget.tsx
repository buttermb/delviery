/**
 * Top Products Today Widget (Hotbox)
 * Shows today's best-selling products with revenue bars
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface TopProduct {
  name: string;
  revenue: number;
}

export function TopProductsTodayWidget() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const { data: products, isLoading } = useQuery({
    queryKey: [...queryKeys.hotbox.pulse(tenant?.id), 'top-products-today'],
    queryFn: async (): Promise<TopProduct[]> => {
      if (!tenant?.id) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's order items with product names
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          quantity,
          price,
          product:products!inner(name, tenant_id),
          order:orders!inner(tenant_id, created_at, status)
        `)
        .eq('order.tenant_id', tenant.id)
        .gte('order.created_at', today.toISOString())
        .not('order.status', 'in', '("cancelled","rejected","refunded")');

      if (!orderItems || orderItems.length === 0) return [];

      // Aggregate revenue by product name
      const productMap = new Map<string, number>();
      for (const item of orderItems) {
        const name = (item.product as unknown as { name: string })?.name ?? 'Unknown';
        const revenue = (item.quantity ?? 0) * (item.price ?? 0);
        productMap.set(name, (productMap.get(name) ?? 0) + revenue);
      }

      return Array.from(productMap.entries())
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    },
    enabled: !!tenant?.id,
    staleTime: 60 * 1000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Top Products Today</CardTitle>
          <button
            onClick={() => navigate(`/${tenantSlug}/admin/analytics-hub`)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Full report
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-6 h-4" />
                <Skeleton className="flex-1 h-4" />
                <Skeleton className="w-16 h-4" />
              </div>
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="space-y-3">
            {products.map((product, index) => {
              const maxRevenue = products[0].revenue || 1;
              const barWidth = Math.max(8, (product.revenue / maxRevenue) * 100);
              return (
                <div key={product.name} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground w-5 text-right shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{product.name}</div>
                    <div
                      className="h-1.5 rounded-full bg-emerald-500/20 mt-1"
                      style={{ width: '100%' }}
                    >
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium tabular-nums shrink-0">
                    {formatCurrency(product.revenue)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No sales today yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
