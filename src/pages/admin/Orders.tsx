import { logger } from '@/lib/logger';
import { logOrderQuery, logRLSFailure } from '@/lib/debug/logger';
import { logSelectQuery } from '@/lib/debug/queryLogger';
import { useState, useEffect, useMemo } from 'react';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, TrendingUp, Clock, XCircle, Eye, Archive, Trash2, Plus, Download, MoreHorizontal, Printer, FileText, X, Store, Monitor, Utensils, Zap, Truck, CheckCircle, WifiOff, UserPlus } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TakeTourButton } from '@/components/tutorial/TakeTourButton';
import { ordersTutorial } from '@/lib/tutorials/tutorialConfig';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { SwipeableItem } from '@/components/mobile/SwipeableItem';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from '@/components/ui/drawer';
import { triggerHaptic } from '@/lib/utils/mobile';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { LastUpdated } from "@/components/shared/LastUpdated";
import { BulkActionsBar } from "@/components/ui/BulkActionsBar";
import { OrderBulkStatusConfirmDialog } from "@/components/admin/orders/OrderBulkStatusConfirmDialog";
import { BulkAssignRunnerDialog } from "@/components/admin/orders/BulkAssignRunnerDialog";
import { BulkOperationProgress } from "@/components/ui/bulk-operation-progress";
import { useOrderBulkStatusUpdate } from "@/hooks/useOrderBulkStatusUpdate";
import { Checkbox } from "@/components/ui/checkbox";
import CopyButton from "@/components/CopyButton";
import { CustomerLink } from "@/components/admin/cross-links";
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { useExport } from "@/hooks/useExport";
import { ExportOptionsDialog, type ExportField } from "@/components/admin/ExportOptionsDialog";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { useAdminKeyboardShortcuts } from "@/hooks/useAdminKeyboardShortcuts";
import { useAdminOrdersRealtime } from "@/hooks/useAdminOrdersRealtime";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { DateRangePickerWithPresets } from "@/components/ui/date-picker-with-presets";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  delivery_method?: string;
  user_id: string;
  courier_id?: string;
  order_source?: string;
  user?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  order_items?: unknown[];
}

export default function Orders() {
  const navigate = useTenantNavigate();
  const { tenant, admin } = useTenantAdminAuth();
  const { preferences, savePreferences } = useTablePreferences("orders-table");
  const queryClient = useQueryClient();

  useAdminKeyboardShortcuts({
    onSearch: () => {
      // Focus search input handled by SearchInput component logic if refs were exposed, 
      // but for now we rely on user manually clicking or using standard browser shortcuts
      const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
      if (searchInput) searchInput.focus();
    },
    onCreate: () => {
      navigate('orders?tab=wholesale');
    }
  });

  const { exportCSV } = useExport();

  // Real-time subscription for new orders (storefront + regular)
  const { newOrderIds } = useAdminOrdersRealtime({
    enabled: !!tenant?.id,
    onNewOrder: (event) => {
      const sourceLabel = event.source === 'storefront' ? 'Storefront' : event.source;
      toast.success(`New ${sourceLabel} order #${event.orderNumber}`, {
        description: `${event.customerName} - $${event.totalAmount.toFixed(2)}`,
      });
    },
  });

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(preferences.customFilters?.status || 'all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    type: 'single' | 'bulk';
    id?: string;
  }>({ open: false, type: 'single' });
  const [bulkStatusConfirm, setBulkStatusConfirm] = useState<{
    open: boolean;
    targetStatus: string;
  }>({ open: false, targetStatus: '' });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [assignRunnerDialogOpen, setAssignRunnerDialogOpen] = useState(false);

  // Bulk status update hook with userId for activity logging
  const bulkStatusUpdate = useOrderBulkStatusUpdate({
    tenantId: tenant?.id,
    userId: admin?.id,
    onSuccess: () => {
      setSelectedOrders([]);
    },
  });

  // Save preferences when filter changes
  useEffect(() => {
    savePreferences({ customFilters: { status: statusFilter } });
  }, [statusFilter, savePreferences]);

  // Data Fetching - includes both regular orders and POS orders from unified_orders
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', tenant?.id, statusFilter],
    queryFn: async () => {
      if (!tenant) return [];

      logOrderQuery('Fetching admin orders', {
        tenantId: tenant.id,
        statusFilter,
        source: 'Orders'
      });

      // Fetch regular orders
      let regularQuery = supabase
        .from('orders')
        .select('id, order_number, created_at, status, total_amount, user_id, courier_id, tenant_id, order_items(id, product_id, quantity, price)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        regularQuery = regularQuery.eq('status', statusFilter);
      }

      const { data: ordersData, error: ordersError } = await regularQuery;

      if (ordersError) {
        logRLSFailure('Orders query failed', {
          tenantId: tenant.id,
          error: ordersError.message,
          code: ordersError.code
        });
        throw ordersError;
      }

      logSelectQuery('orders', { tenant_id: tenant.id, status: statusFilter }, ordersData, 'Orders');

      // Fetch POS orders from unified_orders
      let posQuery = supabase
        .from('unified_orders')
        .select('id, order_number, created_at, status, total_amount, payment_method, customer_id, shift_id, metadata')
        .eq('tenant_id', tenant.id)
        .eq('order_type', 'pos')
        .order('created_at', { ascending: false })
        .limit(50);

      if (statusFilter !== 'all') {
        posQuery = posQuery.eq('status', statusFilter);
      }

      const { data: posOrdersData, error: posError } = await posQuery;

      if (posError) {
        // Non-fatal - just log and continue with regular orders
        logger.warn('Failed to fetch POS orders from unified_orders', { error: posError.message });
      }

      // Transform POS orders to match Order interface
      const transformedPosOrders: Order[] = (posOrdersData || []).map(posOrder => ({
        id: posOrder.id,
        order_number: posOrder.order_number,
        created_at: posOrder.created_at,
        status: posOrder.status,
        total_amount: posOrder.total_amount || 0,
        delivery_method: 'pickup', // POS orders are typically pickup/in-store
        user_id: posOrder.customer_id || '',
        courier_id: undefined,
        order_source: 'pos',
        order_items: [], // Items stored in metadata for POS orders
        user: {
          full_name: 'POS Sale',
          email: null,
          phone: null,
        }
      }));

      // Fetch profiles for regular orders
      const userIds = [...new Set(ordersData?.map(o => o.user_id).filter(Boolean))];
      let profilesMap: Record<string, { user_id: string; full_name: string | null; email: string | null; phone: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, first_name, last_name, phone')
          .in('user_id', userIds);

        profilesMap = (profilesData || []).reduce((acc, profile: { user_id: string; full_name: string | null; first_name: string | null; last_name: string | null; phone: string | null }) => {
          // Build display name with fallbacks
          const displayName = profile.full_name
            || [profile.first_name, profile.last_name].filter(Boolean).join(' ')
            || null;
          acc[profile.user_id] = {
            user_id: profile.user_id,
            full_name: displayName,
            email: null,
            phone: profile.phone || null
          };
          return acc;
        }, {} as Record<string, { user_id: string; full_name: string | null; email: string | null; phone: string | null }>);
      }

      // Merge regular orders with user info
      const regularOrdersWithUsers = (ordersData || []).map(order => ({
        ...order,
        delivery_method: order.delivery_method || '',
        user: order.user_id ? profilesMap[order.user_id] : undefined
      })) as Order[];

      // Combine and sort by date (most recent first)
      const allOrders = [...regularOrdersWithUsers, ...transformedPosOrders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 100); // Limit total results

      return allOrders;
    },
    enabled: !!tenant?.id,
    staleTime: 15_000,
    gcTime: 120_000,
  });

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id).eq('tenant_id', tenant?.id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: (data) => {
      toast.success(`Order status updated to ${data.status}`);
      queryClient.setQueryData(['orders', tenant?.id, statusFilter], (old: Order[] = []) =>
        old.map(o => o.id === data.id ? { ...o, status: data.status } : o)
      );
    },
    onError: (error) => {
      logger.error('Error updating status:', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error("Failed to update status");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('orders').delete().in('id', ids).eq('tenant_id', tenant?.id);
      if (error) throw error;
      return ids;
    },
    onSuccess: (ids) => {
      const count = ids.length;
      toast.success(`${count} order${count > 1 ? 's' : ''} deleted successfully`);
      refetch();
      setSelectedOrders([]);
      triggerHaptic('heavy');
    },
    onError: (error) => {
      logger.error('Error deleting order(s)', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error("Failed to delete order(s)");
    }
  });

  // Filter Logic
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(order =>
        order.order_number?.toLowerCase().includes(query) ||
        order.user?.full_name?.toLowerCase().includes(query) ||
        order.user?.email?.toLowerCase().includes(query) ||
        order.total_amount?.toString().includes(query)
      );
    }

    // Date range filter
    if (dateRange.from || dateRange.to) {
      result = result.filter(order => {
        if (!order.created_at) return false;
        const orderDate = new Date(order.created_at);

        if (dateRange.from && dateRange.to) {
          return isWithinInterval(orderDate, {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to),
          });
        }
        if (dateRange.from) {
          return orderDate >= startOfDay(dateRange.from);
        }
        if (dateRange.to) {
          return orderDate <= endOfDay(dateRange.to);
        }
        return true;
      });
    }

    return result;
  }, [orders, searchQuery, dateRange]);

  // Handlers
  const handleRefresh = async () => {
    await refetch();
    triggerHaptic('light');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map(o => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrders(prev =>
      checked ? [...prev, orderId] : prev.filter(id => id !== orderId)
    );
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const handleBulkStatusChange = async (status: string) => {
    if (!tenant?.id) {
      toast.error("No tenant context available");
      return;
    }

    // Optimistic update: capture previous state for rollback
    const previousOrders = orders;

    // Optimistically update the UI
    queryClient.setQueryData(['orders', tenant.id, statusFilter], (old: Order[] = []) =>
      old.map(o => selectedOrders.includes(o.id) ? { ...o, status } : o)
    );

    const now = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('orders')
        .update({
          status,
          ...(status === 'delivered' && { delivered_at: now }),
          ...(status === 'in_transit' && { courier_assigned_at: now }),
          ...(status === 'confirmed' && { accepted_at: now }),
          updated_at: now
        })
        .in('id', selectedOrders)
        .eq('tenant_id', tenant.id); // CRITICAL: Tenant isolation

      if (error) throw error;

      toast.success(`Updated ${selectedOrders.length} orders to ${status}`);
      // Invalidate related queries for consistency
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setSelectedOrders([]);
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(['orders', tenant.id, statusFilter], previousOrders);
      logger.error('Error updating orders in bulk', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error("Failed to update orders");
    }
    setBulkStatusConfirm({ open: true, targetStatus: status });
  };

  const handleConfirmBulkStatusUpdate = async () => {
    if (!tenant?.id) return;

    setBulkStatusConfirm({ open: false, targetStatus: '' });

    // Execute the bulk status update
    await bulkStatusUpdate.executeBulkUpdate(
      selectedOrders.map(id => ({ id, status: bulkStatusConfirm.targetStatus })),
      bulkStatusConfirm.targetStatus
    );
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || dateRange.from || dateRange.to;

  const handleDelete = (id: string) => {
    setDeleteConfirmation({ open: true, type: 'single', id });
  };

  const handleBulkDelete = () => {
    setDeleteConfirmation({ open: true, type: 'bulk' });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmation.type === 'single' && deleteConfirmation.id) {
      deleteMutation.mutate([deleteConfirmation.id]);
    } else if (deleteConfirmation.type === 'bulk') {
      deleteMutation.mutate(selectedOrders);
    }
    setDeleteConfirmation({ ...deleteConfirmation, open: false });
  };

  const orderExportFields: ExportField[] = [
    {
      value: 'customer_name',
      label: 'Customer Name',
      description: 'Include the customer full name for each order',
      recommended: true,
    },
    {
      value: 'customer_email',
      label: 'Customer Email',
      description: 'Include the customer email address',
      recommended: true,
    },
    {
      value: 'line_items',
      label: 'Line Items',
      description: 'Include product names, quantities, and prices for each order item',
    },
  ];

  const handleExportWithOptions = (selectedFields: string[]) => {
    const includeCustomerName = selectedFields.includes('customer_name');
    const includeCustomerEmail = selectedFields.includes('customer_email');
    const includeLineItems = selectedFields.includes('line_items');

    if (includeLineItems) {
      // Flatten: one row per line item
      const flatRows = filteredOrders.flatMap(order => {
        const items = order.order_items && order.order_items.length > 0
          ? order.order_items
          : [{ product_name: '', quantity: 0, price: 0, id: '', product_id: '' }];

        return items.map(item => ({
          order_number: order.order_number || order.id.slice(0, 8),
          status: order.status,
          total_amount: order.total_amount,
          delivery_method: order.delivery_method || '',
          created_at: order.created_at,
          ...(includeCustomerName && { customer_name: order.user?.full_name || '' }),
          ...(includeCustomerEmail && { customer_email: order.user?.email || '' }),
          item_product_name: (item as any).product_name || '',
          item_quantity: (item as any).quantity || 0,
          item_price: (item as any).price || 0,
        }));
      });
      exportCSV(flatRows, { filename: `orders-export-${new Date().toISOString().split('T')[0]}.csv` });
    } else {
      // Standard: one row per order
      const rows = filteredOrders.map(order => ({
        order_number: order.order_number || order.id.slice(0, 8),
        status: order.status,
        total_amount: order.total_amount,
        delivery_method: order.delivery_method || '',
        created_at: order.created_at,
        ...(includeCustomerName && { customer_name: order.user?.full_name || '' }),
        ...(includeCustomerEmail && { customer_email: order.user?.email || '' }),
      }));
      exportCSV(rows, { filename: `orders-export-${new Date().toISOString().split('T')[0]}.csv` });
    }

    setExportDialogOpen(false);
  };

  const handlePrintOrder = (order: Order) => {
    // Open print dialog with order details
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Order #${order.order_number || order.id.slice(0, 8)}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { font-size: 24px; margin-bottom: 20px; }
              .info { margin-bottom: 10px; }
              .label { font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>Order #${order.order_number || order.id.slice(0, 8)}</h1>
            <div class="info"><span class="label">Status:</span> ${order.status}</div>
            <div class="info"><span class="label">Customer:</span> ${order.user?.full_name || order.user?.email || 'Unknown'}</div>
            <div class="info"><span class="label">Total:</span> $${order.total_amount?.toFixed(2)}</div>
            <div class="info"><span class="label">Date:</span> ${order.created_at ? format(new Date(order.created_at), 'PPpp') : 'N/A'}</div>
            <div class="info"><span class="label">Delivery Method:</span> ${order.delivery_method || 'N/A'}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
    triggerHaptic('light');
  };

  const handleGenerateInvoice = (order: Order) => {
    toast.success(`Invoice generated for order #${order.order_number || order.id.slice(0, 8)}`);
    triggerHaptic('light');
  };

  const handleCancelOrder = async (order: Order) => {
    if (!tenant?.id) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      toast.success(`Order #${order.order_number || order.id.slice(0, 8)} cancelled`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      triggerHaptic('medium');
    } catch (error) {
      logger.error('Error cancelling order', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error("Failed to cancel order");
    }
  };

  const handleOrderClick = (order: Order) => {
    if (window.innerWidth < 768) {
      setSelectedOrder(order);
      setIsDrawerOpen(true);
      triggerHaptic('light');
    } else {
      navigate(`orders/${order.id}`);
    }
  };

  // Helper
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

  const getSourceBadge = (source: string | undefined) => {
    const sourceConfig: Record<string, { label: string; icon: typeof Store; className: string }> = {
      storefront: { label: 'Storefront', icon: Store, className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
      admin: { label: 'Admin', icon: Monitor, className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
      pos: { label: 'POS', icon: Monitor, className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
      menu: { label: 'Menu', icon: Utensils, className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' },
      api: { label: 'API', icon: Zap, className: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800' },
    };
    const config = sourceConfig[source || 'admin'] || sourceConfig.admin;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`gap-1 text-xs font-medium ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Table Config
  const columns: ResponsiveColumn<Order>[] = [
    {
      header: (
        <Checkbox
          checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
        />
      ) as unknown as string, // Cast to string to satisfy older interfaces if strict type checking fails intermittently, though we updated it.
      className: "w-[50px]",
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedOrders.includes(order.id)}
            onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
          />
        </div>
      )
    },
    {
      header: "Order #",
      cell: (order) => (
        <div className="flex items-center gap-2">
          <span className={newOrderIds.has(order.id) ? 'font-bold text-primary' : ''}>
            {order.order_number || order.id.slice(0, 8)}
          </span>
          <CopyButton text={order.order_number || order.id} label="Order Number" showLabel={false} className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )
    },
    {
      header: "Source",
      cell: (order) => getSourceBadge(order.order_source),
      className: "w-[120px]"
    },
    {
      header: "Customer",
      cell: (order) => (
        <div className="flex flex-col gap-1">
          <CustomerLink
            customerId={order.user_id}
            customerName={order.user?.full_name || order.user?.email || order.user?.phone || ''}
            customerEmail={order.user?.email}
            className="font-medium"
          />
          {order.user?.email && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {order.user.email}
              <CopyButton text={order.user.email} label="Email" showLabel={false} className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          {!order.user?.email && order.user?.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {order.user.phone}
              <CopyButton text={order.user.phone} label="Phone" showLabel={false} className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>
      )
    },
    {
      header: "Status",
      cell: (order) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Select value={order.status} onValueChange={(value) => handleStatusChange(order.id, value)}>
            <SelectTrigger className="h-8 w-[130px] border-none bg-transparent hover:bg-muted/50 focus:ring-0 p-0">
              <SelectValue>{getStatusBadge(order.status)}</SelectValue>
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
        </div>
      )
    },
    { header: "Method", accessorKey: "delivery_method", className: "capitalize" },
    {
      header: "Total",
      cell: (order) => <span className="font-mono font-medium">${order.total_amount?.toFixed(2)}</span>
    },
    {
      header: "Date",
      cell: (order) => <span className="text-muted-foreground">{formatSmartDate(order.created_at)}</span>
    },
    {
      header: "Actions",
      cell: (order) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => navigate(`orders/${order.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`orders/${order.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePrintOrder(order)}>
                <Printer className="mr-2 h-4 w-4" />
                Print Order
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleGenerateInvoice(order)}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Invoice
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {order.status !== 'cancelled' && (
                <DropdownMenuItem
                  onClick={() => handleCancelOrder(order)}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Order
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => handleDelete(order.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ];

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

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="w-full max-w-full px-2 sm:px-4 md:px-6 py-2 sm:py-4 md:py-6 space-y-4 sm:space-y-6 overflow-x-hidden pb-24">

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Orders Management</h1>
              <LastUpdated date={new Date()} onRefresh={handleRefresh} isLoading={isLoading} className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="min-h-[48px] touch-manipulation"
                onClick={() => setExportDialogOpen(true)}
                disabled={filteredOrders.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
                <Button
                  variant="outline"
                  className="min-h-[48px] touch-manipulation"
                  onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/orders/offline-create`)}
                >
                  <WifiOff className="mr-2 h-4 w-4" />
                  Offline Order
                </Button>
                <Button
                  variant="default"
                  className="min-h-[48px] touch-manipulation shadow-lg shadow-primary/20"
                  onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/wholesale-orders/new`)}
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

          {/* Controls */}
          <Card className="p-3 sm:p-4 border-none shadow-sm">
            <div className="flex flex-col gap-3 sm:gap-4 mb-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <SearchInput
                    defaultValue={searchQuery}
                    onSearch={setSearchQuery}
                    placeholder="Search orders, customers, total..."
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
                <DateRangePickerWithPresets
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  placeholder="Filter by date"
                  className="w-full sm:w-[220px] bg-muted/30 border-transparent"
                />
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-10 px-3"
                  >
                    <X className="mr-1 h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Bulk Actions - handled by floating BulkActionsBar below */}

            {/* Responsive Table */}
            <ResponsiveTable<Order>
              data={filteredOrders}
              columns={columns}
              isLoading={isLoading}
              keyExtractor={(item) => item.id}
              onRowClick={handleOrderClick}
              rowClassName={(order) =>
                newOrderIds.has(order.id)
                  ? 'animate-new-order-highlight bg-primary/5 border-l-4 border-l-primary'
                  : undefined
              }
              emptyState={{
                icon: Package,
                title: "No orders found",
                description: hasActiveFilters
                  ? "We couldn't find any orders matching your filters."
                  : "You haven't received any orders yet.",
                primaryAction: !hasActiveFilters ? {
                  label: "Create First Order",
                  onClick: () => navigate('wholesale-orders'),
                  icon: Plus
                } : {
                  label: "Clear Filters",
                  onClick: handleClearFilters
                }
              }}
              mobileRenderer={(order) => (
                <SwipeableItem
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
                    onClick: () => toast.success("Order archived")
                  }}
                >
                  <div className={`flex items-start justify-between ${newOrderIds.has(order.id) ? 'animate-new-order-highlight rounded-lg' : ''}`}>
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
                        {getSourceBadge(order.order_source)}
                      </div>
                      <p className="text-sm font-medium">
                        <CustomerLink
                          customerId={order.user_id}
                          customerName={order.user?.full_name || order.user?.email || order.user?.phone || ''}
                          customerEmail={order.user?.email}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatSmartDate(order.created_at)} • {order.delivery_method}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(order.status)}
                      <span className="font-bold font-mono">${order.total_amount?.toFixed(2)}</span>
                    </div>
                  </div>
                </SwipeableItem>
              )}
            />
          </Card>
        </div>
      </PullToRefresh>

      {/* Floating Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedOrders}
        onClearSelection={() => setSelectedOrders([])}
        actions={[
          {
            id: 'mark-confirmed',
            label: 'Confirmed',
            icon: <CheckCircle className="h-4 w-4" />,
            onClick: async () => { handleBulkStatusChange('confirmed'); },
          },
          {
            id: 'mark-delivered',
            label: 'Delivered',
            icon: <CheckCircle className="h-4 w-4" />,
            onClick: async () => { handleBulkStatusChange('delivered'); },
          },
          {
            id: 'mark-preparing',
            label: 'Preparing',
            icon: <Package className="h-4 w-4" />,
            onClick: async () => { handleBulkStatusChange('preparing'); },
          },
          {
            id: 'mark-in-transit',
            label: 'In Transit',
            icon: <Truck className="h-4 w-4" />,
            onClick: async () => { handleBulkStatusChange('in_transit'); },
          },
          {
            id: 'assign-runner',
            label: 'Assign Runner',
            icon: <UserPlus className="h-4 w-4" />,
            onClick: async () => { setAssignRunnerDialogOpen(true); },
          },
          {
            id: 'mark-cancelled',
            label: 'Cancel',
            icon: <XCircle className="h-4 w-4" />,
            variant: 'destructive',
            onClick: async () => { handleBulkStatusChange('cancelled'); },
          },
          {
            id: 'delete',
            label: 'Delete',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'destructive',
            onClick: async () => { handleBulkDelete(); },
          },
        ]}
      />

      {/* Bulk Status Update Confirmation */}
      <OrderBulkStatusConfirmDialog
        open={bulkStatusConfirm.open}
        onOpenChange={(open) => setBulkStatusConfirm(prev => ({ ...prev, open }))}
        onConfirm={handleConfirmBulkStatusUpdate}
        selectedCount={selectedOrders.length}
        targetStatus={bulkStatusConfirm.targetStatus}
        isLoading={bulkStatusUpdate.isRunning}
      />

      {/* Bulk Status Update Progress */}
      <BulkOperationProgress
        open={bulkStatusUpdate.showProgress}
        onOpenChange={(open) => { if (!open) bulkStatusUpdate.closeProgress(); }}
        title="Updating Order Status"
        description={`Changing status to "${bulkStatusConfirm.targetStatus}"`}
        total={bulkStatusUpdate.total}
        completed={bulkStatusUpdate.completed}
        succeeded={bulkStatusUpdate.succeeded}
        failed={bulkStatusUpdate.failed}
        failedItems={bulkStatusUpdate.failedItems}
        isRunning={bulkStatusUpdate.isRunning}
        isComplete={bulkStatusUpdate.isComplete}
        onCancel={bulkStatusUpdate.cancel}
      />

      <ConfirmDeleteDialog
        open={deleteConfirmation.open}
        onOpenChange={(open) => setDeleteConfirmation(prev => ({ ...prev, open }))}
        onConfirm={handleConfirmDelete}
        itemName={deleteConfirmation.type === 'bulk' ? `${selectedOrders.length} orders` : 'this order'}
        description="This action cannot be undone."
      />

      <ExportOptionsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExportWithOptions}
        fields={orderExportFields}
        title="Export Orders"
        description="Choose which related data to include in the CSV export."
        itemCount={filteredOrders.length}
      />

      <BulkAssignRunnerDialog
        open={assignRunnerDialogOpen}
        onOpenChange={setAssignRunnerDialogOpen}
        selectedOrders={filteredOrders.filter(o => selectedOrders.includes(o.id)).map(o => ({
          id: o.id,
          order_number: o.order_number,
        }))}
        onSuccess={() => {
          setSelectedOrders([]);
          refetch();
        }}
      />

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Order Details</DrawerTitle>
            <DrawerDescription>
              #{selectedOrder?.order_number || selectedOrder?.id.slice(0, 8)}
            </DrawerDescription>
          </DrawerHeader>
          {selectedOrder && (
            <div className="p-4 space-y-4 overflow-y-auto pb-safe">
              {/* Order Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Status</span>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Total</span>
                  <span className="font-mono font-bold">${selectedOrder.total_amount?.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Date</span>
                  <span className="text-sm">{selectedOrder.created_at ? format(new Date(selectedOrder.created_at), 'PPp') : 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Method</span>
                  <span className="text-sm capitalize">{selectedOrder.delivery_method || 'N/A'}</span>
                </div>
              </div>

              {/* Customer Info */}
              <div className="border-t pt-3">
                <h4 className="text-sm font-medium mb-2">Customer</h4>
                <p className="text-sm">
                  <CustomerLink
                    customerId={selectedOrder.user_id}
                    customerName={selectedOrder.user?.full_name || selectedOrder.user?.email || selectedOrder.user?.phone || ''}
                    customerEmail={selectedOrder.user?.email}
                  />
                </p>
                {selectedOrder.user?.phone && (
                  <p className="text-xs text-muted-foreground">{selectedOrder.user.phone}</p>
                )}
              </div>

              {/* Order Items Summary */}
              {selectedOrder.order_items && Array.isArray(selectedOrder.order_items) && selectedOrder.order_items.length > 0 && (
                <div className="border-t pt-3">
                  <h4 className="text-sm font-medium mb-2">Items ({selectedOrder.order_items.length})</h4>
                  <p className="text-xs text-muted-foreground">View full details to see all items</p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="border-t pt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintOrder(selectedOrder)}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateInvoice(selectedOrder)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Invoice
                  </Button>
                </div>
              </div>

              {/* Main Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button className="w-full" onClick={() => {
                  setIsDrawerOpen(false);
                  navigate(`orders/${selectedOrder.id}`);
                }}>
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
