/**
 * Inventory Hub Counts Hook
 * Provides counts for the Inventory Hub Quick Links section
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';

export interface InventoryHubCounts {
    totalProducts: number;
    activeProducts: number;
    categoryCount: number;
    lowStockCount: number;
    outOfStockCount: number;
}

export function useInventoryHubCounts() {
    const { tenant } = useTenantAdminAuth();
    const tenantId = tenant?.id;

    const { data, isLoading, error } = useQuery({
        queryKey: queryKeys.inventory.hubCounts(tenantId ?? ''),
        queryFn: async (): Promise<InventoryHubCounts> => {
            if (!tenantId) {
                return {
                    totalProducts: 0,
                    activeProducts: 0,
                    categoryCount: 0,
                    lowStockCount: 0,
                    outOfStockCount: 0,
                };
            }

            // Fetch counts in parallel
            const [
                totalProductsResult,
                activeProductsResult,
                categoriesResult,
                lowStockResult,
                outOfStockResult,
            ] = await Promise.all([
                // Total products
                supabase
                    .from('products')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId),

                // Active products (in stock)
                supabase
                    .from('products')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('status', 'active'),

                // Categories count (graceful handling if table doesn't exist)
                supabase
                    .from('categories')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .then(result => {
                        // Handle missing table gracefully
                        if (result.error?.code === '42P01') {
                            return { count: 0, error: null };
                        }
                        return result;
                    }),

                // Low stock products (quantity_in_stock <= reorder_level and > 0)
                supabase
                    .from('products')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .gt('quantity_in_stock', 0)
                    .not('reorder_level', 'is', null)
                    .filter('quantity_in_stock', 'lte', 'reorder_level'),

                // Out of stock products
                supabase
                    .from('products')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('quantity_in_stock', 0),
            ]);

            return {
                totalProducts: totalProductsResult.count ?? 0,
                activeProducts: activeProductsResult.count ?? 0,
                categoryCount: categoriesResult.count ?? 0,
                lowStockCount: lowStockResult.count ?? 0,
                outOfStockCount: outOfStockResult.count ?? 0,
            };
        },
        enabled: !!tenantId,
        staleTime: 30000, // 30 seconds
        refetchInterval: 60000, // Refresh every minute
    });

    return {
        counts: data ?? {
            totalProducts: 0,
            activeProducts: 0,
            categoryCount: 0,
            lowStockCount: 0,
            outOfStockCount: 0,
        },
        isLoading,
        error,
    };
}
