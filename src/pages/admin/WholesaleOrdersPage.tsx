import { logger } from '@/lib/logger';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  Package,
  TrendingUp,
  Clock,
  Truck,
  CheckCircle2,
  Search,
  Plus,
  Download,
  MoreHorizontal,
  Eye,
  AlertCircle,
  RefreshCw,
  DollarSign,
  FileText,
  Edit2,
  XCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { useDebounce } from '@/hooks/useDebounce';
import { useTablePreferences } from '@/hooks/useTablePreferences';
import { useAdminKeyboardShortcuts } from '@/hooks/useAdminKeyboardShortcuts';
import { useExport } from '@/hooks/useExport';
import { BulkActions } from '@/components/shared/BulkActions';
import { LastUpdated } from '@/components/shared/LastUpdated';
import CopyButton from '@/components/CopyButton';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import QuickFilters, { QuickFilter } from '@/components/QuickFilters';
import { queryKeys } from '@/lib/queryKeys';
import { Separator } from '@/components/ui/separator';
import { EditWholesaleOrderDialog } from '@/components/wholesale/EditWholesaleOrderDialog';
import { CancelWholesaleOrderDialog } from '@/components/wholesale/CancelWholesaleOrderDialog';
import { WholesaleInvoiceDownloadButton } from '@/components/wholesale/WholesaleInvoicePDF';

interface WholesaleOrder {
  id: string;
  order_number: string;
  client_id: string;
  runner_id?: string;
  total_amount: number;
  status: string;
  payment_status: string;
  delivery_address: string;
  delivery_notes?: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  client?: {
    business_name: string;
    contact_name: string;
    phone?: string;
  };
  courier?: {
    full_name: string;
    phone?: string;
    vehicle_type?: string;
    status?: string;
  };
  items?: Array<{
    id: string;
    product_name: string;
    quantity_lbs: number;
    unit_price: number;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: CheckCircle2 },
  in_transit: { label: 'In Transit', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: Truck },
  delivered: { label: 'Delivered', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: AlertCircle },
};

const PAYMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Unpaid', color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  partial: { label: 'Partial', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  paid: { label: 'Paid', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
};

export default function WholesaleOrdersPage() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const { preferences, savePreferences } = useTablePreferences('wholesale-orders-table');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { exportCSV } = useExport();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(preferences.customFilters?.status || 'all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<WholesaleOrder | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Keyboard shortcuts
  useAdminKeyboardShortcuts({
    onSearch: () => searchInputRef.current?.focus(),
    onCreate: () => navigate('/admin/wholesale-orders/new'),
  });

  // Save preferences when filter changes
  useEffect(() => {
    savePreferences({ customFilters: { status: statusFilter } });
  }, [statusFilter, savePreferences]);

  // Fetch wholesale orders
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.wholesaleOrders?.list?.({ status: statusFilter, tenantId: tenant?.id }) || ['wholesale-orders', tenant?.id, statusFilter],
    queryFn: async () => {
      if (!tenant?.id) return [];

      // Fetch orders with client and items
      let query = supabase
        .from('wholesale_orders')
        .select(`
          *,
          client:wholesale_clients(business_name, contact_name, phone),
          items:wholesale_order_items(id, product_name, quantity_lbs, unit_price)
        `)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: ordersData, error: ordersError } = await query;

      if (ordersError) {
        logger.error('Failed to fetch wholesale orders', ordersError, { component: 'WholesaleOrdersPage' });
        throw ordersError;
      }

      // Fetch couriers for orders that have runner_id
      const courierIds = [...new Set((ordersData || []).map(o => o.runner_id).filter(Boolean))];
      let couriersMap: Record<string, { full_name: string; phone?: string; vehicle_type?: string; status?: string }> = {};

      if (courierIds.length > 0) {
        const { data: couriersData } = await supabase
          .from('couriers')
          .select('id, full_name, phone, vehicle_type')
          .in('id', courierIds);

        if (couriersData) {
          couriersMap = Object.fromEntries(couriersData.map((c: any) => [c.id, c]));
        }
      }

      // Merge courier data into orders
      const ordersWithCouriers = (ordersData || []).map(order => ({
        ...order,
        courier: order.runner_id ? couriersMap[order.runner_id] : undefined,
      })) as unknown as WholesaleOrder[];

      return ordersWithCouriers;
    },
    enabled: !!tenant?.id,
  });

  // Filter orders by search query
  const filteredOrders = orders.filter((order) => {
    if (!debouncedSearchQuery) return true;
    const query = debouncedSearchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(query) ||
      order.client?.business_name?.toLowerCase().includes(query) ||
      order.client?.contact_name?.toLowerCase().includes(query) ||
      order.courier?.full_name?.toLowerCase().includes(query)
    );
  });

  // Calculate stats
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    inTransit: orders.filter((o) => o.status === 'in_transit').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    totalRevenue: orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
  };

  // Quick filters
  const quickFilters = [
    { id: 'all', label: 'All Orders', count: stats.total },
    { id: 'pending', label: 'Pending', count: stats.pending },
    { id: 'in_transit', label: 'In Transit', count: stats.inTransit },
    { id: 'delivered', label: 'Delivered', count: stats.delivered },
  ] as any;

  // Handlers
  const handleRefresh = async () => {
    await refetch();
    setLastUpdated(new Date());
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrders(checked ? filteredOrders.map((o) => o.id) : []);
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrders((prev) =>
      checked ? [...prev, orderId] : prev.filter((id) => id !== orderId)
    );
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('wholesale_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      toast.success(`Order status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });
    } catch (error) {
      logger.error('Failed to update order status', error, { component: 'WholesaleOrdersPage' });
      toast.error('Failed to update status');
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      const { error } = await supabase
        .from('wholesale_orders')
        .update({ status, updated_at: new Date().toISOString() })
        .in('id', selectedOrders);

      if (error) throw error;

      toast.success(`Updated ${selectedOrders.length} orders to ${STATUS_CONFIG[status]?.label || status}`);
      queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });
      setSelectedOrders([]);
    } catch (error) {
      logger.error('Failed to bulk update orders', error, { component: 'WholesaleOrdersPage' });
      toast.error('Failed to update orders');
    }
  };

  const handleExport = () => {
    const exportData = (selectedOrders.length > 0
      ? filteredOrders.filter((o) => selectedOrders.includes(o.id))
      : filteredOrders
    ).map((order) => ({
      'Order #': order.order_number,
      Client: order.client?.business_name || 'N/A',
      Contact: order.client?.contact_name || 'N/A',
      Total: formatCurrency(order.total_amount),
      Status: STATUS_CONFIG[order.status]?.label || order.status,
      'Payment Status': PAYMENT_STATUS_CONFIG[order.payment_status]?.label || order.payment_status,
      Courier: order.courier?.full_name || 'Unassigned',
      Created: formatSmartDate(order.created_at),
    }));

    exportCSV(exportData, {
      filename: `wholesale-orders-${new Date().toISOString().split('T')[0]}.csv`,
    });
  };

  const handleViewDetails = (order: WholesaleOrder) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  // Bulk actions config
  const bulkActions = [
    {
      label: 'Mark Confirmed',
      onClick: () => handleBulkStatusChange('confirmed'),
    },
    {
      label: 'Mark In Transit',
      onClick: () => handleBulkStatusChange('in_transit'),
    },
    {
      label: 'Mark Delivered',
      onClick: () => handleBulkStatusChange('delivered'),
    },
    {
      label: 'Export Selected',
      onClick: handleExport,
    },
  ];

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="w-full max-w-full space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              📦 Wholesale Orders
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage B2B orders, track deliveries, and process payments
            </p>
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              onClick={() => navigate('/admin/wholesale-orders/new')}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">{stats.pending}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Truck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">In Transit</p>
                <p className="text-xl font-bold">{stats.inTransit}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Delivered</p>
                <p className="text-xl font-bold">{stats.delivered}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search by order #, client, runner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              {/* @ts-ignore - Component prop type mismatch */}
              <QuickFilters
                {...{ filters: quickFilters, activeFilter: statusFilter, onFilterChange: setStatusFilter } as any}
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <LastUpdated date={lastUpdated} onRefresh={handleRefresh} />
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </Card>

        {/* Bulk Actions */}
        {selectedOrders.length > 0 && (
          <div>
            {/* @ts-ignore - Component prop type mismatch */}
            <BulkActions
              {...{ selectedCount: selectedOrders.length, onClear: () => setSelectedOrders([]), actions: bulkActions } as any}
            />
          </div>
        )}

        {/* Orders Table */}
        <Card>
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="p-4 rounded-full bg-muted mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'No orders match your current filters. Try adjusting your search or filters.'
                  : 'Create your first wholesale order to get started.'}
              </p>
              {searchQuery || statusFilter !== 'all' ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <Button
                  onClick={() => navigate('/admin/wholesale-orders/new')}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Create First Order
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedOrders.length === filteredOrders.length &&
                          filteredOrders.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const paymentConfig = PAYMENT_STATUS_CONFIG[order.payment_status] || PAYMENT_STATUS_CONFIG.unpaid;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetails(order)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={(checked) =>
                              handleSelectOrder(order.id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">
                              {order.order_number}
                            </span>
                        {/* @ts-ignore - CopyButton prop mismatch */}
                        <CopyButton value={order.order_number} size="sm" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {order.client?.business_name || 'Unknown Client'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {order.client?.contact_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(order.total_amount)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={order.status}
                            onValueChange={(value) => handleStatusUpdate(order.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <Badge
                                variant="outline"
                                className={`${statusConfig.color} gap-1`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {statusConfig.label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <config.icon className="h-4 w-4" />
                                    {config.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={paymentConfig.color}>
                            {paymentConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {order.courier?.full_name || (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatSmartDate(order.created_at)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewDetails(order)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedOrder(order);
                                setEditDialogOpen(true);
                              }}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit Order
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleStatusUpdate(order.id, 'confirmed')}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark Confirmed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusUpdate(order.id, 'in_transit')}
                              >
                                <Truck className="h-4 w-4 mr-2" />
                                Mark In Transit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusUpdate(order.id, 'delivered')}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Mark Delivered
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setCancelDialogOpen(true);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancel Order
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Order Details Sheet */}
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selectedOrder && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order {selectedOrder.order_number}
                  </SheetTitle>
                  <SheetDescription>
                    Created {formatSmartDate(selectedOrder.created_at)}
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                  {/* Status */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Status</h4>
                    <div className="flex gap-2">
                      <Badge
                        variant="outline"
                        className={STATUS_CONFIG[selectedOrder.status]?.color}
                      >
                        {STATUS_CONFIG[selectedOrder.status]?.label || selectedOrder.status}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={PAYMENT_STATUS_CONFIG[selectedOrder.payment_status]?.color}
                      >
                        {PAYMENT_STATUS_CONFIG[selectedOrder.payment_status]?.label ||
                          selectedOrder.payment_status}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* Client Info */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Client</h4>
                    <Card className="p-4">
                      <p className="font-semibold">
                        {selectedOrder.client?.business_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedOrder.client?.contact_name}
                      </p>
                      {selectedOrder.client?.phone && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedOrder.client.phone}
                        </p>
                      )}
                    </Card>
                  </div>

                  {/* Order Items */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Items</h4>
                    <Card className="p-4 space-y-3">
                      {selectedOrder.items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center text-sm"
                        >
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-muted-foreground">
                              {item.quantity_lbs} lbs @ {formatCurrency(item.unit_price)}/lb
                            </p>
                          </div>
                          <p className="font-mono font-semibold">
                            {formatCurrency(item.quantity_lbs * item.unit_price)}
                          </p>
                        </div>
                      )) || (
                        <p className="text-muted-foreground text-sm">No items</p>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center font-semibold">
                        <span>Total</span>
                        <span className="font-mono">
                          {formatCurrency(selectedOrder.total_amount)}
                        </span>
                      </div>
                    </Card>
                  </div>

                  {/* Delivery Info */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Delivery</h4>
                    <Card className="p-4">
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Courier: </span>
                          <span className="font-medium">
                            {selectedOrder.courier?.full_name || 'Unassigned'}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Address: </span>
                          <span>{selectedOrder.delivery_address || 'Not specified'}</span>
                        </div>
                        {selectedOrder.delivery_notes && (
                          <div>
                            <span className="text-muted-foreground">Notes: </span>
                            <span>{selectedOrder.delivery_notes}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3">
                    {/* Status Update */}
                    <div className="flex gap-2">
                      <Select
                        value={selectedOrder.status}
                        onValueChange={(value) => {
                          handleStatusUpdate(selectedOrder.id, value);
                          setSelectedOrder({ ...selectedOrder, status: value });
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Update Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <config.icon className="h-4 w-4" />
                                {config.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Invoice & Actions */}
                    <div className="flex flex-wrap gap-2">
                      <WholesaleInvoiceDownloadButton
                        invoice={{
                          orderNumber: selectedOrder.order_number,
                          orderDate: selectedOrder.created_at,
                          dueDate: new Date(new Date(selectedOrder.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                          clientName: selectedOrder.client?.business_name || 'Unknown Client',
                          clientContact: selectedOrder.client?.contact_name,
                          clientPhone: selectedOrder.client?.phone,
                          companyName: tenant?.business_name || 'Your Company',
                          items: selectedOrder.items || [],
                          subtotal: selectedOrder.total_amount,
                          total: selectedOrder.total_amount,
                          paymentTerms: selectedOrder.payment_status === 'paid' ? 'Paid' : 'Net 7 Days',
                          paymentStatus: selectedOrder.payment_status,
                        }}
                        variant="outline"
                        size="sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDetailsOpen(false);
                          setEditDialogOpen(true);
                        }}
                        className="gap-2"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </Button>
                      {selectedOrder.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDetailsOpen(false);
                            setCancelDialogOpen(true);
                          }}
                          className="gap-2 text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-4 w-4" />
                          Cancel
                        </Button>
                      )}
                    </div>

                    <Button variant="outline" onClick={() => setDetailsOpen(false)} className="w-full">
                      Close
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Edit Order Dialog */}
        <EditWholesaleOrderDialog
          order={selectedOrder}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });
          }}
        />

        {/* Cancel Order Dialog */}
        <CancelWholesaleOrderDialog
          order={selectedOrder}
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });
          }}
        />
      </div>
    </PullToRefresh>
  );
}

