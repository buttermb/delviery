/**
 * Top Products Widget
 * Displays best-selling products from order_items
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, TrendingUp, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { useNavigate, useParams } from 'react-router-dom';
import { subDays } from 'date-fns';
import { queryKeys } from '@/lib/queryKeys';

interface TopProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_value: number;
  order_count: number;
}

export function TopProductsWidget() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const getFullPath = (href: string) => {
    if (href.startsWith('/admin') && tenantSlug) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const { data: topProducts, isLoading } = useQuery({
    queryKey: queryKeys.dashboardWidgets.topProducts(tenant?.id),
    queryFn: async (): Promise<TopProduct[]> => {
      if (!tenant?.id) return [];

      const last30Days = subDays(new Date(), 30);

      // Get completed/delivered orders for this tenant
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', tenant.id)
        .in('status', ['completed', 'delivered'])
        .gte('created_at', last30Days.toISOString());

      if (ordersError) {
        logger.error('Failed to fetch orders for top products', ordersError, { component: 'TopProductsWidget' });
        return [];
      }

      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map((o) => o.id);

      // Get order items — columns: product_id, product_name, quantity, price
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, product_name, quantity, price')
        .in('order_id', orderIds);

      if (itemsError) {
        logger.error('Failed to fetch order items for top products', itemsError, { component: 'TopProductsWidget' });
        return [];
      }

      if (!orderItems || orderItems.length === 0) return [];

      // Aggregate by product
      const productMap = new Map<string, TopProduct>();

      for (const item of orderItems) {
        const productId = item.product_id;
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_id: productId,
            product_name: item.product_name || `Product ${productId.slice(0, 8)}`,
            total_quantity: 0,
            total_value: 0,
            order_count: 0,
          });
        }

        const product = productMap.get(productId)!;
        product.total_quantity += Number(item.quantity || 0);
        product.total_value += Number(item.quantity || 0) * Number(item.price || 0);
        product.order_count += 1;
      }

      // Sort by total value and take top 5
      return Array.from(productMap.values())
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 5);
    },
    enabled: !!tenant?.id,
    staleTime: 60 * 1000,
  });

  // Find max value for bar proportions
  const maxValue = topProducts?.reduce((max, p) => Math.max(max, p.total_value), 0) ?? 1;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Top Products
        </h3>
        <button
          onClick={() => navigate(getFullPath('/admin/inventory-hub'))}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Full report
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-6 h-6 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : topProducts && topProducts.length > 0 ? (
        <div className="space-y-3">
          {topProducts.map((product, index) => (
            <div key={product.product_id} className="flex items-center gap-3">
              <span className="text-sm font-bold text-muted-foreground w-5 text-right shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{product.product_name}</div>
                <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.max(5, (product.total_value / maxValue) * 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums shrink-0">
                {formatCurrency(product.total_value)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[180px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No product data yet</p>
          </div>
        </div>
      )}
    </Card>
  );
}
