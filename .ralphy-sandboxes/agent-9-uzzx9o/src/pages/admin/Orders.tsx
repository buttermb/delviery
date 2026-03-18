import { logger } from '@/lib/logger';
import { logOrderQuery, logRLSFailure } from '@/lib/debug/logger';
import { logSelectQuery } from '@/lib/debug/queryLogger';
import { useState, useMemo, useCallback } from 'react';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, ShoppingBag, TrendingUp, Clock, XCircle, Eye, Archive, Trash2, Plus, Printer, FileText, X, Store, Monitor, Utensils, Zap, Truck, CheckCircle, WifiOff, UserPlus, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, RefreshCw, Filter } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TakeTourButton } from '@/components/tutorial/TakeTourButton';
import { ordersTutorial } from '@/lib/tutorials/tutorialConfig';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { SwipeableItem } from '@/components/mobile/SwipeableItem';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from '@/components/ui/drawer';
import { triggerHaptic } from '@/lib/utils/mobile';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchInput } from '@/components/shared/SearchInput';
import { sanitizeSearchInput } from '@/lib/utils/searchSanitize';
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
import { usePermissions } from '@/hooks/usePermissions';
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";
import { ConfirmDialog } from "@/components/admin/shared/ConfirmDialog";
import { OrderExportButton, OrderMergeDialog, OrderSLAIndicator } from "@/components/admin/orders";
import { OrderEditModal } from "@/components/admin/OrderEditModal";
import { OrderHoverCard } from "@/components/admin/OrderHoverCard";
import { OrderRefundModal } from "@/components/admin/orders/OrderRefundModal";
import { OrderActionsDropdown } from "@/components/admin/orders/OrderActionsDropdown";
import type { OrderAction } from "@/components/admin/orders/OrderActionsDropdown";

import Merge from "lucide-react/dist/esm/icons/merge";
import { useAdminKeyboardShortcuts } from "@/hooks/useAdminKeyboardShortcuts";
import { useAdminOrdersRealtime } from "@/hooks/useAdminOrdersRealtime";
import { invalidateOnEvent } from "@/lib/invalidation";
import { usePagination } from "@/hooks/usePagination";
import { StandardPagination } from "@/components/shared/StandardPagination";
import { useDeliveryETA } from "@/hooks/useDeliveryETA";
import { useTenantFeatureToggles } from "@/hooks/useTenantFeatureToggles";
import { DeliveryETACell } from "@/components/admin/orders/DeliveryETACell";
import { formatSmartDate } from "@/lib/utils/formatDate";
import { formatCurrency, displayValue } from "@/lib/formatters";
import { TruncatedText } from "@/components/shared/TruncatedText";
import { DateRangePickerWithPresets } from "@/components/ui/date-picker-with-presets";
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import type { OrderWithSLATimestamps } from "@/types/sla";
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface OrderItem {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  price: number;
}

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
  accepted_at?: string | null;
  courier_assigned_at?: string | null;
  courier_accepted_at?: string | null;
  delivered_at?: string | null;
  user?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  order_items?: OrderItem[];
  [key: string]: unknown;
}

type OrderSortField = 'created_at' | 'total_amount' | 'status' | 'customer';
type SortOrder = 'asc' | 'desc';

interface OrderFilters {
  q: string;
  status: string;
  from: string;
  to: string;
  sort: string;
  dir: string;
  [key: string]: unknown;
}

const ORDERS_FILTER_CONFIG: Array<{ key: keyof OrderFilters; defaultValue: string }> = [
  { key: 'q', defaultValue: '' },
  { key: 'status', defaultValue: 'all' },
  { key: 'from', defaultValue: '' },
  { key: 'to', defaultValue: '' },
  { key: 'sort', defaultValue: 'created_at' },
  { key: 'dir', defaultValue: 'desc' },
];

export default function Orders() {
  const navigate = useTenantNavigate();
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const { canEdit, canDelete, canExport } = usePermissions();
  const { isEnabled: isFeatureEnabled } = useTenantFeatureToggles();
  const deliveryEnabled = isFeatureEnabled('delivery_tracking');

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

  // Real-time subscription for new orders (storefront + regular)
  const { newOrderIds } = useAdminOrdersRealtime({
    enabled: !!tenant?.id,
    onNewOrder: (event) => {
      const sourceLabel = event.source === 'storefront' ? 'Storefront' : event.source;
      toast.success(`New ${sourceLabel} order #${event.orderNumber}`, {
        description: `${event.customerName} - ${formatCurrency(event.totalAmount)}`,
      });
    },
  });

  // Filter state — persisted in URL for back-button & navigation support
  const [filters, setFilters, clearUrlFilters] = useUrlFilters<OrderFilters>(ORDERS_FILTER_CONFIG);
  const searchQuery = sanitizeSearchInput(filters.q);
  const statusFilter = filters.status;
  const dateRange = useMemo(() => ({
    from: filters.from ? parseISO(filters.from) : undefined,
    to: filters.to ? parseISO(filters.to) : undefined,
  }), [filters.from, filters.to]);
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
  const [assignRunnerDialogOpen, setAssignRunnerDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState<Order | null>(null);
  const sortField = (filters.sort || 'created_at') as OrderSortField;
  const sortOrder = (filters.dir || 'desc') as SortOrder;

  // Bulk status update hook with userId for activity logging
  const bulkStatusUpdate = useOrderBulkStatusUpdate({
    tenantId: tenant?.id,
    userId: admin?.id,
    onSuccess: () => {
      setSelectedOrders([]);
    },
  });

  // Data Fetching - includes both regular orders and POS orders from unified_orders
  const { data: orders = [], isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.orders.byTenant(tenant!.id),
    queryFn: async () => {
      if (!tenant) return [];

      logOrderQuery('Fetching admin orders', {
        tenantId: tenant.id,
        source: 'Orders'
      });

      // Fetch regular orders (all statuses — status filtering is client-side for combined filter support)
      const regularQuery = supabase
        .from('orders')
        .select('id, order_number, created_at, status, total_amount, user_id, courier_id, tenant_id, accepted_at, courier_assigned_at, courier_accepted_at, delivered_at, order_items(id, product_id, quantity, price)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: ordersData, error: ordersError } = await regularQuery;

      if (ordersError) {
        logRLSFailure('Orders query failed', {
          tenantId: tenant.id,
          error: ordersError.message,
          code: ordersError.code
        });
        throw ordersError;
      }

      logSelectQuery('orders', { tenant_id: tenant.id }, ordersData, 'Orders');

      // Fetch POS orders from unified_orders (all statuses — status filtering is client-side)
      const posQuery = supabase
        .from('unified_orders')
        .select('id, order_number, created_at, status, total_amount, payment_method, customer_id, shift_id, metadata')
        .eq('tenant_id', tenant.id)
        .eq('order_type', 'pos')
        .order('created_at', { ascending: false })
        .limit(50);

      const { data: posOrdersData, error: posError } = await posQuery;

      if (posError) {
        // Non-fatal - just log and continue with regular orders
        logger.warn('Failed to fetch POS orders from unified_orders', { error: posError.message });
      }

      // Transform POS orders to match Order interface
      const transformedPosOrders: Order[] = (posOrdersData ?? []).map(posOrder => ({
        id: posOrder.id,
        order_number: posOrder.order_number,
        created_at: posOrder.created_at,
        status: posOrder.status,
        total_amount: posOrder.total_amount ?? 0,
        delivery_method: 'pickup', // POS orders are typically pickup/in-store
        user_id: posOrder.customer_id ?? '',
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

        profilesMap = (profilesData ?? []).reduce((acc, profile: { user_id: string; full_name: string | null; first_name: string | null; last_name: string | null; phone: string | null }) => {
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

      // Merge regular orders with user info (including SLA timestamp fields)
      const regularOrdersWithUsers = (ordersData ?? []).map(order => ({
        ...order,
        delivery_method: (order as unknown as Record<string, unknown>).delivery_method as string ?? '',
        accepted_at: order.accepted_at || null,
        courier_assigned_at: order.courier_assigned_at || null,
        courier_accepted_at: order.courier_accepted_at || null,
        delivered_at: order.delivered_at || null,
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

  // Delivery ETA tracking for in-transit orders
  const inTransitOrderIds = useMemo(
    () => orders
      .filter((o) => ['in_transit', 'out_for_delivery'].includes(o.status))
      .map((o) => o.id),
    [orders]
  );
  const { etaMap } = useDeliveryETA(inTransitOrderIds);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id).eq('tenant_id', tenant?.id);
      if (error) throw error;
      return { id, status };
    },
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.byTenant(tenant!.id) });

      // Snapshot previous value for rollback
      const previousOrders = queryClient.getQueryData<Order[]>(queryKeys.orders.byTenant(tenant!.id));

      // Optimistically update the UI immediately
      queryClient.setQueryData(queryKeys.orders.byTenant(tenant!.id), (old: Order[] = []) =>
        old.map(o => o.id === id ? { ...o, status } : o)
      );

      return { previousOrders };
    },
    onSuccess: (data) => {
      toast.success(`Order status updated to ${data.status}`);
      // Cross-panel invalidation for dashboard, analytics, badges, fulfillment
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', tenant.id, { orderId: data.id });
      }
    },
    onError: (error, _variables, context) => {
      // Rollback to previous state on failure
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKeys.orders.byTenant(tenant!.id), context.previousOrders);
      }
      logger.error('Error updating status:', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error("Failed to update status", { description: humanizeError(error) });
    },
    onSettled: () => {
      // Always refetch to ensure server consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.byTenant(tenant!.id) });
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
      toast.success(`${count} ${count !== 1 ? 'orders' : 'order'} deleted successfully`);
      refetch();
      setSelectedOrders([]);
      triggerHaptic('heavy');
    },
    onError: (error) => {
      logger.error('Error deleting order(s)', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error("Failed to delete order(s)", { description: humanizeError(error) });
    }
  });

  // Filter Logic — all filters applied client-side so they compose as AND conditions
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }

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
  }, [orders, statusFilter, searchQuery, dateRange]);

  // Handlers
  const handleRefresh = async () => {
    await refetch();
    triggerHaptic('light');
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(paginatedItems.map(o => o.id));
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
    queryClient.setQueryData(queryKeys.orders.byTenant(tenant.id), (old: Order[] = []) =>
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
      // Cross-panel invalidation for dashboard, analytics, badges, fulfillment, inventory
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', tenant.id);
        invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id);
      }
      setSelectedOrders([]);
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(queryKeys.orders.byTenant(tenant.id), previousOrders);
      logger.error('Error updating orders in bulk', error instanceof Error ? error : new Error(String(error)), { component: 'Orders' });
      toast.error("Failed to update orders");
    }
    setBulkStatusConfirm({ open: true, targetStatus: status });
  };

  const handleConfirmBulkStatusUpdate = async () => {
    if (!tenant?.id) return;

    setBulkStatusConfirm({ open: false, targetStatus: '' });

    // Execute the bulk status update
    const ordersToUpdate = selectedOrders.map(id => {
      const order = orders?.find(o => o.id === id);
      return { id, status: bulkStatusConfirm.targetStatus, order_number: order?.order_number ?? '' };
    });
    await bulkStatusUpdate.executeBulkUpdate(ordersToUpdate, bulkStatusConfirm.targetStatus);
  };

  const handleClearFilters = useCallback(() => {
    clearUrlFilters();
  }, [clearUrlFilters]);

  const handleSearchChange = useCallback((v: string) => setFilters({ q: v }), [setFilters]);
  const handleStatusFilterChange = useCallback((v: string) => setFilters({ status: v }), [setFilters]);
  const handleDateRangeChange = useCallback((range: { from: Date | undefined; to: Date | undefined }) => {
    setFilters({
      from: range.from ? format(range.from, 'yyyy-MM-dd') : '',
      to: range.to ? format(range.to, 'yyyy-MM-dd') : '',
    });
  }, [setFilters]);

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || dateRange.from || dateRange.to;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (statusFilter !== 'all') count++;
    if (dateRange.from || dateRange.to) count++;
    return count;
  }, [searchQuery, statusFilter, dateRange.from, dateRange.to]);

  const handleSort = (field: OrderSortField) => {
    if (sortField === field) {
      setFilters({ dir: sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      setFilters({ sort: field, dir: field === 'created_at' ? 'desc' : 'asc' });
    }
  };

  const SortableHeader = ({ field, label }: { field: OrderSortField; label: string }) => {
    const isActive = sortField === field;
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 hover:bg-transparent"
        onClick={() => handleSort(field)}
      >
        <span>{label}</span>
        {isActive ? (
          sortOrder === 'asc' ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    );
  };

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'total_amount':
          cmp = (a.total_amount ?? 0) - (b.total_amount ?? 0);
          break;
        case 'status':
          cmp = (a.status ?? '').localeCompare(b.status ?? '');
          break;
        case 'customer': {
          const nameA = a.user?.full_name ?? a.user?.email ?? '';
          const nameB = b.user?.full_name ?? b.user?.email ?? '';
          cmp = nameA.localeCompare(nameB);
          break;
        }
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredOrders, sortField, sortOrder]);

  // Pagination
  const {
    paginatedItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    goToPage,
    changePageSize,
    pageSizeOptions,
  } = usePagination(sortedOrders, {
    defaultPageSize: 25,
    persistInUrl: false,
  });

  const handleOrderAction = useCallback((action: OrderAction, orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    switch (action) {
      case 'edit':
        setEditOrder(order);
        setEditModalOpen(true);
        break;
      case 'cancel':
        setCancelConfirmOrder(order);
        break;
      case 'refund':
        setRefundOrder(order);
        setRefundModalOpen(true);
        break;
      case 'duplicate':
        navigate(`orders/${order.id}?action=duplicate`);
        break;
    }
  }, [orders, navigate]);

  const stats = useMemo(() => [
    { label: 'Total Orders', value: orders.length, icon: Package, color: 'text-blue-500' },
    { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, icon: Clock, color: 'text-yellow-500' },
    { label: 'In Progress', value: orders.filter(o => ['confirmed', 'preparing', 'in_transit'].includes(o.status)).length, icon: TrendingUp, color: 'text-green-500' },
    { label: 'Cancelled', value: orders.filter(o => o.status === 'cancelled').length, icon: XCircle, color: 'text-red-500' },
  ], [orders]);

  // Loading skeleton — full page placeholder while data fetches
  if (isLoading) {
    return (
      <div className="w-full max-w-full px-2 sm:px-4 md:px-4 py-2 sm:py-4 md:py-4 space-y-4 sm:space-y-4">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-12 w-24 rounded-md" />
            <Skeleton className="h-12 w-32 rounded-md" />
            <Skeleton className="h-12 w-28 rounded-md" />
          </div>
        </div>

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-3 sm:p-4 border-none shadow-sm">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-12" />
                </div>
                <Skeleton className="h-6 w-6 sm:h-8 sm:w-8 rounded" />
              </div>
            </Card>
          ))}
        </div>

        {/* Controls skeleton */}
        <Card className="p-3 sm:p-4 border-none shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-full sm:w-[180px]" />
            <Skeleton className="h-10 w-full sm:w-[220px]" />
          </div>

          {/* Table skeleton */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {["", "Order #", "Customer", "Status", "Total", "Source", "Date", ""].map((h, i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-3 w-16" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, rowIdx) => (
                  <TableRow key={rowIdx}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    );
  }

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

  const handlePrintOrder = (order: Order) => {
    // Open print dialog with order details
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
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
            <div class="info"><span class="label">Total:</span> ${formatCurrency(order.total_amount)}</div>
            <div class="info"><span class="label">Date:</span> ${order.created_at ? formatSmartDate(order.created_at, { includeTime: true }) : 'N/A'}</div>
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
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'ORDER_STATUS_CHANGED', tenant.id, { orderId: order.id });
      }
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
          checked={paginatedItems.length > 0 && selectedOrders.length === paginatedItems.length}
          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
        />
      ) as unknown as string, // Cast to string to satisfy older interfaces if strict type checking fails intermittently, though we updated it.
      className: "w-[50px]",
      cell: (order) => (
        <div role="presentation" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedOrders.includes(order.id)}
            onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
          />
        </div>
      )
    },
    {
      header: "Order #",
      className: "max-w-[150px]",
      cell: (order) => (
        <div className="flex items-center gap-2 max-w-[150px] min-w-0">
          <OrderHoverCard
            order={{
              id: order.id,
              order_number: order.order_number,
              status: order.status,
              total_amount: order.total_amount,
              created_at: order.created_at,
              customer_name: order.user?.full_name || undefined,
              customer_email: order.user?.email || undefined,
              items: order.order_items?.map(item => ({
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.price,
              })),
            }}
          >
            <TruncatedText
              text={order.order_number || order.id.slice(0, 8)}
              maxWidthClass="max-w-[110px]"
              className={newOrderIds.has(order.id) ? 'font-bold text-primary' : ''}
            />
          </OrderHoverCard>
          <CopyButton text={order.order_number || order.id} label="Order Number" showLabel={false} className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )
    },
    {
      header: "Source",
      cell: (order) => getSourceBadge(order.order_source),
      className: "w-[120px] hidden lg:table-cell"
    },
    {
      header: <SortableHeader field="customer" label="Customer" />,
      className: "max-w-[200px]",
      cell: (order) => (
        <div className="flex flex-col gap-1 max-w-[200px] min-w-0">
          <div className="min-w-0 truncate">
            <CustomerLink
              customerId={order.user_id}
              customerName={order.user?.full_name || order.user?.email || order.user?.phone || 'Unknown'}
              customerEmail={order.user?.email}
              className="font-medium"
            />
          </div>
          {order.user?.email && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
              <TruncatedText text={order.user.email} maxWidthClass="max-w-[170px]" />
              <CopyButton text={order.user.email} label="Email" showLabel={false} className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          {!order.user?.email && order.user?.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
              <TruncatedText text={order.user.phone} maxWidthClass="max-w-[170px]" />
              <CopyButton text={order.user.phone} label="Phone" showLabel={false} className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
        </div>
      )
    },
    {
      header: <SortableHeader field="status" label="Status" />,
      cell: (order) => {
        // Convert to SLA-compatible format
        const slaOrder: OrderWithSLATimestamps = {
          id: order.id,
          status: order.status as OrderWithSLATimestamps['status'],
          created_at: order.created_at,
          accepted_at: order.accepted_at,
          courier_assigned_at: order.courier_assigned_at,
          courier_accepted_at: order.courier_accepted_at,
          delivered_at: order.delivered_at,
          status_changed_at: order.accepted_at || null,
        };

        return (
          <div role="presentation" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
            {canEdit('orders') ? (
              <Select value={order.status} onValueChange={(value) => handleStatusChange(order.id, value)}>
                <SelectTrigger className="h-8 w-[130px] border-none bg-transparent hover:bg-muted/50 focus-visible:ring-0 p-0">
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
            ) : (
              getStatusBadge(order.status)
            )}
            <OrderSLAIndicator order={slaOrder} compact />
          </div>
        );
      }
    },
    {
      header: "Method",
      className: "max-w-[120px] hidden lg:table-cell",
      cell: (order) => (
        <TruncatedText
          text={order.delivery_method || '—'}
          maxWidthClass="max-w-[120px]"
          className="capitalize"
        />
      )
    },
    {
      header: "ETA",
      className: "w-[130px] hidden lg:table-cell",
      cell: (order) => (
        <DeliveryETACell
          eta={etaMap[order.id]}
          orderStatus={order.status}
        />
      ),
    },
    {
      header: <SortableHeader field="total_amount" label="Total" />,
      cell: (order) => <span className="font-mono font-medium">{formatCurrency(order.total_amount)}</span>
    },
    {
      header: <SortableHeader field="created_at" label="Date" />,
      cell: (order) => <span className="text-muted-foreground">{formatSmartDate(order.created_at)}</span>
    },
    {
      header: "Actions",
      cell: (order) => (
        <div className="flex items-center gap-1" role="presentation" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => navigate(`orders/${order.id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <OrderActionsDropdown
            orderId={order.id}
            orderStatus={order.status}
            onAction={handleOrderAction}
            disabledActions={[
              ...(!canEdit('orders') ? ['edit' as OrderAction, 'cancel' as OrderAction, 'refund' as OrderAction] : []),
            ]}
            size="sm"
            triggerClassName="opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      )
    }
  ];

  return (
    <>
      <SEOHead
        title="Orders Management | Admin"
        description="Manage customer orders and deliveries"
      />

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="w-full max-w-full px-2 sm:px-4 md:px-4 py-2 sm:py-4 md:py-4 space-y-4 sm:space-y-4 overflow-x-hidden pb-24">

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl font-bold">Orders Management</h1>
              <LastUpdated date={new Date()} onRefresh={handleRefresh} isLoading={isLoading} className="mt-1" />
            </div>
            <div className="flex flex-wrap gap-2">
              {canExport('orders') && (
                <OrderExportButton
                  orders={sortedOrders}
                  filenamePrefix="orders-export"
                  variant="outline"
                  className="min-h-[44px] sm:min-h-[48px] touch-manipulation text-xs sm:text-sm"
                  disabled={sortedOrders.length === 0}
                />
              )}
              {canEdit('orders') && (
                <Button
                  variant="outline"
                  className="min-h-[44px] sm:min-h-[48px] touch-manipulation text-xs sm:text-sm"
                  onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/orders/offline-create`)}
                >
                  <WifiOff className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Offline Order</span>
                </Button>
              )}
              {canEdit('orders') && (
                <Button
                  variant="default"
                  className="min-h-[44px] sm:min-h-[48px] touch-manipulation shadow-lg shadow-primary/20 text-xs sm:text-sm"
                  onClick={() => tenant?.slug && navigate(`/${tenant.slug}/admin/wholesale-orders/new`)}
                >
                  <Plus className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">New Order</span>
                </Button>
              )}
              <TakeTourButton
                tutorialId={ordersTutorial.id}
                steps={ordersTutorial.steps}
                variant="outline"
                size="sm"
                className="min-h-[44px] sm:min-h-[48px]"
              />
            </div>
          </div>

          {/* Stats Grid — hidden when error with no cached data (zeros are misleading) */}
          {!(isError && orders.length === 0) && (
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
          )}

          {/* Controls */}
          <Card className="p-3 sm:p-4 border-none shadow-sm">
            <div className="flex flex-col gap-3 sm:gap-4 mb-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {activeFilterCount > 0 && (
                  <div className="flex items-center gap-1.5 self-center">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs font-medium">
                      {activeFilterCount}
                    </Badge>
                  </div>
                )}
                <div className="relative flex-1">
                  <SearchInput
                    defaultValue={searchQuery}
                    onSearch={handleSearchChange}
                    placeholder="Search orders, customers, total..."
                  />
                </div>
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
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
                  onDateRangeChange={handleDateRangeChange}
                  placeholder="Filter by date"
                  className="w-full sm:w-[220px] bg-muted/30 border-transparent"
                />
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-10 px-2 sm:px-3 text-muted-foreground hover:text-destructive hover:border-destructive/50 text-xs sm:text-sm whitespace-nowrap"
                  >
                    <X className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Clear all filters</span>
                    <span className="sm:hidden">Clear</span>
                  </Button>
                )}
              </div>

              {/* Active filter badges */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:inline">Active filters:</span>
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                      Search: &quot;{searchQuery}&quot;
                      <button
                        onClick={() => handleSearchChange('')}
                        className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                        aria-label="Remove search filter"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {statusFilter !== 'all' && (
                    <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                      Status: {statusFilter.replace('_', ' ')}
                      <button
                        onClick={() => handleStatusFilterChange('all')}
                        className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                        aria-label="Remove status filter"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {(dateRange.from || dateRange.to) && (
                    <Badge variant="secondary" className="gap-1 pr-1 text-xs">
                      Date: {dateRange.from ? format(dateRange.from, 'MMM d') : '...'} – {dateRange.to ? format(dateRange.to, 'MMM d') : '...'}
                      <button
                        onClick={() => handleDateRangeChange({ from: undefined, to: undefined })}
                        className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                        aria-label="Remove date filter"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Bulk Actions - handled by floating BulkActionsBar below */}

            {/* Error State — no cached data */}
            {isError && orders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <p className="font-semibold text-destructive">Failed to load orders</p>
                <p className="text-muted-foreground text-sm mt-1 mb-4">
                  Something went wrong while fetching your orders. Please try again.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                  {isFetching ? 'Retrying...' : 'Try Again'}
                </Button>
              </div>
            )}

            {/* Error banner — cached data still available */}
            {isError && orders.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 rounded-lg border border-destructive bg-destructive/5 px-3 sm:px-4 py-2.5 sm:py-3 mb-4">
                <p className="text-destructive text-xs sm:text-sm">
                  Failed to refresh orders. Showing cached data.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                  Retry
                </Button>
              </div>
            )}

            {/* Responsive Table - hidden when error with no data to avoid showing misleading empty state */}
            {!(isError && orders.length === 0) && <ResponsiveTable<Order>
              data={paginatedItems}
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
                icon: ShoppingBag,
                title: searchQuery
                  ? `No orders match your search`
                  : hasActiveFilters
                    ? "No orders found"
                    : "No orders yet",
                description: searchQuery
                  ? `No results for "${searchQuery}". Try a different search term or clear your search.`
                  : hasActiveFilters
                    ? "Try adjusting your filters to find orders"
                    : "Orders appear here when customers purchase from your menus or storefront",
                primaryAction: hasActiveFilters ? {
                  label: "Clear Filters",
                  onClick: handleClearFilters
                } : {
                  label: "Create First Order",
                  onClick: () => navigate('wholesale-orders'),
                  icon: Plus
                },
                secondaryAction: !hasActiveFilters ? {
                  label: "Create a Menu",
                  onClick: () => navigate('disposable-menus')
                } : undefined,
                designSystem: "tenant-admin"
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
                  <div className={`flex items-start justify-between gap-2 p-1 ${newOrderIds.has(order.id) ? 'animate-new-order-highlight rounded-lg' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                          onClick={(e) => e.stopPropagation()}
                          className="mr-1 sm:mr-2 h-5 w-5 touch-manipulation"
                        />
                        <span className="font-mono font-bold text-primary text-sm">
                          #{order.order_number || order.id.slice(0, 8)}
                        </span>
                        {getSourceBadge(order.order_source)}
                      </div>
                      <p className="text-sm font-medium truncate min-w-0 pl-7" title={order.user?.full_name || order.user?.email || order.user?.phone || 'Unknown'}>
                        <CustomerLink
                          customerId={order.user_id}
                          customerName={order.user?.full_name || order.user?.email || order.user?.phone || 'Unknown'}
                          customerEmail={order.user?.email}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate pl-7">
                        {formatSmartDate(order.created_at)} • {displayValue(order.delivery_method, 'N/A')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {getStatusBadge(order.status)}
                      <span className="font-bold font-mono text-sm">{formatCurrency(order.total_amount)}</span>
                    </div>
                  </div>
                </SwipeableItem>
              )}
            />}

            {/* Search results count */}
            {!(isError && orders.length === 0) && sortedOrders.length > 0 && hasActiveFilters && (
              <div className="text-xs sm:text-sm text-muted-foreground px-1 sm:px-2 pt-2">
                Showing {filteredOrders.length} of {orders.length} orders
              </div>
            )}

            {/* Pagination */}
            {!(isError && orders.length === 0) && sortedOrders.length > 0 && (
              <StandardPagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                pageSizeOptions={pageSizeOptions}
                onPageChange={goToPage}
                onPageSizeChange={changePageSize}
              />
            )}
          </Card>
        </div>
      </PullToRefresh>

      {/* Floating Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedOrders}
        onClearSelection={() => setSelectedOrders([])}
        actions={[
          ...(canEdit('orders') ? [
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
              disabled: !deliveryEnabled,
              tooltip: !deliveryEnabled ? 'Enable Delivery Tracking in Settings' : undefined,
              onClick: async () => { setAssignRunnerDialogOpen(true); },
            },
            {
              id: 'merge-orders',
              label: 'Merge',
              icon: <Merge className="h-4 w-4" />,
              onClick: async () => { setMergeDialogOpen(true); },
            },
            {
              id: 'mark-cancelled',
              label: 'Cancel',
              icon: <XCircle className="h-4 w-4" />,
              variant: 'destructive' as const,
              onClick: async () => { handleBulkStatusChange('cancelled'); },
            },
          ] : []),
          ...(canDelete('orders') ? [
            {
              id: 'delete',
              label: 'Delete',
              icon: <Trash2 className="h-4 w-4" />,
              variant: 'destructive' as const,
              onClick: async () => { handleBulkDelete(); },
            },
          ] : []),
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
        itemName={deleteConfirmation.type === 'bulk' ? `${selectedOrders.length} ${selectedOrders.length === 1 ? 'order' : 'orders'}` : 'this order'}
        description="This action cannot be undone."
      />

      <ConfirmDialog
        isOpen={!!cancelConfirmOrder}
        onConfirm={() => {
          if (cancelConfirmOrder) {
            handleCancelOrder(cancelConfirmOrder);
          }
          setCancelConfirmOrder(null);
        }}
        onCancel={() => setCancelConfirmOrder(null)}
        title="Cancel Order"
        description={`Are you sure you want to cancel order #${cancelConfirmOrder?.order_number ?? cancelConfirmOrder?.id.slice(0, 8) ?? ''}? This action cannot be undone.`}
        confirmLabel="Cancel Order"
        variant="destructive"
      />

      <BulkAssignRunnerDialog
        open={assignRunnerDialogOpen}
        onOpenChange={setAssignRunnerDialogOpen}
        selectedOrders={sortedOrders.filter(o => selectedOrders.includes(o.id)).map(o => ({
          id: o.id,
          order_number: o.order_number,
        }))}
        onSuccess={() => {
          setSelectedOrders([]);
          refetch();
        }}
      />

      <OrderMergeDialog
        selectedOrders={sortedOrders.filter(o => selectedOrders.includes(o.id))}
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        onSuccess={() => {
          setSelectedOrders([]);
          refetch();
        }}
      />

      <OrderEditModal
        order={editOrder}
        open={editModalOpen}
        onOpenChange={(open) => {
          setEditModalOpen(open);
          if (!open) setEditOrder(null);
        }}
        onSuccess={() => {
          setEditModalOpen(false);
          setEditOrder(null);
          refetch();
        }}
        orderTable="orders"
      />

      <OrderRefundModal
        open={refundModalOpen}
        onOpenChange={(open) => {
          setRefundModalOpen(open);
          if (!open) setRefundOrder(null);
        }}
        order={refundOrder ? {
          id: refundOrder.id,
          tenant_id: tenant?.id ?? '',
          order_number: refundOrder.order_number,
          order_type: refundOrder.order_source === 'pos' ? 'pos' : 'wholesale',
          source: refundOrder.order_source || 'admin',
          status: refundOrder.status as 'delivered' | 'completed',
          subtotal: refundOrder.total_amount,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: refundOrder.total_amount,
          payment_method: null,
          payment_status: 'paid',
          customer_id: refundOrder.user_id || null,
          wholesale_client_id: null,
          menu_id: null,
          shift_id: null,
          delivery_address: null,
          delivery_notes: null,
          courier_id: refundOrder.courier_id || null,
          contact_name: null,
          contact_phone: null,
          metadata: {},
          created_at: refundOrder.created_at,
          updated_at: refundOrder.created_at,
          cancelled_at: null,
          cancellation_reason: null,
          priority: 'normal',
          priority_set_at: null,
          priority_set_by: null,
          priority_auto_set: false,
          items: (refundOrder.order_items ?? []).map(item => ({
            id: item.id,
            order_id: refundOrder.id,
            product_id: item.product_id,
            inventory_id: null,
            product_name: item.product_name || 'Unknown Product',
            sku: null,
            quantity: item.quantity,
            quantity_unit: 'unit',
            unit_price: item.price,
            discount_amount: 0,
            total_price: item.quantity * item.price,
            metadata: {},
          })),
        } : null}
        onSuccess={() => {
          setRefundModalOpen(false);
          setRefundOrder(null);
          refetch();
          toast.success('Refund processed successfully');
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
                  <span className="font-mono font-bold">{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Date</span>
                  <span className="text-sm">{formatSmartDate(selectedOrder.created_at, { includeTime: true })}</span>
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
                    customerName={selectedOrder.user?.full_name ?? selectedOrder.user?.email ?? selectedOrder.user?.phone ?? ''}
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
                    className="min-h-[44px] touch-manipulation"
                    onClick={() => handlePrintOrder(selectedOrder)}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] touch-manipulation"
                    onClick={() => handleGenerateInvoice(selectedOrder)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Invoice
                  </Button>
                </div>
              </div>

              {/* Main Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button className="w-full min-h-[48px] touch-manipulation" onClick={() => {
                  setIsDrawerOpen(false);
                  navigate(`orders/${selectedOrder.id}`);
                }}>
                  Full Details
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full min-h-[48px] touch-manipulation">Close</Button>
                </DrawerClose>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
