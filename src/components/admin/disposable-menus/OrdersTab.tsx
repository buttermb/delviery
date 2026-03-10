import { useState, useMemo } from 'react';
import {
  ShoppingBag, DollarSign, Clock, CheckCircle, TrendingUp,
  ChevronRight, Zap, Target, LayoutGrid, BarChart3, RefreshCw, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useMenuOrders, useUpdateOrderStatus } from '@/hooks/useDisposableMenus';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { format, formatDistanceToNow } from 'date-fns';

// Order type for this component
export interface OrderData {
  id: string;
  status: string;
  total_amount?: number | string | null;
  contact_phone?: string | null;
  created_at?: string | null;
  order_data?: unknown;
  whitelist?: { customer_name?: string | null } | null;
  menu?: { name?: string | null } | null;
}

// Enhanced Order Card with more details
export function OrderCard({ order, onStatusChange, isUpdating }: { order: OrderData; onStatusChange?: (id: string, status: string) => void; isUpdating?: boolean }) {
  const customerName = order.whitelist?.customer_name ?? order.contact_phone ?? 'Unknown';
  const menuName = order.menu?.name ?? 'Menu';
  const total = Number(order.total_amount || 0);
  const parsedData = order.order_data as Record<string, unknown> | null;
  const orderItems = (parsedData?.items as unknown[]) ?? [];
  const itemCount = Array.isArray(orderItems) ? orderItems.length : 0;
  const createdAt = order.created_at ? new Date(order.created_at) : new Date();

  const statusColors: Record<string, string> = {
    pending: 'bg-warning',
    confirmed: 'bg-info',
    completed: 'bg-success',
    delivered: 'bg-success',
    rejected: 'bg-destructive',
  };

  return (
    <Card className="p-4 cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50 group">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate group-hover:text-primary transition-colors">
              {customerName}
            </div>
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <span>{menuName}</span>
              <span>•</span>
              <span>{formatDistanceToNow(createdAt, { addSuffix: true })}</span>
            </div>
          </div>
          <div className={cn(
            "w-2 h-2 rounded-full shrink-0 mt-2",
            statusColors[order.status] ?? 'bg-gray-400'
          )} />
        </div>

        {/* Details */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShoppingBag className="h-3.5 w-3.5" />
              {itemCount} items
            </span>
          </div>
          <div className="font-bold text-success">{formatCurrency(total)}</div>
        </div>

        {/* Quick Actions */}
        {order.status === 'pending' && onStatusChange && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              disabled={isUpdating}
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(order.id, 'confirmed');
              }}
            >
              {isUpdating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive hover:text-destructive"
              disabled={isUpdating}
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(order.id, 'rejected');
              }}
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// Enhanced Orders Tab with better Kanban
export function OrdersTab() {
  const { tenant } = useTenantAdminAuth();
  const { data: orders = [], isLoading, refetch } = useMenuOrders(undefined, tenant?.id);
  const updateOrderStatus = useUpdateOrderStatus(tenant?.id);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [listLimit, setListLimit] = useState(20);

  const ordersByStatus = useMemo(() => ({
    pending: orders.filter((o: OrderData) => o.status === 'pending'),
    confirmed: orders.filter((o: OrderData) => o.status === 'confirmed'),
    completed: orders.filter((o: OrderData) => o.status === 'completed' || o.status === 'delivered'),
    rejected: orders.filter((o: OrderData) => o.status === 'rejected'),
  }), [orders]);

  const stats = useMemo(() => ({
    total: orders.length,
    pending: ordersByStatus.pending.length,
    revenue: orders.reduce((sum: number, o: OrderData) => sum + Number(o.total_amount || 0), 0),
    avgOrder: orders.length > 0
      ? orders.reduce((sum: number, o: OrderData) => sum + Number(o.total_amount || 0), 0) / orders.length
      : 0,
    todayOrders: orders.filter((o: OrderData) => {
      const orderDate = new Date(o.created_at ?? '');
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    }).length,
  }), [orders, ordersByStatus]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-to-br from-info/10 to-info/20 dark:from-info/10 dark:to-info/5 border-info/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-info/20 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-info" />
            </div>
            <div>
              <div className="text-2xl font-bold text-info">{stats.total}</div>
              <div className="text-xs text-info/70">Total Orders</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-warning/10 to-warning/20 dark:from-warning/10 dark:to-warning/5 border-warning/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <div className="text-2xl font-bold text-warning">{stats.pending}</div>
              <div className="text-xs text-warning/70">Pending</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-success/10 to-success/20 dark:from-success/10 dark:to-success/5 border-success/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold text-success">{formatCurrency(stats.revenue)}</div>
              <div className="text-xs text-success/70">Revenue</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/20 dark:from-primary/10 dark:to-primary/5 border-primary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{formatCurrency(stats.avgOrder)}</div>
              <div className="text-xs text-primary/70">Avg Order</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-destructive/10 to-destructive/20 dark:from-destructive/10 dark:to-destructive/5 border-destructive/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">{stats.todayOrders}</div>
              <div className="text-xs text-destructive/70">Today</div>
            </div>
          </div>
        </Card>
      </div>

      {/* View Toggle & Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            List
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Kanban Columns */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pending Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border border-warning/20">
              <h3 className="font-semibold text-warning flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending
              </h3>
              <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                {ordersByStatus.pending.length}
              </Badge>
            </div>
            <div className="space-y-3 min-h-[200px] p-3 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
              {ordersByStatus.pending.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No pending orders</p>
                  <p className="text-xs mt-1">Orders appear here when customers place new orders</p>
                </div>
              ) : (
                ordersByStatus.pending.map((order: OrderData) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isUpdating={updateOrderStatus.isPending}
                    onStatusChange={(id, status) => {
                      updateOrderStatus.mutate({ orderId: id, status });
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Confirmed Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-info/10 rounded-lg border border-info/20">
              <h3 className="font-semibold text-info flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Confirmed
              </h3>
              <Badge variant="outline" className="bg-info/20 text-info border-info/30">
                {ordersByStatus.confirmed.length}
              </Badge>
            </div>
            <div className="space-y-3 min-h-[200px] p-3 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
              {ordersByStatus.confirmed.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No confirmed orders</p>
                </div>
              ) : (
                ordersByStatus.confirmed.map((order: OrderData) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </div>
          </div>

          {/* Completed Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20">
              <h3 className="font-semibold text-success flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Completed
              </h3>
              <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                {ordersByStatus.completed.length}
              </Badge>
            </div>
            <div className="space-y-3 min-h-[200px] max-h-[400px] overflow-y-auto p-3 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
              {ordersByStatus.completed.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No completed orders</p>
                </div>
              ) : (
                <>
                  {ordersByStatus.completed.slice(0, 8).map((order: OrderData) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                  {ordersByStatus.completed.length > 8 && (
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                      View all {ordersByStatus.completed.length} completed
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No orders yet</p>
                <p className="text-sm mt-1">Share your menus with clients to receive orders</p>
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {orders.slice(0, listLimit).map((order: OrderData) => (
                    <div key={order.id} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            order.status === 'pending' && 'bg-warning',
                            order.status === 'confirmed' && 'bg-info',
                            (order.status === 'completed' || order.status === 'delivered') && 'bg-success',
                            order.status === 'rejected' && 'bg-destructive'
                          )} />
                          <div>
                            <div className="font-medium">
                              {order.whitelist?.customer_name ?? order.contact_phone ?? 'Unknown'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {order.menu?.name} • {Array.isArray((order.order_data as Record<string, unknown> | null)?.items) ? ((order.order_data as Record<string, unknown>).items as unknown[]).length : 0} items
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-success">
                            {formatCurrency(Number(order.total_amount || 0))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.created_at && format(new Date(order.created_at), 'MMM d, h:mm a')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {orders.length > listLimit && (
                  <div className="p-4 border-t">
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => setListLimit(prev => prev + 20)}
                    >
                      Show more ({orders.length - listLimit} remaining)
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
