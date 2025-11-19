import { useState, useEffect } from 'react';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Package, TrendingUp, Clock, XCircle, Search, Eye } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { prefetchOnHover } from '@/lib/utils/prefetch';
import { logger } from '@/lib/logger';
import { useDebounce } from '@/hooks/useDebounce';
import { TakeTourButton } from '@/components/tutorial/TakeTourButton';
import { ordersTutorial } from '@/lib/tutorials/tutorialConfig';
import { useEncryption } from '@/lib/hooks/useEncryption';

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_method?: string;
  user_id: string;
  courier_id?: string;
}

export default function Orders() {
  const navigate = useTenantNavigate();
  const { decryptObject, isReady: encryptionIsReady } = useEncryption();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) {
        logger.error('Error loading orders', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
        toast.error(`Failed to load orders: ${error.message}`);
        return;
      }
      
      // Orders are NOT encrypted - use plaintext fields directly
      setOrders(data || []);
    } catch (error: unknown) {
      logger.error('Unexpected error loading orders', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error('Failed to load orders. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  // Filter orders with debounced search
  const filteredOrders = orders.filter(order =>
    order.order_number?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      confirmed: "default",
      preparing: "default",
      ready: "default",
      in_transit: "default",
      delivered: "outline",
      cancelled: "destructive"
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const stats = [
    { label: 'Total Orders', value: orders.length, icon: Package, color: 'text-blue-500' },
    { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, icon: Clock, color: 'text-yellow-500' },
    { label: 'In Progress', value: orders.filter(o => ['confirmed', 'preparing', 'in_transit'].includes(o.status)).length, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Cancelled', value: orders.filter(o => o.status === 'cancelled').length, icon: XCircle, color: 'text-red-500' },
  ];

  return (
    <>
      <SEOHead 
        title="Orders Management | Admin"
        description="Manage customer orders and deliveries"
      />
      
      <div className="w-full max-w-full px-2 sm:px-4 md:px-6 py-2 sm:py-4 md:py-6 space-y-4 sm:space-y-6 overflow-x-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Orders Management</h1>
          <div className="flex gap-2">
            <Button 
              variant="default"
              className="min-h-[48px] touch-manipulation"
              data-tutorial="create-order"
            >
              + New Order
            </Button>
            <TakeTourButton
              tutorialId={ordersTutorial.id}
              steps={ordersTutorial.steps}
              variant="outline"
              size="sm"
              className="min-h-[48px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                    <p className="text-xl sm:text-2xl font-bold">{stat.value}</p>
                  </div>
                  <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${stat.color} flex-shrink-0`} />
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order number or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-base"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <Table data-tutorial="orders-list" className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sm:text-sm">Order #</TableHead>
                <TableHead className="text-xs sm:text-sm">Customer</TableHead>
                <TableHead className="text-xs sm:text-sm" data-tutorial="order-status">Status</TableHead>
                <TableHead className="text-xs sm:text-sm">Method</TableHead>
                <TableHead className="text-xs sm:text-sm">Total</TableHead>
                <TableHead className="text-xs sm:text-sm">Date</TableHead>
                <TableHead className="text-xs sm:text-sm">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm sm:text-base">Loading...</TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm sm:text-base">No orders found</TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id} className="touch-manipulation">
                    <TableCell className="font-medium text-xs sm:text-sm">{order.order_number || order.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs sm:text-sm">
                      <p className="font-medium">Customer</p>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="capitalize text-xs sm:text-sm">{order.delivery_method || 'N/A'}</TableCell>
                    <TableCell className="text-xs sm:text-sm font-mono">${order.total_amount?.toFixed(2)}</TableCell>
                    <TableCell className="text-xs sm:text-sm">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-[48px] min-w-[48px] touch-manipulation"
                        onMouseEnter={() => prefetchOnHover(`/admin/orders/${order.id}`)}
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
            </div>
          </div>
        </Card>

        {/* Mobile Card View */}
        <Card className="md:hidden">
          <div className="space-y-3 p-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No orders found</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <Card 
                  key={order.id} 
                  className="overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.98]"
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <h3 className="font-semibold text-base truncate">
                            {order.order_number || order.id.slice(0, 8)}
                          </h3>
                        </div>
                        <p className="text-sm text-muted-foreground">Customer</p>
                      </div>
                      <div className="flex-shrink-0">
                        {getStatusBadge(order.status)}
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Method</div>
                          <div className="text-sm capitalize">{order.delivery_method || 'N/A'}</div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</div>
                          <div className="text-sm">{new Date(order.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</div>
                          <div className="text-lg font-semibold font-mono">${order.total_amount?.toFixed(2)}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="min-h-[48px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/orders/${order.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          <span className="text-xs">View</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
