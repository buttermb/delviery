/**
 * Unified Orders Demo Page
 * 
 * This page demonstrates how to use the new unified orders hooks.
 * It can handle all order types (retail, wholesale, menu, pos) with
 * a single component and hook.
 */

import { useState } from 'react';
import { useUnifiedOrders, useOrderStats, useUpdateOrderStatus } from '@/hooks/unified';
import type { OrderType, OrderStatus } from '@/hooks/unified';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RefreshCw,
  Search,
} from 'lucide-react';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle2 },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-800', icon: RefreshCw },
  in_transit: { label: 'In Transit', color: 'bg-orange-100 text-orange-800', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-800', icon: RefreshCw },
};

export function UnifiedOrdersDemo() {
  const [orderType, setOrderType] = useState<OrderType>('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch orders with the unified hook
  const { 
    data: orders, 
    isLoading, 
    refetch 
  } = useUnifiedOrders({
    orderType,
    status: statusFilter,
    realtime: true, // Enable real-time updates
  });

  // Get stats for the current order type
  const { data: stats } = useOrderStats(orderType);

  // Mutation for status updates
  const updateStatus = useUpdateOrderStatus();

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await updateStatus.mutateAsync({ orderId, status: newStatus });
      toast.success(`Order status updated to ${statusConfig[newStatus].label}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Filter orders by search
  const filteredOrders = orders?.filter(order => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(search) ||
      order.client?.business_name?.toLowerCase().includes(search) ||
      order.customer?.email?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Unified Orders</h1>
          <p className="text-muted-foreground">
            All order types in one view (retail, wholesale, menu, POS)
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Transit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.in_transit || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats?.revenue || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Tabs value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="wholesale">Wholesale</TabsTrigger>
            <TabsTrigger value="retail">Retail</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="pos">POS</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select 
          value={statusFilter || 'all'} 
          onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : v as OrderStatus)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(statusConfig).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Customer/Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                </TableRow>
              ))
            ) : filteredOrders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders?.map((order) => {
                const status = statusConfig[order.status as OrderStatus] || statusConfig.pending;
                const StatusIcon = status.icon;
                
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {order.order_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.client?.business_name || 
                       (order.customer && `${order.customer.first_name} ${order.customer.last_name}`) ||
                       order.contact_name ||
                       '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(order.total_amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatSmartDate(order.created_at)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={order.status}
                        onValueChange={(v) => handleStatusChange(order.id, v as OrderStatus)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default UnifiedOrdersDemo;

