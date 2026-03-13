import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import Search from 'lucide-react/dist/esm/icons/search';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { formatSmartDate, formatCurrency } from '@/lib/formatters';
import type { UnifiedOrder, UnifiedOrderItem } from '@/hooks/useUnifiedOrders';

type OrderWithItems = Pick<
  UnifiedOrder,
  'id' | 'order_number' | 'order_type' | 'status' | 'total_amount' |
  'payment_method' | 'payment_status' | 'subtotal' | 'tax_amount' |
  'discount_amount' | 'tenant_id' | 'created_at'
> & { unified_order_items: UnifiedOrderItem[] };

interface POSRefundSearchProps {
  onOrderSelected: (order: OrderWithItems) => void;
}

export function POSRefundSearch({ onOrderSelected }: POSRefundSearchProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const [orderSearch, setOrderSearch] = useState('');
  const [searchSubmitted, setSearchSubmitted] = useState('');

  // Fetch order by order_number when search is submitted
  const {
    data: foundOrder,
    isLoading: isSearching,
    error: searchError,
  } = useQuery({
    queryKey: [...queryKeys.orders.all, 'pos-refund-lookup', searchSubmitted, tenantId],
    queryFn: async () => {
      if (!tenantId || !searchSubmitted) return null;

      const { data, error } = await supabase
        .from('unified_orders')
        .select(`
          id, order_number, order_type, status, total_amount,
          payment_method, payment_status, subtotal, tax_amount, discount_amount,
          tenant_id, created_at,
          unified_order_items (
            id, product_id, product_name, sku, quantity, unit_price, total_price
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('order_number', searchSubmitted.trim())
        .maybeSingle();

      if (error) {
        logger.error('POS refund order lookup failed', error, { component: 'POSRefundSearch' });
        throw error;
      }

      return data as OrderWithItems | null;
    },
    enabled: !!tenantId && !!searchSubmitted,
  });

  // Load recent orders for quick selection
  const { data: recentOrders = [], isLoading: loadingRecent } = useQuery({
    queryKey: [...queryKeys.orders.all, 'recent-pos-orders', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('unified_orders')
        .select(`
          id, order_number, order_type, status, total_amount,
          payment_method, payment_status, subtotal, tax_amount, discount_amount,
          tenant_id, created_at,
          unified_order_items (
            id, product_id, product_name, sku, quantity, unit_price, total_price
          )
        `)
        .eq('tenant_id', tenantId)
        .in('order_type', ['pos', 'retail'])
        .eq('payment_status', 'paid')
        .neq('status', 'refunded')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Failed to load recent orders', error, { component: 'POSRefundSearch' });
        return [];
      }

      return (data ?? []) as OrderWithItems[];
    },
    enabled: !!tenantId,
  });

  const handleSearch = () => {
    if (orderSearch.trim()) {
      setSearchSubmitted(orderSearch.trim());
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleOrderClick = (order: OrderWithItems) => {
    onOrderSelected(order);
  };

  return (
    <div className="space-y-4">
      {/* Order Search */}
      <div className="space-y-2">
        <Label htmlFor="refund-order-search">Order Number</Label>
        <div className="flex gap-2">
          <Input
            id="refund-order-search"
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Enter order number (e.g., ORD-001)"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleSearch}
            disabled={!orderSearch.trim() || isSearching}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Search Results */}
      {isSearching && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}

      {searchSubmitted && !isSearching && !foundOrder && !searchError && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No order found with number &quot;{searchSubmitted}&quot;.
          </AlertDescription>
        </Alert>
      )}

      {searchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error searching for order. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {foundOrder && (
        <Card className="border-primary cursor-pointer hover:bg-muted/50" onClick={() => handleOrderClick(foundOrder)}>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Order</span>
                <span className="font-medium">{foundOrder.order_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-semibold">{formatCurrency(foundOrder.total_amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline">{foundOrder.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Date</span>
                <span className="text-sm">{formatSmartDate(foundOrder.created_at)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Orders */}
      {!searchSubmitted && (
        <div className="space-y-2">
          <Label>Recent Orders</Label>
          {loadingRecent ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : recentOrders.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentOrders.map((order) => (
                <Card
                  key={order.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleOrderClick(order)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{order.order_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatSmartDate(order.created_at)} • {order.payment_method || 'N/A'}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold">{formatCurrency(order.total_amount)}</div>
                        <Badge variant="outline" className="text-xs">{order.status}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertDescription>No recent orders available for refund.</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
