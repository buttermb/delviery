import { logger } from '@/lib/logger';
import { logOrderQuery, logOrderQueryError, logRLSFailure } from '@/lib/debug/logger';
import { logSelectQuery } from '@/lib/debug/queryLogger';
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
import { Package, TrendingUp, Clock, XCircle, Search, Eye, Archive, Trash2, MoreHorizontal, Plus } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { prefetchOnHover } from '@/lib/utils/prefetch';
import { useDebounce } from '@/hooks/useDebounce';
import { TakeTourButton } from '@/components/tutorial/TakeTourButton';
import { ordersTutorial } from '@/lib/tutorials/tutorialConfig';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { SwipeableItem } from '@/components/mobile/SwipeableItem';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from '@/components/ui/drawer';
import { triggerHaptic } from '@/lib/utils/mobile';

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_method?: string;
  user_id: string;
  courier_id?: string;
  user?: {
    full_name: string | null;
    email: string | null;
  };
  order_items?: any[];
}

import { LastUpdated } from "@/components/shared/LastUpdated";
import { BulkActions } from "@/components/shared/BulkActions";
import { Checkbox } from "@/components/ui/checkbox";
import CopyButton from "@/components/CopyButton";
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";

import { useExport } from "@/hooks/useExport";
import { Download } from "lucide-react";

import QuickFilters, { QuickFilter } from "@/components/QuickFilters";

import { useTablePreferences } from "@/hooks/useTablePreferences";

import { useAdminKeyboardShortcuts } from "@/hooks/useAdminKeyboardShortcuts";
import { useRef } from "react";

import { useRecentItems } from "@/hooks/useRecentItems";

export default function Orders() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const { preferences, savePreferences } = useTablePreferences("orders-table");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { addRecentItem } = useRecentItems();

  useAdminKeyboardShortcuts({
    onSearch: () => {
      searchInputRef.current?.focus();
    },
    onCreate: () => {
      navigate('/admin/wholesale-orders');
    }
  });

  const { exportCSV } = useExport();

  // Bulk Actions State
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    type: 'single' | 'bulk';
    id?: string;
  }>({ open: false, type: 'single' });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(orders.map(o => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .in('id', selectedOrders);

      if (error) throw error;

      toast.success(`Updated ${selectedOrders.length} orders to ${status}`);
      loadOrders();
      setSelectedOrders([]);
    } catch (error) {
      logger.error('Error updating orders', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error("Failed to update orders");
    }
  };

  const handleBulkDelete = () => {
    setDeleteConfirmation({ open: true, type: 'bulk' });
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteConfirmation.type === 'single' && deleteConfirmation.id) {
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', deleteConfirmation.id);
        if (error) throw error;
        toast.success("Order deleted successfully");
      } else if (deleteConfirmation.type === 'bulk') {
        const { error } = await supabase
          .from('orders')
          .delete()
          .in('id', selectedOrders);
        if (error) throw error;
        toast.success(`${selectedOrders.length} orders deleted successfully`);
        setSelectedOrders([]);
      }

      triggerHaptic('heavy');
      loadOrders();
    } catch (error) {
      logger.error('Error deleting order(s)', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error("Failed to delete order(s)");
    } finally {
      setDeleteConfirmation({ open: false, type: 'single' });
    }
  };

  const handleExport = () => {
    exportCSV(filteredOrders, { filename: `orders-export-${new Date().toISOString().split('T')[0]}.csv` });
  };

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(preferences.customFilters?.status || 'all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Save preferences when filter changes
  useEffect(() => {
    savePreferences({ customFilters: { status: statusFilter } });
  }, [statusFilter, savePreferences]);

  useEffect(() => {
    if (tenant) {
      loadOrders();
    }
  }, [tenant, statusFilter]); // Reload when filter changes (logic already existed)

  const loadOrders = async () => {
    if (!tenant) return;

    // Debug: Log query initiation
    logOrderQuery('Fetching admin orders', {
      tenantId: tenant.id,
      statusFilter,
      source: 'Orders'
    });

    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: ordersData, error: ordersError } = await query;

      // Debug: Log query results
      logSelectQuery('orders', { tenant_id: tenant.id, status: statusFilter }, ordersData, 'Orders');

      if (ordersError) {
        logRLSFailure('Orders query failed', {
          tenantId: tenant.id,
          error: ordersError.message,
          code: ordersError.code
        });
        logger.error('Error loading orders', ordersError instanceof Error ? ordersError : new Error(String(ordersError)), { component: 'Orders' });
        toast.error(`Failed to load orders: ${ordersError.message}`);
        return;
      }

      // Debug: Log successful fetch
      logOrderQuery('Orders fetched successfully', {
        tenantId: tenant.id,
        count: ordersData?.length || 0,
        orderIds: ordersData?.slice(0, 5).map(o => o.id),
        hasTenantFilter: true,
        source: 'Orders'
      });

      // Fetch profiles for these orders
      const userIds = [...new Set(ordersData?.map(o => o.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        if (profilesError) {
          logger.warn('Error loading profiles', profilesError, { component: 'Orders' });
        } else {
          profilesMap = (profilesData || []).reduce((acc, profile) => {
            acc[profile.user_id] = profile;
            return acc;
          }, {} as Record<string, { user_id: string; full_name: string | null }>);
        }
      }

      // Map profiles to orders
      const enrichedOrders = (ordersData || []).map(order => ({
        ...order,
        user: profilesMap[order.user_id]
      }));

      setOrders(enrichedOrders);
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
  const filteredOrders = orders.filter(order => {
    const query = debouncedSearchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(query) ||
      order.user?.full_name?.toLowerCase().includes(query) ||
      order.user?.email?.toLowerCase().includes(query) ||
      order.total_amount?.toString().includes(query)
    );
  });

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

  const handleRefresh = async () => {
    await loadOrders();
    triggerHaptic('light');
  };

  const handleOrderClick = (order: Order) => {
    // On mobile, open drawer. On desktop, navigate.
    if (window.innerWidth < 768) {
      setSelectedOrder(order);
      setIsDrawerOpen(true);
      triggerHaptic('light');
    } else {
      navigate(`/admin/orders/${order.id}`);
    }
  };

  const handleArchive = (id: string) => {
    toast.success("Order archived (simulated)");
    triggerHaptic('medium');
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmation({ open: true, type: 'single', id });
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // Optimistic update
    const previousOrders = [...orders];
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      logger.error('Error updating status:', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error("Failed to update status");
      setOrders(previousOrders); // Rollback
    }
  };

  return (
    <>
      <SEOHead
        title="Orders Management | Admin"
        description="Manage customer orders and deliveries"
      />

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="w-full max-w-full px-2 sm:px-4 md:px-6 py-2 sm:py-4 md:py-6 space-y-4 sm:space-y-6 overflow-x-hidden pb-24">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Orders Management</h1>
              <LastUpdated date={new Date()} onRefresh={handleRefresh} isLoading={loading} className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="min-h-[48px] touch-manipulation"
                onClick={handleExport}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                variant="default"
                className="min-h-[48px] touch-manipulation shadow-lg shadow-primary/20"
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

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="p-3 sm:p-4 border-none shadow-sm bg-gradient-to-br from-card to-muted/20">
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

          <Card className="p-3 sm:p-4 border-none shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order number or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-base bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-muted/30 border-transparent">
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

            {/* Bulk Actions Bar */}
            <BulkActions
              selectedCount={selectedOrders.length}
              actions={[
                {
                  label: 'Mark as Confirmed',
                  onClick: () => handleBulkStatusChange('confirmed'),
                },
                {
                  label: 'Mark as Preparing',
                  onClick: () => handleBulkStatusChange('preparing'),
                },
                {
                  label: 'Mark as Delivered',
                  onClick: () => handleBulkStatusChange('delivered'),
                },
                {
                  label: 'Mark as Cancelled',
                  onClick: () => handleBulkStatusChange('cancelled'),
                  variant: 'destructive',
                },
              ]}
              onDelete={handleBulkDelete}
              className="mb-4 sticky bottom-4 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 rounded-lg border shadow-lg md:static md:bg-transparent md:border-none md:shadow-none md:p-0"
            />

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <div className="inline-block min-w-full align-middle">
                <Table data-tutorial="orders-list" className="w-full">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                        />
                      </TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold">Order #</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold">Customer</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold" data-tutorial="order-status">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold">Method</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold">Total</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold">Date</TableHead>
                      <TableHead className="text-xs sm:text-sm font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-sm sm:text-base">Loading...</TableCell>
                      </TableRow>
                    ) : filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center justify-center">
                            <div className="bg-muted/30 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                              <Package className="w-8 h-8 text-muted-foreground opacity-50" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">No orders found</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm">
                              {searchQuery || statusFilter !== 'all'
                                ? "We couldn't find any orders matching your current filters."
                                : "You haven't received any orders yet. Create one manually or wait for customers."}
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
                              <Button onClick={() => navigate('/admin/wholesale-orders')}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create First Order
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((order) => (
                        <TableRow key={order.id} className="group hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/admin/orders/${order.id}`)}>
                          <TableCell className="w-[50px]" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                              {order.order_number || order.id.slice(0, 8)}
                              <CopyButton text={order.order_number || order.id} label="Order Number" showLabel={false} className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <div className="flex flex-col">
                              <span className="font-medium">{order.user?.full_name || 'Unknown Customer'}</span>
                              {order.user?.email && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {order.user.email}
                                  <CopyButton text={order.user.email} label="Email" showLabel={false} className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <Select
                              value={order.status}
                              onValueChange={(value) => handleStatusChange(order.id, value)}
                            >
                              <SelectTrigger className="h-8 w-[130px] border-none bg-transparent hover:bg-muted/50 focus:ring-0">
                                <SelectValue>
                                  {getStatusBadge(order.status)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="preparing">Preparing</SelectItem>
                                <SelectItem value="in_transit">In Transit</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="capitalize text-xs sm:text-sm">{order.delivery_method || 'N/A'}</TableCell>
                          <TableCell className="text-xs sm:text-sm font-mono font-medium">${order.total_amount?.toFixed(2)}</TableCell>
                          <TableCell className="text-xs sm:text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/admin/orders/${order.id}`);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(order.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>

          {/* Mobile List View with Swipe Actions */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-muted/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No orders found</h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  {searchQuery || statusFilter !== 'all'
                    ? "We couldn't find any orders matching your current filters."
                    : "You haven't received any orders yet. Create one manually or wait for customers."}
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
                  <Button onClick={() => navigate('/admin/wholesale-orders')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Order
                  </Button>
                )}
              </div>
            ) : (
              filteredOrders.map((order) => (
                <SwipeableItem
                  key={order.id}
                  leftAction={{
                    icon: <Trash2 className="h-5 w-5" />,
                    color: 'bg-destructive',
                    label: 'Delete',
                    onClick: () => handleDelete(order.id)
                  }}
                  rightAction={{
                    icon: <Archive className="h-5 w-5" />,
                    color: 'bg-blue-500',
                    label: 'Archive',
                    onClick: () => handleArchive(order.id)
                  }}
                >
                  <Card
                    className="overflow-hidden cursor-pointer active:scale-[0.98] transition-transform border-none shadow-sm"
                    onClick={() => handleOrderClick(order)}
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                              onClick={(e) => e.stopPropagation()}
                              className="mr-2"
                            />
                            <span className="font-mono font-bold text-primary">
                              #{order.order_number || order.id.slice(0, 8)}
                            </span>
                          </div>
                          <p className="text-sm font-medium">
                            {order.user?.full_name || 'Unknown Customer'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(order.created_at).toLocaleDateString()} • {order.delivery_method}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {getStatusBadge(order.status)}
                          <span className="font-bold font-mono">${order.total_amount?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </SwipeableItem>
              ))
            )}
          </div>
        </div>
      </PullToRefresh>

      <ConfirmDeleteDialog
        open={deleteConfirmation.open}
        onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, open }))}
        onConfirm={handleConfirmDelete}
        itemName={deleteConfirmation.type === 'bulk' ? `${selectedOrders.length} orders` : 'this order'}
        description={deleteConfirmation.type === 'bulk'
          ? "This will permanently delete the selected orders. This action cannot be undone."
          : "This will permanently delete this order. This action cannot be undone."
        }
      />

      {/* Mobile Order Details Drawer */}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Order Details</DrawerTitle>
            <DrawerDescription>
              #{selectedOrder?.order_number || selectedOrder?.id.slice(0, 8)}
            </DrawerDescription>
          </DrawerHeader>

          {selectedOrder && (
            <div className="p-4 space-y-6 overflow-y-auto pb-safe">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                {getStatusBadge(selectedOrder.status)}
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Customer</h4>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <p className="font-medium">{selectedOrder.user?.full_name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.user?.email || 'No email'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Order Summary</h4>
                <div className="bg-muted/30 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>${selectedOrder.total_amount?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Delivery</span>
                    <span>$0.00</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total</span>
                    <span>${selectedOrder.total_amount?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button className="w-full" onClick={() => navigate(`/admin/orders/${selectedOrder.id}`)}>
                  Full Details
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full">Close</Button>
                </DrawerClose>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
