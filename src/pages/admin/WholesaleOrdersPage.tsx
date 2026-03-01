import { logger } from '@/lib/logger';
import { sanitizeSearchInput } from '@/lib/utils/searchSanitize';
import { quickExportCSV } from '@/lib/utils/exportUtils';
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { CustomerLink } from '@/components/admin/cross-links';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  Plus,
  Download,
  AlertCircle,
  RefreshCw,
  DollarSign,
  FileText,
  Warehouse,
  Filter,
  X
} from 'lucide-react';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useAdminKeyboardShortcuts } from '@/hooks/useAdminKeyboardShortcuts';
import { useExport } from '@/hooks/useExport';
import { BulkActions } from '@/components/shared/BulkActions';
import { LastUpdated } from '@/components/shared/LastUpdated';
import CopyButton from '@/components/CopyButton';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { EditWholesaleOrderDialog } from '@/components/wholesale/EditWholesaleOrderDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveTable, ResponsiveColumn } from '@/components/shared/ResponsiveTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { wholesaleOrderFlowManager, WholesaleOrderStatus } from '@/lib/orders/wholesaleOrderFlowManager';
import { canChangeStatus, getEditRestrictionMessage } from '@/lib/utils/orderEditability';
import { queryKeys } from '@/lib/queryKeys';

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
    id: string;
    business_name: string;
    contact_name: string;
    phone?: string;
    license_number?: string;
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

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  total: number;
  status: string;
  expected_delivery_date?: string;
  created_at: string;
  vendor?: {
    name: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
  };
  items?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_cost: number;
  }>;
}

type OrderType = WholesaleOrder | PurchaseOrder;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  ordered: { label: 'Ordered', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: CheckCircle2 },
  received: { label: 'Received', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: Package },
  draft: { label: 'Draft', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20', icon: FileText },
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

interface WholesaleOrderFilters {
  q: string;
  status: string;
  view: string;
}

const WHOLESALE_FILTER_CONFIG: Array<{ key: keyof WholesaleOrderFilters; defaultValue: string }> = [
  { key: 'q', defaultValue: '' },
  { key: 'status', defaultValue: 'all' },
  { key: 'view', defaultValue: 'selling' },
];

function WholesaleOrdersPageSkeleton() {
  return (
    <div className="w-full max-w-full space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-48 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className={`p-4 ${i === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-14" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters & Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
          <Skeleton className="h-10 w-full sm:w-80" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-20" />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {/* Mobile skeletons */}
        <div className="md:hidden divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        {/* Desktop table skeletons */}
        <div className="hidden md:block">
          <div className="grid grid-cols-8 gap-4 p-3 border-b bg-muted/50">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-12 ml-auto" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-16" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-8 gap-4 p-3 border-b last:border-b-0 items-center">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function WholesaleOrdersPage() {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const { exportCSV } = useExport();

  // Filter state — persisted in URL for back-button & navigation support
  const [filters, setFilters, clearUrlFilters] = useUrlFilters<WholesaleOrderFilters>(WHOLESALE_FILTER_CONFIG);
  const searchQuery = sanitizeSearchInput(filters.q);
  const statusFilter = filters.status;
  const viewMode = (filters.view || 'selling') as 'selling' | 'buying';

  const handleSearchChange = useCallback((v: string) => setFilters({ q: v }), [setFilters]);
  const handleStatusFilterChange = useCallback((v: string) => setFilters({ status: v }), [setFilters]);
  const handleViewModeChange = useCallback((v: 'selling' | 'buying') => setFilters({ view: v }), [setFilters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (statusFilter !== 'all') count++;
    return count;
  }, [searchQuery, statusFilter]);

  const hasActiveFilters = activeFilterCount > 0;

  const handleClearFilters = useCallback(() => {
    clearUrlFilters();
  }, [clearUrlFilters]);

  // UI state
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderType | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Keyboard shortcuts
  useAdminKeyboardShortcuts({
    onSearch: () => {
      // Search input auto-focuses via ref in SearchInput component but we don't have direct ref here
      const searchInput = document.querySelector('input[type="text"]');
      if (searchInput instanceof HTMLElement) searchInput.focus();
    },
    onCreate: () => tenant?.slug && navigate(`/${tenant.slug}/admin/wholesale-orders/new`),
  });

  // Fetch orders (Wholesale or Purchase based on viewMode)
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.orders.list(tenant?.id, { viewMode }),
    queryFn: async () => {
      if (!tenant?.id) return [];

      if (viewMode === 'selling') {
        const query = supabase
          .from('wholesale_orders')
          .select(`
            *,
            client:wholesale_clients(id, business_name, contact_name, phone),
            items:wholesale_order_items(id, product_name, quantity_lbs, unit_price)
          `)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        const { data: ordersData, error: ordersError } = await query;

        if (ordersError) {
          logger.error('Failed to fetch wholesale orders', ordersError, { component: 'WholesaleOrdersPage' });
          throw ordersError;
        }

        const courierIds = [...new Set((ordersData ?? []).map(o => o.runner_id).filter(Boolean))];
        let couriersMap: Record<string, { id: string; full_name: string; phone: string | null; vehicle_type: string | null }> = {};

        if (courierIds.length > 0) {
          const { data: couriersData } = await supabase
            .from('couriers')
            .select('id, full_name, phone, vehicle_type')
            .in('id', courierIds);

          if (couriersData) {
            couriersMap = Object.fromEntries(couriersData.map((c) => [c.id, c]));
          }
        }

        return (ordersData ?? []).map(order => ({
          ...order,
          courier: order.runner_id ? couriersMap[order.runner_id] : undefined,
          type: 'selling'
        })) as unknown as WholesaleOrder[];
      } else {
        // Buying Mode (all statuses — status filtering is client-side)
        const query = supabase
          .from('purchase_orders')
          .select(`
            *,
            vendor:vendors(name, contact_name, contact_email, contact_phone),
            items:purchase_order_items(id, product_name, quantity, unit_cost)
          `)
          .eq('account_id', tenant.id)
          .order('created_at', { ascending: false });

        const { data: poData, error: poError } = await query;

        if (poError) {
          logger.error('Failed to fetch purchase orders', poError);
          throw poError;
        }

        return (poData ?? []).map(po => ({
          ...po,
          type: 'buying'
        })) as unknown as PurchaseOrder[];
      }
    },
    enabled: !!tenant?.id,
  });

  const filteredOrders = useMemo((): OrderType[] => {
    let result: OrderType[] = orders;

    // Status filter (client-side for consistent combined filtering)
    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = (searchQuery as string).toLowerCase();
      result = result.filter((order) => {
        if (viewMode === 'selling') {
          const o = order as WholesaleOrder;
          return (
            o.order_number?.toLowerCase().includes(query) ||
            o.client?.business_name?.toLowerCase().includes(query) ||
            o.client?.contact_name?.toLowerCase().includes(query) ||
            o.courier?.full_name?.toLowerCase().includes(query)
          );
        } else {
          const p = order as PurchaseOrder;
          return (
            p.po_number?.toLowerCase().includes(query) ||
            p.vendor?.name?.toLowerCase().includes(query) ||
            p.vendor?.contact_name?.toLowerCase().includes(query)
          );
        }
      });
    }

    return result;
  }, [orders, statusFilter, searchQuery, viewMode]);

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

  const handleStatusUpdate = async (orderId: string, newStatus: string, retryCount = 0) => {
    const MAX_RETRIES = 2;
    if (!tenant?.id) {
      toast.error("Tenant context required");
      return;
    }

    try {
      if (viewMode === 'selling') {
        // Use flow manager for wholesale orders (includes editability checks)
        const result = await wholesaleOrderFlowManager.transitionOrderStatus(
          orderId,
          newStatus as WholesaleOrderStatus,
          { tenantId: tenant.id }
        );
        if (!result.success) {
          toast.error('Cannot update status', { description: result.error });
          return;
        }
      } else {
        // Direct update for purchase orders - include tenant isolation
        const { error } = await supabase
          .from('purchase_orders')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('account_id', tenant.id)
          .eq('id', orderId);
        if (error) throw error;
      }

      toast.success(`Order status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.list(tenant?.id, { viewMode }) });
      handleRefresh();
    } catch (error) {
      const isNetworkError = error instanceof Error &&
        (error.message.toLowerCase().includes('network') ||
          error.message.toLowerCase().includes('fetch') ||
          error.message.toLowerCase().includes('timeout'));

      if (isNetworkError && retryCount < MAX_RETRIES) {
        toast.info('Connection issue, retrying...');
        setTimeout(() => handleStatusUpdate(orderId, newStatus, retryCount + 1), 1000);
        return;
      }

      logger.error('Failed to update order status', error, { component: 'WholesaleOrdersPage', orderId, newStatus, retryCount });
      toast.error('Failed to update status', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (!tenant?.id) {
      toast.error("Tenant context required");
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      if (viewMode === 'selling') {
        // Use flow manager for wholesale orders to handle inventory properly
        for (const orderId of selectedOrders) {
          const result = await wholesaleOrderFlowManager.transitionOrderStatus(
            orderId,
            status as WholesaleOrderStatus,
            { tenantId: tenant.id }
          );
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            logger.warn(`Failed to update order ${orderId}: ${result.error}`);
          }
        }
      } else {
        // Direct update for purchase orders - include tenant isolation
        const { error } = await supabase
          .from('purchase_orders')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('account_id', tenant.id)
          .in('id', selectedOrders);

        if (error) throw error;
        successCount = selectedOrders.length;
      }

      if (failCount > 0) {
        toast.warning(`Updated ${successCount} orders, ${failCount} failed`);
      } else {
        toast.success(`Updated ${successCount} orders to ${STATUS_CONFIG[status]?.label || status}`);
      }
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.list(tenant?.id, { viewMode }) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleInventory.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
      handleRefresh();
      setSelectedOrders([]);
    } catch (error) {
      logger.error('Failed to bulk update orders', error, { component: 'WholesaleOrdersPage' });
      toast.error('Failed to update orders', { description: humanizeError(error) });
    }
  };

  const handleExport = () => {
    const dataToExport = selectedOrders.length > 0
      ? filteredOrders.filter((o) => selectedOrders.includes(o.id))
      : filteredOrders;

    quickExportCSV(dataToExport.map((order) => {
      if (viewMode === 'selling') {
        const wo = order as WholesaleOrder;
        return {
          'Order #': wo.order_number,
          'Client': wo.client?.business_name || 'N/A',
          'Contact': wo.client?.contact_name || 'N/A',
          'Total': formatCurrency(wo.total_amount),
          'Status': STATUS_CONFIG[wo.status]?.label || wo.status,
          'Payment Status': PAYMENT_STATUS_CONFIG[wo.payment_status]?.label || wo.payment_status,
          'Courier': wo.courier?.full_name || 'Unassigned',
          'Created': formatSmartDate(wo.created_at),
        };
      } else {
        const po = order as PurchaseOrder;
        return {
          'PO #': po.po_number,
          'Vendor': po.vendor?.name || 'N/A',
          'Contact': po.vendor?.contact_name || 'N/A',
          'Total': formatCurrency(po.total),
          'Status': STATUS_CONFIG[po.status]?.label || po.status,
          'Expected Delivery': po.expected_delivery_date ? formatSmartDate(po.expected_delivery_date) : 'Pending',
          'Created': formatSmartDate(po.created_at),
        };
      }
    }) as Record<string, string>[], `wholesale-orders-${viewMode}.csv`);
    // Note: filename parameter would need to be handled at the exportCSV call site
  };

  // Columns Configuration
  const columns = useMemo<ResponsiveColumn<OrderType>[]>(() => {
    if (viewMode === 'selling') {
      return [
        {
          header: (
            <Checkbox
              checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
              onCheckedChange={handleSelectAll}
            />
          ),
          cell: (item) => (
            <div role="presentation" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedOrders.includes(item.id)}
                onCheckedChange={(checked) => handleSelectOrder(item.id, checked as boolean)}
              />
            </div>
          ),
          className: "w-[40px]"
        },
        {
          header: "Order #",
          cell: (item) => {
            const order = item as WholesaleOrder;
            return (
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">{order.order_number}</span>
                <CopyButton text={order.order_number} size="sm" />
              </div>
            );
          }
        },
        {
          header: "Client",
          cell: (item) => {
            const order = item as WholesaleOrder;
            return (
              <div>
                <p className="font-medium">
                  <CustomerLink
                    customerId={order.client_id}
                    customerName={order.client?.business_name || 'Unknown Client'}
                  />
                </p>
                <p className="text-xs text-muted-foreground">{order.client?.contact_name}</p>
              </div>
            );
          }
        },
        {
          header: "Total",
          cell: (item) => formatCurrency((item as WholesaleOrder).total_amount),
          className: "text-right"
        },
        {
          header: "Status",
          cell: (item) => {
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const restrictionMessage = getEditRestrictionMessage(item.status);
            
            // Filter to only show valid status transitions
            const validStatuses = Object.entries(STATUS_CONFIG).filter(([key]) => 
              canChangeStatus(item.status, key) || key === item.status
            );
            
            return (
              <div role="presentation" onClick={(e) => e.stopPropagation()}>
                <Select
                  value={item.status}
                  onValueChange={(value) => handleStatusUpdate(item.id, value)}
                  disabled={validStatuses.length <= 1}
                >
                  <SelectTrigger className="w-32 h-8" title={restrictionMessage || undefined}>
                    <Badge variant="outline" className={`${statusConfig.color} gap-1`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-md z-50">
                    {validStatuses.map(([key, config]) => (
                      <SelectItem key={key} value={key} disabled={key === item.status}>
                        <div className="flex items-center gap-2">
                          <config.icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }
        },
        {
          header: "Payment",
          cell: (item) => {
            const config = PAYMENT_STATUS_CONFIG[(item as WholesaleOrder).payment_status] || PAYMENT_STATUS_CONFIG.unpaid;
            return (
              <Badge variant="outline" className={config.color}>
                {config.label}
              </Badge>
            );
          }
        },
        {
          header: "Courier",
          cell: (item) => (item as WholesaleOrder).courier?.full_name || 'Unassigned'
        },
        {
          header: "Created",
          cell: (item) => formatSmartDate(item.created_at)
        }
      ];
    } else {
      // Buying Mode
      return [
        {
          header: (
            <Checkbox
              checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
              onCheckedChange={handleSelectAll}
            />
          ),
          cell: (item) => (
            <div role="presentation" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedOrders.includes(item.id)}
                onCheckedChange={(checked) => handleSelectOrder(item.id, checked as boolean)}
              />
            </div>
          ),
          className: "w-[40px]"
        },
        {
          header: "PO #",
          cell: (item) => (
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{(item as PurchaseOrder).po_number}</span>
              <CopyButton text={(item as PurchaseOrder).po_number} size="sm" />
            </div>
          )
        },
        {
          header: "Vendor",
          cell: (item) => {
            const po = item as PurchaseOrder;
            return (
              <div>
                <p className="font-medium">{po.vendor?.name || 'Unknown Vendor'}</p>
                <p className="text-xs text-muted-foreground">{po.vendor?.contact_name}</p>
              </div>
            );
          }
        },
        {
          header: "Total",
          cell: (item) => formatCurrency((item as PurchaseOrder).total),
          className: "text-right"
        },
        {
          header: "Status",
          cell: (item) => {
            const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            // Only allow specific statuses for POs
            const allowedStatuses = ['draft', 'ordered', 'received', 'cancelled'];
            return (
              <div role="presentation" onClick={(e) => e.stopPropagation()}>
                <Select
                  value={item.status}
                  onValueChange={(value) => handleStatusUpdate(item.id, value)}
                >
                  <SelectTrigger className="w-32 h-8">
                    <Badge variant="outline" className={`${statusConfig.color} gap-1`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG)
                      .filter(([key]) => allowedStatuses.includes(key))
                      .map(([key, config]) => (
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
            );
          }
        },
        {
          header: "Exp. Delivery",
          cell: (item) => (item as PurchaseOrder).expected_delivery_date ? formatSmartDate((item as PurchaseOrder).expected_delivery_date!) : 'Pending'
        },
        {
          header: "Created",
          cell: (item) => formatSmartDate(item.created_at)
        }
      ];
    }
  }, [viewMode, selectedOrders, filteredOrders]);

  // Mobile Renderer
  const renderMobileCard = (item: OrderType) => {
    const isSelling = viewMode === 'selling';
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

    if (isSelling) {
      const order = item as WholesaleOrder;
      const paymentConfig = PAYMENT_STATUS_CONFIG[order.payment_status] || PAYMENT_STATUS_CONFIG.unpaid;

      return (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium">{order.order_number}</div>
              <div className="text-sm text-muted-foreground">
                <CustomerLink
                  customerId={order.client_id}
                  customerName={order.client?.business_name || 'Unknown Client'}
                />
              </div>
            </div>
            <Badge variant="outline" className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold">{formatCurrency(order.total_amount)}</span>
            <Badge variant="outline" className={paymentConfig.color}>
              {paymentConfig.label}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatSmartDate(order.created_at)}
          </div>
        </div>
      );
    } else {
      const po = item as PurchaseOrder;
      return (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium">{po.po_number}</div>
              <div className="text-sm text-muted-foreground">{po.vendor?.name}</div>
            </div>
            <Badge variant="outline" className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold">{formatCurrency(po.total)}</span>
            <span className="text-muted-foreground">{po.expected_delivery_date ? formatSmartDate(po.expected_delivery_date) : 'No ETA'}</span>
          </div>
        </div>
      );
    }
  };

  const handleRowClick = (item: OrderType) => {
    setSelectedOrder(item);
    if (viewMode === 'selling') {
      const dialog = document.getElementById('edit-wholesale-order-trigger');
      if (dialog) dialog.click();
      else setEditDialogOpen(true);
    }
  };

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    inTransit: orders.filter((o) => o.status === 'in_transit').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    totalRevenue: viewMode === 'selling'
      ? orders.reduce((sum, o) => sum + Number((o as WholesaleOrder).total_amount ?? 0), 0)
      : orders.reduce((sum, o) => sum + Number((o as PurchaseOrder).total ?? 0), 0),
  };

  const quickFilters = [
    { id: 'all', label: 'All Orders', count: stats.total },
    { id: 'pending', label: 'Pending', count: stats.pending },
    { id: 'in_transit', label: 'In Transit', count: stats.inTransit },
    { id: 'delivered', label: 'Delivered', count: stats.delivered },
  ];

  const bulkActions = viewMode === 'selling'
    ? [
      { label: 'Mark Confirmed', onClick: () => handleBulkStatusChange('confirmed') },
      { label: 'Mark In Transit', onClick: () => handleBulkStatusChange('in_transit') },
      { label: 'Mark Delivered', onClick: () => handleBulkStatusChange('delivered') },
      { label: 'Export Selected', onClick: handleExport },
    ]
    : [
      { label: 'Mark Ordered', onClick: () => handleBulkStatusChange('ordered') },
      { label: 'Mark Received', onClick: () => handleBulkStatusChange('received') },
      { label: 'Export Selected', onClick: handleExport },
    ];

  // Show full-page skeleton during initial load
  if (isLoading && orders.length === 0) {
    return <WholesaleOrdersPageSkeleton />;
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="w-full max-w-full space-y-4 sm:space-y-4 p-2 sm:p-4 md:p-4 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              {viewMode === 'selling' ? <><Package className="h-6 w-6" /> Wholesale Orders</> : <><Warehouse className="h-6 w-6" /> Purchase Orders</>}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {viewMode === 'selling'
                ? 'Manage B2B orders, track deliveries, and process payments'
                : 'Manage supplier orders, track shipments, and inventory restocking'
              }
            </p>
          </div>

          <div className="bg-muted p-1 rounded-lg flex self-start sm:self-center order-last sm:order-none">
            <Button
              variant={viewMode === 'selling' ? 'default' : 'ghost'}
              onClick={() => handleViewModeChange('selling')}
              size="sm"
              className="w-24"
            >
              Selling
            </Button>
            <Button
              variant={viewMode === 'buying' ? 'default' : 'ghost'}
              onClick={() => handleViewModeChange('buying')}
              size="sm"
              className="w-24"
            >
              Buying
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              onClick={() => {
                if (!tenant?.slug) return;
                if (viewMode === 'selling') {
                  navigate(`/${tenant.slug}/admin/wholesale-orders/new`);
                } else {
                  navigate(`/${tenant.slug}/admin/wholesale-orders/new-po`);
                }
              }}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              {viewMode === 'selling' ? 'New Order' : 'New PO'}
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
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs font-medium">
                    {activeFilterCount}
                  </Badge>
                </div>
              )}
              <div className="w-full sm:w-80">
                <SearchInput
                  placeholder="Search by order #, client, runner..."
                  defaultValue={searchQuery}
                  onSearch={handleSearchChange}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <div className="flex bg-muted/20 p-1 rounded-lg">
                {quickFilters.map((filter) => (
                  <Button
                    key={filter.id}
                    variant={statusFilter === filter.id ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleStatusFilterChange(filter.id)}
                    className="gap-2 h-7"
                  >
                    {filter.label}
                    <Badge variant="secondary" className="px-1 h-5 text-[10px] min-w-[1.25rem] bg-muted-foreground/10 text-muted-foreground">
                      {filter.count}
                    </Badge>
                  </Button>
                ))}
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-7 px-2"
                >
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
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
          <BulkActions
            selectedCount={selectedOrders.length}
            actions={bulkActions}
          />
        )}

        {/* Orders Table */}
        <Card className="overflow-hidden">
          <ResponsiveTable
            columns={columns}
            data={filteredOrders}
            isLoading={isLoading}
            mobileRenderer={renderMobileCard}
            keyExtractor={(item) => item.id}
            onRowClick={handleRowClick}
            emptyState={{
              icon: Package,
              title: searchQuery
                ? "No orders match your search"
                : hasActiveFilters
                  ? "No orders found"
                  : viewMode === 'selling' ? "No wholesale orders yet" : "No purchase orders yet",
              description: searchQuery
                ? `No results for "${searchQuery}". Try a different search term or clear your search.`
                : hasActiveFilters
                  ? "Try adjusting your filters to find orders."
                  : viewMode === 'selling'
                    ? "Wholesale orders will appear here once you start selling to clients."
                    : "Purchase orders will appear here once you start ordering from vendors.",
              primaryAction: hasActiveFilters ? {
                label: "Clear Filters",
                onClick: handleClearFilters
              } : {
                label: viewMode === 'selling' ? 'New Order' : 'New PO',
                onClick: () => tenant?.slug && navigate(`/${tenant.slug}/admin/wholesale-orders/${viewMode === 'selling' ? 'new' : 'new-po'}`),
                icon: Plus
              },
              designSystem: "tenant-admin"
            }}
          />

          {/* Search results count */}
          {hasActiveFilters && filteredOrders.length > 0 && (
            <div className="text-sm text-muted-foreground px-2 py-2">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          )}
        </Card>

        {/* Dialogs */}
        {selectedOrder && viewMode === 'selling' && (
          <EditWholesaleOrderDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            order={selectedOrder as WholesaleOrder}
            onSuccess={handleRefresh}
          />
        )}
      </div>
    </PullToRefresh>
  );
}
