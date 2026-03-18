/**
 * Smart TV Dashboard
 * 
 * Full-screen operations command center optimized for 55"+ displays.
 * Shows all critical operational data in a single glanceable view.
 * 
 * Features:
 * - 6-panel grid layout optimized for 1080p/4K
 * - Real-time order updates via Supabase subscription
 * - Auto-refresh every 30 seconds
 * - Dark theme for reduced eye strain
 * - Optional fullscreen mode via URL param
 * 
 * URL: /{tenant}/admin/tv-dashboard
 * URL Params:
 *   - fullscreen=true: Auto-enter fullscreen on load
 *   - refresh=N: Custom refresh interval in seconds (default: 30)
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';

import { queryKeys } from '@/lib/queryKeys';
import {
    TVHeaderBar,
    TVMetricsWidget,
    TVLiveOrdersWidget,
    TVInventoryWidget,
    TVRevenueChartWidget,
    TVActivityTicker,
    type TVOrder,
    type InventoryAlert,
    type HourlyRevenue,
    type ActivityEvent,
} from '@/components/admin/tv-dashboard';

export default function SmartTVDashboard() {
    const [searchParams] = useSearchParams();
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();

    const [isConnected, setIsConnected] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);

    // URL params
    const autoFullscreen = searchParams.get('fullscreen') === 'true';
    const refreshInterval = parseInt(searchParams.get('refresh') || '30', 10) * 1000;

    // Auto-fullscreen on load
    useEffect(() => {
        if (autoFullscreen && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {
                // Fullscreen may be blocked by browser
                logger.warn('Fullscreen request blocked by browser');
            });
        }
    }, [autoFullscreen]);

    // Fetch today's orders and metrics
    const { data: ordersData } = useQuery({
        queryKey: queryKeys.smartTVDashboard.orders(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return { orders: [], metrics: { revenue: 0, completed: 0, itemsSold: 0 } };

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Fetch menu orders
            const { data: menuOrders, error: menuError } = await supabase
                .from('menu_orders')
                .select('id, created_at, total_amount, status, disposable_menus(title)')
                .eq('tenant_id', tenant.id)
                .gte('created_at', today.toISOString())
                .order('created_at', { ascending: false });

            if (menuError) {
                logger.error('Error fetching menu orders:', menuError);
            }

            // Fetch app orders (using menu_orders only for now as main orders table may have different schema)
            // We focus on menu_orders which is the primary order source
            const appOrders: typeof menuOrders = [];

            // Combine and transform orders
            const orders: TVOrder[] = [
                ...(menuOrders ?? []).map((o, i) => ({
                    id: o.id,
                    orderNumber: String(i + 1).padStart(3, '0'),
                    source: o.disposable_menus?.title || 'Menu',
                    total: o.total_amount ?? 0,
                    status: mapStatus(o.status),
                    createdAt: new Date(o.created_at),
                })),
                ...(appOrders ?? []).map((o, i) => ({
                    id: o.id,
                    orderNumber: String(menuOrders?.length ?? 0 + i + 1).padStart(3, '0'),
                    source: 'App',
                    total: o.total_amount ?? 0,
                    status: mapStatus(o.status),
                    createdAt: new Date(o.created_at),
                })),
            ];

            // Calculate metrics
            const completedOrders = orders.filter(o => o.status === 'completed');
            const revenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
            const itemsSold = completedOrders.length * 2; // Estimate items per order

            return {
                orders: orders.filter(o => o.status !== 'completed'),
                metrics: {
                    revenue,
                    completed: completedOrders.length,
                    itemsSold,
                },
            };
        },
        refetchInterval: refreshInterval,
        enabled: !!tenant?.id,
    });

    // Fetch hourly revenue data
    const { data: hourlyData } = useQuery({
        queryKey: queryKeys.smartTVDashboard.hourly(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from('menu_orders')
                .select('created_at, total_amount')
                .eq('tenant_id', tenant.id)
                .eq('status', 'completed')
                .gte('created_at', today.toISOString());

            if (error) {
                logger.error('Error fetching hourly data:', error);
                return [];
            }

            // Group by hour
            const hourlyMap = new Map<number, number>();
            (data ?? []).forEach(order => {
                const hour = new Date(order.created_at).getHours();
                hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + (order.total_amount ?? 0));
            });

            const result: HourlyRevenue[] = [];
            hourlyMap.forEach((revenue, hour) => {
                result.push({ hour, revenue });
            });

            return result;
        },
        refetchInterval: refreshInterval,
        enabled: !!tenant?.id,
    });

    // Fetch inventory alerts
    const { data: inventoryAlerts } = useQuery({
        queryKey: queryKeys.smartTVDashboard.inventory(tenant?.id),
        queryFn: async () => {
            if (!tenant?.id) return [];

            const { data, error } = await supabase
                .from('products')
                .select('id, name, stock_quantity')
                .eq('tenant_id', tenant.id)
                .not('stock_quantity', 'is', null)
                .lt('stock_quantity', 10); // Low stock threshold

            if (error) {
                logger.error('Error fetching inventory:', error);
                return [];
            }

            // Transform to alerts
            const alerts: InventoryAlert[] = (data ?? [])
                .map(p => ({
                    id: p.id,
                    productName: p.name,
                    currentQty: p.stock_quantity!,
                    threshold: 10, // Default threshold
                }));

            return alerts;
        },
        refetchInterval: refreshInterval * 2, // Less frequent for inventory
        enabled: !!tenant?.id,
    });

    // Real-time subscription for orders
    useEffect(() => {
        if (!tenant?.id) return;

        const channel = supabase
            .channel(`tv-dashboard-orders-${tenant.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'menu_orders',
                    filter: `tenant_id=eq.${tenant.id}`,
                },
                (payload) => {
                    logger.info('Order change:', payload.eventType);
                    setLastUpdated(new Date());

                    // Add to activity feed
                    const event: ActivityEvent = {
                        id: crypto.randomUUID(),
                        type: payload.eventType === 'INSERT' ? 'order_new' : 'order_status',
                        message: payload.eventType === 'INSERT'
                            ? 'New order received'
                            : `Order status changed to ${(payload.new as Record<string, unknown>)?.status || 'unknown'}`,
                        timestamp: new Date(),
                    };
                    setActivityEvents(prev => [event, ...prev].slice(0, 20));

                    // Invalidate queries
                    queryClient.invalidateQueries({ queryKey: queryKeys.smartTVDashboard.orders() });
                }
            )
            .subscribe((status) => {
                setIsConnected(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenant?.id, queryClient]);

    // Calculate derived values
    const openOrders = ordersData?.orders?.length ?? 0;
    const todayRevenue = ordersData?.metrics?.revenue ?? 0;
    const avgOrderValue = ordersData?.metrics?.completed
        ? todayRevenue / ordersData.metrics.completed
        : 0;
    const itemsSold = ordersData?.metrics?.itemsSold ?? 0;

    return (
        <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col overflow-hidden" data-dark-panel>
            {/* Header */}
            <TVHeaderBar isConnected={isConnected} lastUpdated={lastUpdated} />

            {/* Main Grid */}
            <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 p-4 min-h-0">
                {/* Top Left - Live Orders */}
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 overflow-hidden">
                    <TVLiveOrdersWidget orders={ordersData?.orders ?? []} />
                </div>

                {/* Top Right - Key Metrics */}
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
                    <TVMetricsWidget
                        todayRevenue={todayRevenue}
                        openOrders={openOrders}
                        avgOrderValue={avgOrderValue}
                        itemsSold={itemsSold}
                    />
                </div>

                {/* Bottom Left - Inventory Alerts */}
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4 overflow-hidden">
                    <TVInventoryWidget alerts={inventoryAlerts ?? []} />
                </div>

                {/* Bottom Right - Revenue Chart */}
                <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-4">
                    <TVRevenueChartWidget data={hourlyData ?? []} />
                </div>
            </div>

            {/* Activity Ticker */}
            <TVActivityTicker events={activityEvents} />
        </div>
    );
}

// Helper to map database status to TV display status
function mapStatus(status: string | null): TVOrder['status'] {
    switch (status?.toLowerCase()) {
        case 'pending':
        case 'new':
            return 'new';
        case 'preparing':
        case 'in_progress':
        case 'processing':
            return 'preparing';
        case 'ready':
        case 'ready_for_pickup':
            return 'ready';
        case 'completed':
        case 'delivered':
            return 'completed';
        default:
            return 'new';
    }
}
