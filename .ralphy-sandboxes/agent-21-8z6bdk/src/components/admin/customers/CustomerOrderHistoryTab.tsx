/**
 * CustomerOrderHistoryTab Component
 *
 * Displays complete order history for a customer with DataTable.
 * Shows order number, date, total, status, items count, payment status.
 * Includes order count and lifetime value stats, pagination, and filters.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ShoppingBag, DollarSign, TrendingUp, Calendar, Filter, X } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/shared/DataTable';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { OrderLink } from '@/components/admin/cross-links';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { useIsMobile } from '@/hooks/use-mobile';

interface CustomerOrderHistoryTabProps {
  customerId: string;
  customerEmail?: string;
  referralSource?: string;
}

interface Order {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  payment_status: string | null;
  order_items: Array<{ id: string; quantity: number }>;
  source?: 'wholesale' | 'storefront';
  order_number?: string;
}

type OrderStatus = 'all' | 'pending' | 'confirmed' | 'processing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'delivered':
      return 'default';
    case 'cancelled':
    case 'refunded':
      return 'destructive';
    case 'pending':
    case 'processing':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getPaymentStatusStyles(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'paid':
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'pending':
    case 'awaiting':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400';
    case 'failed':
    case 'refunded':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
    case 'partial':
      return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
  }
}

export function CustomerOrderHistoryTab({ customerId, customerEmail, referralSource }: CustomerOrderHistoryTabProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const isMobile = useIsMobile();
  const tenantId = tenant?.id;

  // Filter state
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Fetch wholesale orders
  const {
    data: wholesaleOrders,
    isLoading: isLoadingWholesale,
    isError: isWholesaleError,
    error: wholesaleError,
  } = useQuery({
    queryKey: queryKeys.customerDetail.orders(customerId, tenantId),
    queryFn: async () => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const { data, error: queryError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_amount,
          status,
          payment_status,
          order_items(id, quantity)
        `)
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (queryError) {
        logger.error('Failed to fetch customer orders', queryError, { customerId, tenantId });
        throw queryError;
      }

      return (data ?? []).map((o) => ({ ...o, source: 'wholesale' as const })) as Order[];
    },
    enabled: !!customerId && !!tenantId,
  });

  // Fetch storefront orders from marketplace_orders (by customer email)
  const {
    data: storefrontOrders,
    isLoading: isLoadingStorefront,
  } = useQuery({
    queryKey: [...queryKeys.customerDetail.orders(customerId, tenantId), 'storefront', customerEmail],
    queryFn: async () => {
      if (!tenantId || !customerEmail) return [];

      const { data, error: queryError } = await supabase
        .from('marketplace_orders')
        .select('id, created_at, total_amount, status, payment_status, order_number, items, store_id')
        .eq('seller_tenant_id', tenantId)
        .eq('customer_email', customerEmail)
        .not('store_id', 'is', null)
        .order('created_at', { ascending: false });

      if (queryError) {
        logger.error('Failed to fetch storefront orders', queryError, { customerId, tenantId, customerEmail });
        return [];
      }

      return (data ?? []).map((o) => {
        const items = Array.isArray(o.items) ? o.items : [];
        return {
          id: o.id,
          created_at: o.created_at ?? '',
          total_amount: o.total_amount ?? 0,
          status: o.status ?? 'pending',
          payment_status: o.payment_status,
          order_number: o.order_number,
          order_items: items.map((item: Record<string, unknown>, idx: number) => ({
            id: `sf-${o.id}-${idx}`,
            quantity: Number(item.quantity) || 1,
          })),
          source: 'storefront' as const,
        } satisfies Order;
      });
    },
    enabled: !!customerId && !!tenantId && !!customerEmail,
  });

  // Merge both order sources
  const orders = useMemo(() => {
    const all = [...(wholesaleOrders ?? []), ...(storefrontOrders ?? [])];
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [wholesaleOrders, storefrontOrders]);

  const isLoading = isLoadingWholesale || isLoadingStorefront;
  const isError = isWholesaleError;
  const error = wholesaleError;

  // Filter orders based on status and date range
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter((order) => {
      // Status filter
      if (statusFilter !== 'all' && order.status?.toLowerCase() !== statusFilter) {
        return false;
      }

      // Date range filter
      if (dateRange.from || dateRange.to) {
        const orderDate = new Date(order.created_at);
        if (dateRange.from && orderDate < dateRange.from) {
          return false;
        }
        if (dateRange.to) {
          const endOfDay = new Date(dateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          if (orderDate > endOfDay) {
            return false;
          }
        }
      }

      return true;
    });
  }, [orders, statusFilter, dateRange]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!orders || orders.length === 0) {
      return {
        totalOrders: 0,
        lifetimeValue: 0,
        averageOrderValue: 0,
        completedOrders: 0,
      };
    }

    const lifetimeValue = orders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
    const completedOrders = orders.filter(
      (o) => o.status?.toLowerCase() === 'completed' || o.status?.toLowerCase() === 'delivered'
    ).length;

    return {
      totalOrders: orders.length,
      lifetimeValue,
      averageOrderValue: orders.length > 0 ? lifetimeValue / orders.length : 0,
      completedOrders,
    };
  }, [orders]);

  // Define table columns
  const columns = useMemo(
    () => [
      {
        accessorKey: 'id',
        header: 'Order #',
        cell: ({ original }: { original: Order }) => (
          <div className="flex items-center gap-2">
            {original.source === 'storefront' ? (
              <span className="font-mono text-sm font-medium text-muted-foreground">
                #{original.order_number ?? original.id.slice(0, 8).toUpperCase()}
              </span>
            ) : (
              <OrderLink
                orderId={original.id}
                orderNumber={`#${original.id.slice(0, 8).toUpperCase()}`}
                className="font-mono text-sm font-medium"
              />
            )}
            {original.source === 'storefront' && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 leading-4">
                Store
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'created_at',
        header: 'Date',
        cell: ({ original }: { original: Order }) => (
          <span className="text-sm text-muted-foreground">
            {format(new Date(original.created_at), 'MMM d, yyyy h:mm a')}
          </span>
        ),
      },
      {
        accessorKey: 'total_amount',
        header: 'Total',
        cell: ({ original }: { original: Order }) => (
          <span className="font-mono font-semibold">
            {formatCurrency(original.total_amount ?? 0)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ original }: { original: Order }) => (
          <Badge variant={getStatusBadgeVariant(original.status)}>
            {original.status?.charAt(0).toUpperCase() + original.status?.slice(1) || 'Unknown'}
          </Badge>
        ),
      },
      {
        accessorKey: 'order_items',
        header: 'Items',
        cell: ({ original }: { original: Order }) => {
          const itemCount = original.order_items?.reduce((sum, item) => sum + (item.quantity ?? 1), 0) ?? 0;
          return (
            <span className="text-sm">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </span>
          );
        },
      },
      {
        accessorKey: 'payment_status',
        header: 'Payment',
        cell: ({ original }: { original: Order }) => (
          <Badge className={getPaymentStatusStyles(original.payment_status)}>
            {original.payment_status
              ? original.payment_status.charAt(0).toUpperCase() + original.payment_status.slice(1)
              : 'N/A'}
          </Badge>
        ),
      },
    ],
    []
  );

  const clearFilters = () => {
    setStatusFilter('all');
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = statusFilter !== 'all' || dateRange.from || dateRange.to;

  if (isLoading) {
    return (
      <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">
            Order History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    logger.error('Error displaying customer order history', error instanceof Error ? error : new Error(String(error)));
    return (
      <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">
            Order History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load order history. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">
          Order History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{stats.totalOrders}</p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg dark:bg-emerald-900/30">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lifetime Value</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.lifetimeValue)}</p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg dark:bg-purple-900/30">
                <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg. Order Value</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.averageOrderValue)}</p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg dark:bg-amber-900/30">
                <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">
                  {stats.completedOrders}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    / {stats.totalOrders}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                    </>
                  ) : (
                    format(dateRange.from, 'MMM d, yyyy')
                  )
                ) : (
                  <span className="text-muted-foreground">Date Range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  setDateRange({ from: range?.from, to: range?.to });
                }}
                numberOfMonths={isMobile ? 1 : 2}
              />
            </PopoverContent>
          </Popover>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}

          {hasActiveFilters && (
            <span className="text-sm text-muted-foreground ml-2">
              Showing {filteredOrders.length} of {orders?.length ?? 0} orders
            </span>
          )}
        </div>

        {/* Orders Table */}
        {!orders || orders.length === 0 ? (
          <EnhancedEmptyState
            icon={ShoppingBag}
            title="No Orders Yet"
            description="This customer hasn't placed any orders yet."
            primaryAction={{
              label: 'Create Order',
              onClick: () => navigateToAdmin(`pos?customer=${customerId}`),
            }}
            compact
          />
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No orders match the current filters.</p>
            <Button variant="link" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredOrders}
            searchable={true}
            searchPlaceholder="Search orders..."
            searchColumn="id"
            pagination={true}
            pageSize={10}
            emptyMessage="No orders found."
            getRowId={(row) => row.id}
          />
        )}
      </CardContent>
    </Card>
  );
}
