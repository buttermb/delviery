import { logger } from '@/lib/logger';
import { lazy, Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { Radio, RefreshCw, Volume2, VolumeX, Wifi, WifiOff, LayoutGrid, List } from 'lucide-react';

import type { DateRangeValue } from '@/components/admin/shared/FilterBar';
import type { LiveOrder } from '@/components/admin/live-orders/LiveOrdersKanban';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { LiveOrdersMobileList } from '@/components/admin/live-orders/LiveOrdersMobileList';
import {
  LiveOrdersFilters,
  useLiveOrderFilters,
  parseLiveOrderFilters,
} from '@/components/admin/live-orders/LiveOrdersFilters';
import { LiveOrderDetailPanel } from '@/components/admin/live-orders/LiveOrderDetailPanel';
import { playNewOrderSound, initAudio, isSoundEnabled, setSoundEnabled } from '@/lib/soundAlerts';
import { useAdminOrdersRealtime } from '@/hooks/useAdminOrdersRealtime';
import { useUndo } from '@/hooks/useUndo';
import { UndoToast } from '@/components/ui/undo-toast';
import { queryKeys } from '@/lib/queryKeys';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { PageErrorState } from '@/components/admin/shared/PageErrorState';
import { ModuleErrorBoundary } from '@/components/admin/shared/ModuleErrorBoundary';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { LiveOrdersStatsBar } from '@/components/admin/live-orders/LiveOrdersStatsBar';
import { useIsMobile } from '@/hooks/useIsMobile';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';

// Lazy-loaded view components — only the active view is loaded
const LiveOrdersKanban = lazy(() =>
  import('@/components/admin/live-orders/LiveOrdersKanban').then(m => ({ default: m.LiveOrdersKanban }))
);
const LiveOrdersListView = lazy(() =>
  import('@/components/admin/live-orders/LiveOrdersListView').then(m => ({ default: m.LiveOrdersListView }))
);

type ViewMode = 'kanban' | 'list';

// Type Definitions matching Supabase response
interface MenuOrderRaw {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  synced_order_id: string | null;
  contact_phone: string | null;
  payment_method: string | null;
  delivery_method: string | null;
  items: unknown[] | null;
  disposable_menus: {
    name: string;
    title?: string | null;
  } | null;
}

interface LiveOrdersProps {
  statusFilter?: string;
}

/** Skeleton fallback for lazy-loaded views */
function ViewSkeleton() {
  return (
    <div className="flex gap-4 h-full" role="status" aria-label="Loading view...">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex-1 min-w-[260px] space-y-3">
          <Skeleton className="h-8 w-full rounded-lg" />
          {[1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Determine fulfillment type from order data */
function getFulfillmentType(order: LiveOrder): 'delivery' | 'pickup' {
  if (!order.delivery_address) return 'pickup';
  return 'delivery';
}

export default function LiveOrders({ statusFilter }: LiveOrdersProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled);

  // Filter state
  const { filters, setFilters, clearFilters, searchValue, setSearchValue } = useLiveOrderFilters();
  const [selectedOrder, setSelectedOrder] = useState<LiveOrder | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const previousOrderCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef(true);

  // View mode persisted to localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.LIVE_ORDERS_VIEW);
    return (saved === 'list' || saved === 'kanban') ? saved : 'kanban';
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    safeStorage.setItem(STORAGE_KEYS.LIVE_ORDERS_VIEW, mode);
  };

  // Undo hook for status changes
  const { pendingAction, timeRemaining, executeWithUndo, undo, commit } = useUndo<{
    orderId: string;
    previousStatus: string;
    source: 'menu' | 'app';
  }>({
    timeout: 5000,
    onUndo: () => {
      toast.info('Status change undone');
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.live(tenant?.id) });
    },
    onCommit: () => {
      // Action is finalized, no additional work needed
    },
  });

  // Initialize audio on user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  // Toggle sound
  const handleToggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabledState(newState);
    setSoundEnabled(newState);
    initAudio(); // Ensure audio is initialized
  };

  // Enable Realtime Sync with connection tracking
  const { isActive: isConnected, channelCount } = useRealtimeSync({
    tenantId: tenant?.id,
    tables: ['orders', 'menu_orders'], // Listen to both tables
    enabled: !!tenant?.id
  });

  // Realtime subscription for new order notifications with highlight tracking
  const { newOrderIds } = useAdminOrdersRealtime({
    enabled: !!tenant?.id,
    onNewOrder: (event) => {
      logger.info('Live orders: new order received', {
        orderId: event.id,
        source: event.source,
        component: 'LiveOrders',
      });
    },
  });

  // Fetch Orders Query
  const { data: allOrders = [], isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.orders.live(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        // Parallel fetch for speed
        const [ordersRes, menuOrdersRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*, order_items(id)')
            .eq('tenant_id', tenant.id)
            .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'in_transit', 'delivered'])
            .order('created_at', { ascending: false }),

          supabase
            .from('menu_orders')
            .select(`
              id, created_at, status, total_amount, synced_order_id,
              contact_phone, payment_method, delivery_method, items,
              disposable_menus (name, title)
            `)
            .eq('tenant_id', tenant.id)
            .in('status', [
              'pending',
              'confirmed',
              'processing',
              'preparing',
              'ready_for_pickup',
              'in_transit',
              'delivered',
              'completed',
              'rejected',
              'cancelled',
            ])
            .is('synced_order_id', null) // Only show unsynced
            .order('created_at', { ascending: false }),
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (menuOrdersRes.error) throw menuOrdersRes.error;

        // Transform Regular Orders
        const normOrders: LiveOrder[] = (ordersRes.data ?? []).map(o => ({
          id: o.id,
          order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
          status: o.status,
          created_at: o.created_at,
          user_id: o.user_id,
          source: 'app' as const,
          total_amount: Number(o.total_amount ?? 0),
          customer_name: o.customer_name ?? undefined,
          customer_phone: o.customer_phone ?? undefined,
          delivery_address: o.delivery_address || undefined,
          payment_method: o.payment_method || undefined,
          payment_status: o.payment_status ?? undefined,
          order_type: o.order_type ?? undefined,
          items_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
        }));

        // Transform Menu Orders
        const normMenuOrders: LiveOrder[] = ((menuOrdersRes.data ?? []) as unknown as MenuOrderRaw[]).map((mo) => {
          const menuItems = Array.isArray(mo.items) ? mo.items : [];
          return {
            id: mo.id,
            order_number: 'MENU-' + mo.id.slice(0, 5).toUpperCase(),
            status: mo.status === 'completed' ? 'delivered' : mo.status,
            created_at: mo.created_at,
            user_id: 'guest',
            source: 'menu' as const,
            menu_title: mo.disposable_menus?.name || mo.disposable_menus?.title || undefined,
            total_amount: Number(mo.total_amount ?? 0),
            customer_phone: mo.contact_phone ?? undefined,
            payment_method: mo.payment_method ?? undefined,
            order_type: mo.delivery_method ?? undefined,
            items_count: menuItems.length,
          };
        });

        // Combine
        let combined = [...normOrders, ...normMenuOrders].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Apply status filter if provided via prop
        if (statusFilter === 'pending') {
          combined = combined.filter(o =>
            ['pending', 'confirmed', 'preparing', 'ready_for_pickup'].includes(o.status)
          );
        } else if (statusFilter === 'in_transit') {
          combined = combined.filter(o =>
            ['in_transit', 'delivered'].includes(o.status)
          );
        }

        return combined;

      } catch (err) {
        logger.error('Failed to fetch live orders', err);
        return [];
      }
    },
    enabled: !!tenant?.id,
    refetchInterval: 30000, // Fallback poll every 30s
    refetchOnWindowFocus: true, // Re-fetch when admin switches back to tab
  });

  // Apply client-side filters
  const filteredOrders = useMemo(() => {
    const parsed = parseLiveOrderFilters(filters, searchValue);
    let result = allOrders;

    // Status filter
    if (parsed.status) {
      result = result.filter(o => o.status === parsed.status);
    }

    // Payment status filter
    if (parsed.paymentStatus) {
      result = result.filter(o => o.payment_status === parsed.paymentStatus);
    }

    // Fulfillment filter (delivery vs pickup)
    if (parsed.fulfillment) {
      result = result.filter(o => getFulfillmentType(o) === parsed.fulfillment);
    }

    // Source filter (app vs menu)
    if (parsed.source) {
      result = result.filter(o => o.source === parsed.source);
    }

    // Date range filter
    if (parsed.dateRange) {
      const dateRange = parsed.dateRange as DateRangeValue;
      if (dateRange.from) {
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        result = result.filter(o => new Date(o.created_at) >= fromDate);
      }
      if (dateRange.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        result = result.filter(o => new Date(o.created_at) <= toDate);
      }
    }

    // Search filter (order number)
    if (parsed.search) {
      const searchLower = parsed.search.toLowerCase();
      result = result.filter(o =>
        o.order_number.toLowerCase().includes(searchLower) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(searchLower))
      );
    }

    return result;
  }, [allOrders, filters, searchValue]);

  // Play sound when new orders arrive (based on all orders, not filtered)
  useEffect(() => {
    if (isLoading) return;

    const currentCount = allOrders.length;

    // Skip first load - don't play sound when page opens
    if (isFirstLoadRef.current) {
      previousOrderCountRef.current = currentCount;
      isFirstLoadRef.current = false;
      return;
    }

    // Play sound if we have more orders than before
    if (currentCount > previousOrderCountRef.current && soundEnabled) {
      playNewOrderSound();
      toast.info('New order received!', {
        duration: 3000,
      });
    }

    previousOrderCountRef.current = currentCount;
  }, [allOrders.length, isLoading, soundEnabled]);

  // Helper function to update status in database
  const updateStatusInDb = async (
    orderId: string,
    newStatus: string,
    source: 'menu' | 'app'
  ) => {
    const table = source === 'menu' ? 'menu_orders' : 'orders';
    const dbStatus = (source === 'menu' && newStatus === 'delivered') ? 'completed' : newStatus;

    const { error } = await supabase
      .from(table)
      .update({ status: dbStatus })
      .eq('id', orderId)
      .eq('tenant_id', tenant?.id);

    if (error) throw error;
  };

  // Handle status change with undo support
  const handleStatusChange = async (
    orderId: string,
    newStatus: string,
    source: 'menu' | 'app'
  ) => {
    // Find the order to get previous status
    const order = allOrders.find((o) => o.id === orderId);
    if (!order) return;

    const previousStatus = order.status;

    try {
      await executeWithUndo({
        description: `Order moved to ${newStatus}`,
        data: { orderId, previousStatus, source },
        execute: async () => {
          await updateStatusInDb(orderId, newStatus, source);
          // Invalidate all related queries to ensure inventory and stats are up to date
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.live(tenant?.id) });
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(tenant?.id) });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });
        },
        undo: async () => {
          await updateStatusInDb(orderId, previousStatus, source);
          // Re-invalidate on undo to restore state
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.live(tenant?.id) });
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(tenant?.id) });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.badgeCounts.all });
        },
      });
    } catch (error) {
      logger.error('Failed to update status', error);
      toast.error('Failed to update status', { description: humanizeError(error) });
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleViewDetails = (order: LiveOrder) => {
    setSelectedOrder(order);
    setDetailPanelOpen(true);
  };

  return (
    <div className="flex flex-col h-dvh overflow-hidden bg-slate-50 dark:bg-zinc-950">
      <SEOHead
        title="Live Orders | Command Center"
        description="Real-time kitchen and delivery swimlanes"
      />

      {/* Header */}
      <div className="flex-none px-4 sm:px-6 py-3 sm:py-4 border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        <div className="flex justify-between items-start sm:items-center gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
              Live Orders
              <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-green-500"></span>
              </span>
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {filteredOrders.length} active orders • {viewMode === 'kanban' ? 'Swimlane View' : 'List View'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* View Toggle */}
            <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 gap-1.5"
                onClick={() => handleViewModeChange('kanban')}
                aria-label="Kanban view"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Board</span>
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 gap-1.5"
                onClick={() => handleViewModeChange('list')}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">List</span>
              </Button>
            </div>

            {/* Connection Status */}
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-colors ${isConnected
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
                }`}
              title={isConnected ? `Connected (${channelCount} channels)` : 'Disconnected - Using polling'}
            >
              {isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {isConnected ? 'Live' : 'Poll'}
            </div>

            {/* Sound Toggle */}
            <Button
              variant={soundEnabled ? "default" : "outline"}
              size="sm"
              onClick={handleToggleSound}
              className="gap-1 sm:gap-2 h-8 px-2 sm:px-3"
              title={soundEnabled ? "Sound alerts on" : "Sound alerts off"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{soundEnabled ? "Sound On" : "Sound Off"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoading}
              className="gap-1 sm:gap-2 h-8 px-2 sm:px-3"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <LiveOrdersStatsBar />

      {/* Filters */}
      <div className="flex-none px-6 py-3 border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
        <LiveOrdersFilters
          filters={filters}
          onFiltersChange={setFilters}
          onClear={clearFilters}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        <PullToRefresh onRefresh={async () => { await refetch(); }}>
          <div className="h-full">
            {isLoading ? (
              <ViewSkeleton />
            ) : isError ? (
              <PageErrorState
                onRetry={() => refetch()}
                message="Failed to load live orders. Please try again."
              />
            ) : filteredOrders.length === 0 ? (
              <EmptyState
                icon={Radio}
                title="No active orders right now"
                description="Live orders appear here in real-time when customers place orders"
              />
            ) : isMobile ? (
              <LiveOrdersMobileList
                orders={filteredOrders}
                isLoading={isLoading}
                onStatusChange={(id, status, source) => handleStatusChange(id, status, source)}
              />
            ) : viewMode === 'list' ? (
              <ModuleErrorBoundary moduleName="List View">
                <Suspense fallback={<ViewSkeleton />}>
                  <LiveOrdersListView
                    orders={filteredOrders}
                    isLoading={isLoading}
                    onStatusChange={(id, status, source) => handleStatusChange(id, status, source)}
                  />
                </Suspense>
              </ModuleErrorBoundary>
            ) : (
              <ModuleErrorBoundary moduleName="Kanban Board">
                <Suspense fallback={<ViewSkeleton />}>
                  <LiveOrdersKanban
                    orders={filteredOrders}
                    isLoading={isLoading}
                    onStatusChange={(id, status, source) => handleStatusChange(id, status, source)}
                    newOrderIds={newOrderIds}
                  />
                </Suspense>
              </ModuleErrorBoundary>
            )}
          </div>
        </PullToRefresh>
      </div>

      {/* Undo Toast */}
      {pendingAction && (
        <UndoToast
          description={pendingAction.description}
          timeRemaining={timeRemaining}
          totalTime={5000}
          onUndo={undo}
          onDismiss={commit}
        />
      )}

      {/* Order Detail Slide-Over */}
      <LiveOrderDetailPanel
        order={selectedOrder}
        open={detailPanelOpen}
        onOpenChange={setDetailPanelOpen}
        onStatusChange={(id, status, source) => handleStatusChange(id, status, source)}
      />
    </div>
  );
}
