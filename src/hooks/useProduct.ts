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

/**
 * Order with product data for product order history
 */
export interface ProductOrder {
    id: string;
    order_number: string;
    created_at: string;
    status: string;
    contact_name: string | null;
    customer_id: string | null;
    total_amount: number;
    quantity: number;
}

export interface ProductOrderStats {
    totalSoldWeek: number;
    totalSoldMonth: number;
    totalSoldAllTime: number;
}

/**
 * Hook for fetching orders containing a specific product
 * Shows recent orders with this product, quantity ordered, and sales stats
 */
export function useProductOrders(productId: string | undefined) {
    const { tenant } = useTenantAdminAuth();

    return useQuery({
        queryKey: queryKeys.orders.byProduct(tenant?.id ?? '', productId ?? ''),
        queryFn: async (): Promise<{ orders: ProductOrder[]; stats: ProductOrderStats }> => {
            if (!productId || !tenant?.id) {
                return { orders: [], stats: { totalSoldWeek: 0, totalSoldMonth: 0, totalSoldAllTime: 0 } };
            }

            // Get orders containing this product via unified_order_items
            const { data: orderItems, error: itemsError } = await supabase
                .from('unified_order_items')
                .select(`
                    quantity,
                    order:unified_orders!inner(
                        id,
                        order_number,
                        created_at,
                        status,
                        contact_name,
                        customer_id,
                        total_amount,
                        tenant_id
                    )
                `)
                .eq('product_id', productId)
                .order('order(created_at)', { ascending: false });

            if (itemsError) {
                throw itemsError;
            }

            // Filter by tenant_id and transform data
            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            let totalSoldWeek = 0;
            let totalSoldMonth = 0;
            let totalSoldAllTime = 0;

            const orders: ProductOrder[] = [];
            const seenOrderIds = new Set<string>();

            for (const item of orderItems ?? []) {
                const order = item.order as unknown as {
                    id: string;
                    order_number: string;
                    created_at: string;
                    status: string;
                    contact_name: string | null;
                    customer_id: string | null;
                    total_amount: number;
                    tenant_id: string;
                };

                // Filter by tenant
                if (order.tenant_id !== tenant.id) {
                    continue;
                }

                // Calculate stats
                const orderDate = new Date(order.created_at);
                totalSoldAllTime += item.quantity;
                if (orderDate >= weekAgo) {
                    totalSoldWeek += item.quantity;
                }
                if (orderDate >= monthAgo) {
                    totalSoldMonth += item.quantity;
                }

                // Avoid duplicate orders (same order may have same product multiple times)
                if (!seenOrderIds.has(order.id)) {
                    seenOrderIds.add(order.id);
                    orders.push({
                        id: order.id,
                        order_number: order.order_number,
                        created_at: order.created_at,
                        status: order.status,
                        contact_name: order.contact_name,
                        customer_id: order.customer_id,
                        total_amount: order.total_amount,
                        quantity: item.quantity,
                    });
                }
            }

            return {
                orders,
                stats: {
                    totalSoldWeek,
                    totalSoldMonth,
                    totalSoldAllTime,
                },
            };
        },
        enabled: !!productId && !!tenant?.id,
        staleTime: 30_000,
    });
}
