/**
 * Orders Hub Counts Hook
 * Provides counts for the Orders Hub Quick Links section
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';

export interface OrdersHubCounts {
    totalOrders: number;
    templates: number;
    activeRoutes: number;
    activeCouriers: number;
}

export function useOrdersHubCounts() {
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;

    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.orders.hubCounts(tenantId ?? ''),
        queryFn: async (): Promise<OrdersHubCounts> => {
            if (!tenantId) {
                return {
                    totalOrders: 0,
                    templates: 0,
                    activeRoutes: 0,
                    activeCouriers: 0,
                };
            }

            // Fetch counts in parallel
            const [
                wholesaleResult,
                menuResult,
                storefrontResult,
                couriersResult,
                deliveriesResult,
            ] = await Promise.all([
                // Total wholesale orders (last 30 days)
                supabase
                    .from('wholesale_orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

                // Total menu orders (last 30 days)
                supabase
                    .from('menu_orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

                // Total storefront orders (last 30 days)
                supabase
                    .from('storefront_orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

                // Active couriers (online)
                supabase
                    .from('couriers')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('is_online', true)
                    .eq('is_active', true),

                // Active deliveries (routes in progress)
                supabase
                    .from('wholesale_deliveries')
                    .select('runner_id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .in('status', ['assigned', 'picked_up', 'in_transit']),
            ]);

            const wholesaleCount = wholesaleResult.count ?? 0;
            const menuCount = menuResult.count ?? 0;
            const storefrontCount = storefrontResult.count ?? 0;

            return {
                totalOrders: wholesaleCount + menuCount + storefrontCount,
                templates: 0, // Placeholder - order templates feature not yet implemented
                activeRoutes: deliveriesResult.count ?? 0,
                activeCouriers: couriersResult.count ?? 0,
            };
        },
        enabled: !!tenantId,
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // Refresh every minute
    });

    return {
        counts: data ?? {
            totalOrders: 0,
            templates: 0,
            activeRoutes: 0,
            activeCouriers: 0,
        },
        isLoading,
        error,
    };
}
