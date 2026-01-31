/**
 * Hook for fetching a single product by ID
 * Used by ProductDetailsPage for displaying product details
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import type { Database } from '@/integrations/supabase/types';

type ProductRow = Database['public']['Tables']['products']['Row'];

export interface Product extends ProductRow {
    metrc_retail_id?: string | null;
    exclude_from_discounts?: boolean;
    minimum_price?: number;
}

interface UseProductOptions {
    productId: string | undefined;
    enabled?: boolean;
}

export function useProduct({ productId, enabled = true }: UseProductOptions) {
    const { tenant } = useTenantAdminAuth();

    return useQuery({
        queryKey: queryKeys.products.detail(productId ?? ''),
        queryFn: async (): Promise<Product | null> => {
            if (!productId || !tenant?.id) {
                return null;
            }

            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .eq('tenant_id', tenant.id)
                .maybeSingle();

            if (error) {
                throw error;
            }

            return data as Product | null;
        },
        enabled: enabled && !!productId && !!tenant?.id,
        staleTime: 30_000, // 30 seconds
    });
}

/**
 * Hook for fetching product inventory movements/history
 */
export function useProductInventoryHistory(productId: string | undefined) {
    const { tenant } = useTenantAdminAuth();

    return useQuery({
        queryKey: queryKeys.inventory.movements(productId),
        queryFn: async () => {
            if (!productId || !tenant?.id) {
                return [];
            }

            const { data, error } = await (supabase as any)
                .from('inventory_history')
                .select('*')
                .eq('product_id', productId)
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                throw error;
            }

            return data ?? [];
        },
        enabled: !!productId && !!tenant?.id,
    });
}

/**
 * Hook for fetching fronted inventory for a product
 */
export function useProductFrontedInventory(productId: string | undefined) {
    const { tenant } = useTenantAdminAuth();

    return useQuery({
        queryKey: [...queryKeys.frontedInventory.all, 'product', productId],
        queryFn: async () => {
            if (!productId || !tenant?.id) {
                return [];
            }

            const { data, error } = await supabase
                .from('fronted_inventory')
                .select(`
                    *,
                    client:crm_clients(id, name)
                `)
                .eq('product_id', productId)
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data ?? [];
        },
        enabled: !!productId && !!tenant?.id,
    });
}
