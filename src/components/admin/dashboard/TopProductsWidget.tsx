/**
 * Top Products Widget
 * Displays best-selling products
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { formatWeight } from '@/lib/utils/formatWeight';
import { useNavigate, useParams } from 'react-router-dom';
import { format, subDays } from 'date-fns';

interface TopProduct {
  product_id: string;
  product_name: string;
  total_quantity: number;
  total_value: number;
  order_count: number;
}

export function TopProductsWidget() {
  const { account } = useAccount();
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  const getFullPath = (href: string) => {
    if (href.startsWith('/admin') && tenantSlug) {
      return `/${tenantSlug}${href}`;
    }
    return href;
  };

  const { data: topProducts } = useQuery({
    queryKey: ['top-products', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];

      const last30Days = subDays(new Date(), 30);

      // Get order items from completed orders
      const { data: orders } = await supabase
        .from('wholesale_orders')
        .select('id, created_at, status')
        .eq('account_id', account.id)
        .eq('status', 'completed')
        .gte('created_at', last30Days.toISOString());

      if (!orders || orders.length === 0) return [];

      interface OrderRow {
        id: string;
        created_at: string;
        status: string;
      }

      const orderIds = (orders as OrderRow[]).map((o) => o.id);

      // Get order items
      const { data: orderItems } = await supabase
        .from('wholesale_order_items')
        .select('product_id, quantity_lbs, unit_price')
        .in('order_id', orderIds);

      if (!orderItems) return [];

      // Aggregate by product
      const productMap = new Map<string, TopProduct>();

      interface OrderItemRow {
        product_id: string;
        quantity_lbs: number | null;
        unit_price: number | null;
      }

      orderItems.forEach((item: OrderItemRow) => {
        const productId = item.product_id;
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            product_id: productId,
            product_name: `Product ${productId.slice(0, 8)}`,
            total_quantity: 0,
            total_value: 0,
            order_count: 0,
          });
        }

        const product = productMap.get(productId)!;
        product.total_quantity += Number(item.quantity_lbs || 0);
        product.total_value +=
          Number(item.quantity_lbs || 0) * Number(item.unit_price || 0);
        product.order_count += 1;
      });

      // Get product names
      const productIds = Array.from(productMap.keys());
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);

      interface ProductRow {
        id: string;
        name: string;
      }

      if (products) {
        (products as ProductRow[]).forEach((product) => {
          const topProduct = productMap.get(product.id);
          if (topProduct) {
            topProduct.product_name = product.name;
          }
        });
      }

      // Sort by total value and take top 5
      return Array.from(productMap.values())
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 5);
    },
    enabled: !!account?.id,
  });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Top Products
        </h3>
        <button
          onClick={() => navigate(getFullPath('/admin/analytics/comprehensive'))}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          View All
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {topProducts && topProducts.length > 0 ? (
        <div className="space-y-3">
          {topProducts.map((product, index) => (
            <div
              key={product.product_id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(getFullPath(`/admin/inventory/products?product=${product.product_id}`))}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{product.product_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{formatWeight(product.total_quantity)}</span>
                    <span>•</span>
                    <span>{product.order_count} orders</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">${product.total_value.toFixed(2)}</div>
                <Badge variant="secondary" className="mt-1">
                  <TrendingUp className="h-2 w-2 mr-1" />
                  Top
                </Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No product data</p>
            <p className="text-xs mt-1">Complete some orders to see top products</p>
          </div>
        </div>
      )}
    </Card>
  );
}

