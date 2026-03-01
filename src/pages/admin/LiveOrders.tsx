import { logger } from '@/lib/logger';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { Radio, RefreshCw, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { LiveOrdersKanban, type LiveOrder } from '@/components/admin/live-orders/LiveOrdersKanban';
import { LiveOrdersMobileList } from '@/components/admin/live-orders/LiveOrdersMobileList';
import { playNewOrderSound, initAudio, isSoundEnabled, setSoundEnabled } from '@/lib/soundAlerts';
import { useUndo } from '@/hooks/useUndo';
import { UndoToast } from '@/components/ui/undo-toast';
import { queryKeys } from '@/lib/queryKeys';
import { EmptyState } from '@/components/admin/shared/EmptyState';
import { PullToRefresh } from '@/components/mobile/PullToRefresh';
import { LiveOrdersStatsBar } from '@/components/admin/live-orders/LiveOrdersStatsBar';
import { useIsMobile } from '@/hooks/useIsMobile';

// Type Definitions matching Supabase response
interface MenuOrderRaw {
  id: string;
  created_at: string;
  status: string;
  total_amount: number;
  synced_order_id: string | null;
  disposable_menus: {
    name: string;
    title?: string | null;
  } | null;
}

interface LiveOrdersProps {
  statusFilter?: string;
}

export default function LiveOrders({ statusFilter }: LiveOrdersProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled);
  const previousOrderCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef(true);

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

  // Fetch Orders Query
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.orders.live(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      try {
        // Parallel fetch for speed
        const [ordersRes, menuOrdersRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .eq('tenant_id', tenant.id)
            .in('status', ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'in_transit', 'delivered'])
            .order('created_at', { ascending: false }),

          supabase
            .from('menu_orders')
            .select(`
              id, created_at, status, total_amount, synced_order_id,
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
            .order('created_at', { ascending: false })
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
          source: 'app',
          total_amount: Number(o.total_amount ?? 0)
        }));

        // Transform Menu Orders
        const normMenuOrders: LiveOrder[] = ((menuOrdersRes.data ?? []) as unknown as MenuOrderRaw[]).map((mo) => ({
          id: mo.id,
          order_number: 'MENU-' + mo.id.slice(0, 5).toUpperCase(),
          status: mo.status === 'completed' ? 'delivered' : mo.status, // Map completed -> delivered
          created_at: mo.created_at,
          user_id: 'guest',
          source: 'menu',
          menu_title: mo.disposable_menus?.name || mo.disposable_menus?.title || undefined,
          total_amount: Number(mo.total_amount ?? 0)
        }));

        // Combine
        let combined = [...normOrders, ...normMenuOrders].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Apply status filter if provided
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
    refetchInterval: 30000 // Fallback poll every 30s
  });

  // Play sound when new orders arrive
  useEffect(() => {
    if (isLoading) return;

    const currentCount = orders.length;

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
  }, [orders.length, isLoading, soundEnabled]);

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
    const order = orders.find((o) => o.id === orderId);
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
              {orders.length} active • {isMobile ? 'Card View' : 'Swimlane View'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
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

      {/* Orders Container */}
      <div className="flex-1 overflow-auto p-2 sm:p-3">
        <PullToRefresh onRefresh={async () => { await refetch(); }}>
          <div className="h-full">
            {!isLoading && orders.length === 0 ? (
              <EmptyState
                icon={Radio}
                title="No active orders right now"
                description="Live orders appear here in real-time when customers place orders"
              />
            ) : isMobile ? (
              <LiveOrdersMobileList
                orders={orders}
                isLoading={isLoading}
                onStatusChange={(id, status, source) => handleStatusChange(id, status, source)}
              />
            ) : (
              <LiveOrdersKanban
                orders={orders}
                isLoading={isLoading}
                onStatusChange={(id, status, source) => handleStatusChange(id, status, source)}
              />
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
    </div>
  );
}
