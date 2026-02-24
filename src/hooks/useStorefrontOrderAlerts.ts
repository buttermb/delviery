/**
 * Storefront Order Alerts Hook
 * Subscribes to new storefront orders and shows toast notifications
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { invalidateOnEvent } from '@/lib/invalidation';
import { queryKeys } from '@/lib/queryKeys';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseStorefrontOrderAlertsOptions {
    enabled?: boolean;
    playSound?: boolean;
}

export function useStorefrontOrderAlerts({
    enabled = true,
    playSound = true,
}: UseStorefrontOrderAlertsOptions = {}) {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const channelRef = useRef<RealtimeChannel | null>(null);
    const storeIdsRef = useRef<string[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio (optional notification sound)
    useEffect(() => {
        if (playSound && typeof window !== 'undefined') {
            // Create a simple beep using Web Audio API
            audioRef.current = null; // We'll use a toast-only approach for now
        }
    }, [playSound]);

    useEffect(() => {
        if (!enabled || !tenant?.id) return;

        // First, fetch stores for this tenant
        const fetchStoresAndSubscribe = async () => {
            const { data: stores, error } = await supabase
                .from('marketplace_stores')
                .select('id, store_name')
                .eq('tenant_id', tenant.id);

            if (error) {
                logger.error('Failed to fetch stores for order alerts', error, { component: 'useStorefrontOrderAlerts' });
                return;
            }

            if (!stores || stores.length === 0) {
                return; // No stores, no need to subscribe
            }

            storeIdsRef.current = stores.map((s) => s.id);
            const storeNameMap = Object.fromEntries(stores.map((s) => [s.id, s.store_name]));

            // Subscribe to storefront_orders for these stores
            const channelKey = `storefront-order-alerts-${tenant.id}`;

            channelRef.current = supabase
                .channel(channelKey)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'storefront_orders',
                    },
                    (payload) => {
                        const order = payload.new as any;

                        // Check if this order belongs to one of our stores
                        if (!storeIdsRef.current.includes(order.store_id)) {
                            return;
                        }

                        const storeName = storeNameMap[order.store_id] || 'Storefront';
                        const customerName = order.customer_name || 'Customer';
                        const total = order.total || 0;

                        // Show toast notification
                        toast.success(`${customerName} placed an order for ${formatCurrency(total)}`, {
                            duration: 10000,
                        });

                        // Cross-panel invalidation: storefront order affects admin orders, dashboard, inventory
                        if (tenant?.id) {
                            invalidateOnEvent(queryClient, 'ORDER_CREATED', tenant.id);
                            invalidateOnEvent(queryClient, 'STOREFRONT_ORDER', tenant.id);
                        }

                        // Also invalidate storefront-specific queries
                        queryClient.invalidateQueries({ queryKey: queryKeys.storefrontOrders.all });
                        queryClient.invalidateQueries({ queryKey: queryKeys.tenantWidgets.realtimeSales() });
                        queryClient.invalidateQueries({ queryKey: queryKeys.tenantWidgets.multiChannelOrders() });
                        queryClient.invalidateQueries({ queryKey: queryKeys.storefrontPerformance.byTenant() });

                        // Admin orders panel should see this immediately
                        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
                        queryClient.invalidateQueries({ queryKey: queryKeys.unifiedOrders.all });
                        queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all });

                        logger.info('New storefront order received', {
                            orderId: order.id,
                            storeId: order.store_id,
                            total,
                            component: 'useStorefrontOrderAlerts',
                        });
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        logger.debug('Storefront order alerts active', { tenantId: tenant.id, component: 'useStorefrontOrderAlerts' });
                    }
                });
        };

        fetchStoresAndSubscribe();

        // Cleanup
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current).catch((err) => {
                    logger.warn('Error removing realtime channel', { error: err, component: 'useStorefrontOrderAlerts' });
                });
                channelRef.current = null;
            }
        };
    }, [enabled, tenant?.id, queryClient]);

    return {
        isActive: !!channelRef.current,
    };
}
