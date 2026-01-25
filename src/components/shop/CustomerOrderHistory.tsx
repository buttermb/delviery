/**
 * CustomerOrderHistory Component
 * Paginated order history with status badges, total item count, and reorder functionality
 */

import { useState, useMemo, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from '@/pages/shop/ShopLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { StandardPagination } from '@/components/shared/StandardPagination';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  RefreshCw,
  ChevronRight,
  ShoppingBag,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { logger } from '@/lib/logger';

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount?: number;
  total?: number;
  items?: OrderItem[];
  created_at: string;
  tracking_token?: string;
}

interface CustomerOrderHistoryProps {
  customerId: string;
  storeId: string;
}

const ITEMS_PER_PAGE = 5;

export function CustomerOrderHistory({ customerId, storeId }: CustomerOrderHistoryProps) {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const { store, setCartItemCount } = useShop();
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);

  // Fetch customer orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['customer-order-history', storeId, customerId],
    queryFn: async (): Promise<CustomerOrder[]> => {
      if (!storeId || !customerId) return [];

      const { data, error } = await (supabase as any)
        .from('marketplace_orders')
        .select('id, order_number, status, total_amount, total, items, created_at, tracking_token')
        .eq('store_id', storeId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch customer orders', error);
        throw error;
      }
      return (data as unknown as CustomerOrder[]) || [];
    },
    enabled: !!storeId && !!customerId,
  });

  // Pagination
  const totalPages = Math.ceil(orders.length / pageSize);
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return orders.slice(startIndex, startIndex + pageSize);
  }, [orders, currentPage, pageSize]);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Reorder - adds all items from an order to cart
  const handleReorder = useCallback((order: CustomerOrder) => {
    if (!order.items || order.items.length === 0) {
      toast({
        title: 'Cannot reorder',
        description: 'This order has no items to add.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const cartKey = `shop_cart_${storeId}`;
      const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');

      order.items.forEach((item: OrderItem) => {
        const existingIndex = cart.findIndex((c: { productId: string }) => c.productId === item.product_id);

        if (existingIndex >= 0) {
          cart[existingIndex].quantity += item.quantity;
        } else {
          cart.push({
            productId: item.product_id,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            imageUrl: item.image_url || null,
          });
        }
      });

      localStorage.setItem(cartKey, JSON.stringify(cart));
      const totalCount = cart.reduce((sum: number, c: { quantity: number }) => sum + c.quantity, 0);
      setCartItemCount(totalCount);

      toast({
        title: 'Items added to cart',
        description: `${order.items.length} item(s) from order #${order.order_number}`,
      });

      navigate(`/shop/${storeSlug}/cart`);
    } catch (error) {
      logger.error('Failed to reorder', error);
      toast({
        title: 'Failed to reorder',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [storeId, storeSlug, navigate, setCartItemCount, toast]);

  // Get total item count for an order
  const getItemCount = (order: CustomerOrder): number => {
    if (!order.items || !Array.isArray(order.items)) return 0;
    return order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  // Empty state
  if (orders.length === 0) {
    return (
      <div className="text-center py-16 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
        <Package className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
        <h3 className="text-xl font-bold mb-2 text-neutral-900">No orders yet</h3>
        <p className="text-neutral-500 mb-6 max-w-sm mx-auto">
          You haven't placed any orders yet. Start exploring our collection today.
        </p>
        <Link to={`/shop/${storeSlug}/products`}>
          <Button
            className="rounded-full px-8 py-6 font-bold shadow-lg hover:shadow-xl transition-all"
            style={{ backgroundColor: store?.primary_color }}
          >
            Start Shopping
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Order summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {orders.length} order{orders.length !== 1 ? 's' : ''} total
        </p>
      </div>

      {/* Order list */}
      <div className="space-y-3">
        {paginatedOrders.map((order) => {
          const itemCount = getItemCount(order);
          const orderTotal = order.total || order.total_amount || 0;

          return (
            <Card key={order.id} className="hover:shadow-md transition-shadow rounded-2xl border-neutral-100">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Order info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-5 h-5 text-neutral-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-neutral-900">
                          #{order.order_number}
                        </p>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatSmartDate(order.created_at)}
                        {' \u2022 '}
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Total + actions */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    <p className="font-bold text-lg text-neutral-900">
                      {formatCurrency(orderTotal)}
                    </p>

                    <ReorderButton
                      order={order}
                      onReorder={handleReorder}
                      primaryColor={store?.primary_color}
                    />

                    {order.tracking_token && (
                      <Link to={`/shop/${storeSlug}/track/${order.tracking_token}`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-neutral-900"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <StandardPagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={orders.length}
          pageSizeOptions={[5, 10, 25]}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          showPageSizeSelector={orders.length > 5}
          showItemCount
        />
      )}
    </div>
  );
}

// Reorder button with loading state
interface ReorderButtonProps {
  order: CustomerOrder;
  onReorder: (order: CustomerOrder) => void;
  primaryColor?: string;
}

function ReorderButton({ order, onReorder, primaryColor }: ReorderButtonProps) {
  const [isReordering, setIsReordering] = useState(false);

  const handleClick = async () => {
    setIsReordering(true);
    try {
      onReorder(order);
    } finally {
      setIsReordering(false);
    }
  };

  const hasItems = order.items && order.items.length > 0;

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={isReordering || !hasItems}
      className="rounded-full font-medium whitespace-nowrap"
      style={primaryColor ? { borderColor: primaryColor, color: primaryColor } : undefined}
    >
      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isReordering ? 'animate-spin' : ''}`} />
      Reorder
    </Button>
  );
}
