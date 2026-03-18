import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOnEvent } from '@/lib/invalidation';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { humanizeError } from '@/lib/humanizeError';

interface UseInventorySyncProps {
    tenantId?: string;
    enabled?: boolean;
}

export function useInventorySync({ tenantId, enabled = true }: UseInventorySyncProps) {
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!enabled || !tenantId) return;

        const channel = supabase
            .channel(`inventory-sync-${tenantId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'products',
                    filter: `tenant_id=eq.${tenantId}`,
                },
                (payload) => {
                    logger.info('Inventory update received:', payload);
                    setLastSynced(new Date());

                    const newStock = payload.new.stock_quantity;
                    const oldStock = payload.old.stock_quantity;

                    // Stock actually changed - fire cross-panel invalidation
                    if (newStock !== oldStock) {
                        const productId = typeof payload.new.id === 'string' ? payload.new.id : undefined;
                        invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenantId, {
                            productId,
                        });
                    }

                    // Show toast for out-of-stock events
                    if (newStock === 0 && oldStock > 0) {
                        toast.error(`${payload.new.name} is now out of stock.`);
                    }

                    // Show toast for low stock threshold crossing
                    const threshold = payload.new.low_stock_alert ?? 10;
                    if (newStock > 0 && newStock <= threshold && oldStock > threshold) {
                        toast.warning(`${payload.new.name} is running low (${newStock} remaining).`);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId, enabled, queryClient]);

    return {
        lastSynced,
        isConnected: !!tenantId && enabled
    };
}

// --- Types for inventory sync mutations ---

export interface OrderItem {
    product_id: string;
    quantity: number;
    product_name?: string;
}

interface ConfirmOrderInventoryInput {
    orderId: string;
    items: OrderItem[];
}

interface CancelOrderInventoryInput {
    orderId: string;
    items: OrderItem[];
}

interface ProductCacheEntry {
    id: string;
    stock_quantity: number;
    available_quantity?: number;
    reserved_quantity?: number;
    [key: string]: unknown;
}

interface InventorySyncContext {
    previousProducts: Map<string, ProductCacheEntry | undefined>;
}

/**
 * Hook to decrement inventory when an order is confirmed.
 * Uses optimistic updates to immediately reflect stock changes in the UI,
 * with automatic rollback on failure.
 */
export function useConfirmOrderInventory() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();

    return useMutation<void, Error, ConfirmOrderInventoryInput, InventorySyncContext>({
        mutationFn: async ({ items }: ConfirmOrderInventoryInput) => {
            if (!tenant?.id) throw new Error('No tenant context');

            for (const item of items) {
                const { error } = await supabase.rpc('decrement_stock', {
                    p_product_id: item.product_id,
                    p_quantity: item.quantity,
                });

                if (error) {
                    logger.error('Failed to decrement stock', {
                        productId: item.product_id,
                        quantity: item.quantity,
                        error,
                    });
                    throw new Error(`Failed to decrement stock for ${item.product_name || item.product_id}: ${error.message}`);
                }
            }
        },

        onMutate: async ({ items }) => {
            // Cancel in-flight product queries to prevent overwriting optimistic update
            await queryClient.cancelQueries({ queryKey: queryKeys.products.all });
            await queryClient.cancelQueries({ queryKey: queryKeys.inventory.all });

            // Snapshot previous product data for rollback
            const previousProducts = new Map<string, ProductCacheEntry | undefined>();

            for (const item of items) {
                const productKey = queryKeys.products.lists();
                const previous = queryClient.getQueryData<ProductCacheEntry[]>(productKey);
                previousProducts.set(item.product_id, previous?.[0]);
            }

            // Optimistically update product list caches
            queryClient.setQueriesData<ProductCacheEntry[]>(
                { queryKey: queryKeys.products.lists() },
                (oldData) => {
                    if (!oldData) return oldData;
                    return oldData.map((product) => {
                        const item = items.find((i) => i.product_id === product.id);
                        if (!item) return product;
                        return {
                            ...product,
                            stock_quantity: Math.max(0, (product.stock_quantity || 0) - item.quantity),
                            available_quantity: product.available_quantity != null
                                ? Math.max(0, product.available_quantity - item.quantity)
                                : undefined,
                        };
                    });
                }
            );

            return { previousProducts };
        },

        onError: (error, { items: _items }, _context) => {
            logger.error('Confirm order inventory sync failed, rolling back', error);

            // Invalidate list caches to refetch correct state
            queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

            toast.error(humanizeError(error, "Failed to update stock levels. Please try again."));
        },

        onSuccess: (_data, { items }) => {
            logger.info('Order inventory decremented successfully', {
                itemCount: items.length,
            });

            // Invalidate to ensure caches stay fresh after optimistic update
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

            // Cross-panel invalidation: inventory change cascades to products, storefront, POS, dashboard
            if (tenant?.id) {
                for (const item of items) {
                    invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id, {
                        productId: item.product_id,
                    });
                }
            }

            toast.success(`Stock decremented for ${items.length} product${items.length > 1 ? 's' : ''}.`);
        },
    });
}

/**
 * Hook to increment inventory when an order is cancelled.
 * Uses optimistic updates to immediately reflect stock restoration in the UI,
 * with automatic rollback on failure.
 */
export function useCancelOrderInventory() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();

    return useMutation<void, Error, CancelOrderInventoryInput, InventorySyncContext>({
        mutationFn: async ({ items }: CancelOrderInventoryInput) => {
            if (!tenant?.id) throw new Error('No tenant context');

            for (const item of items) {
                const { error } = await supabase.rpc('increment_stock', {
                    p_product_id: item.product_id,
                    p_quantity: item.quantity,
                });

                if (error) {
                    logger.error('Failed to increment stock', {
                        productId: item.product_id,
                        quantity: item.quantity,
                        error,
                    });
                    throw new Error(`Failed to restore stock for ${item.product_name || item.product_id}: ${error.message}`);
                }
            }
        },

        onMutate: async ({ items }) => {
            // Cancel in-flight product queries to prevent overwriting optimistic update
            await queryClient.cancelQueries({ queryKey: queryKeys.products.all });
            await queryClient.cancelQueries({ queryKey: queryKeys.inventory.all });

            // Snapshot previous product data for rollback
            const previousProducts = new Map<string, ProductCacheEntry | undefined>();

            for (const item of items) {
                const productKey = queryKeys.products.lists();
                const previous = queryClient.getQueryData<ProductCacheEntry[]>(productKey);
                previousProducts.set(item.product_id, previous?.[0]);
            }

            // Optimistically update product list caches
            queryClient.setQueriesData<ProductCacheEntry[]>(
                { queryKey: queryKeys.products.lists() },
                (oldData) => {
                    if (!oldData) return oldData;
                    return oldData.map((product) => {
                        const item = items.find((i) => i.product_id === product.id);
                        if (!item) return product;
                        return {
                            ...product,
                            stock_quantity: (product.stock_quantity || 0) + item.quantity,
                            available_quantity: product.available_quantity != null
                                ? product.available_quantity + item.quantity
                                : undefined,
                        };
                    });
                }
            );

            return { previousProducts };
        },

        onError: (error, { items: _items }, _context) => {
            logger.error('Cancel order inventory sync failed, rolling back', error);

            // Invalidate list caches to refetch correct state
            queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

            toast.error(humanizeError(error, "Failed to restore stock levels. Please try again."));
        },

        onSuccess: (_data, { items }) => {
            logger.info('Order inventory restored successfully', {
                itemCount: items.length,
            });

            // Invalidate to ensure caches stay fresh after optimistic update
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

            // Cross-panel invalidation: inventory restoration cascades to products, storefront, POS, dashboard
            if (tenant?.id) {
                for (const item of items) {
                    invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id, {
                        productId: item.product_id,
                    });
                }
            }

            toast.success(`Stock restored for ${items.length} product${items.length > 1 ? 's' : ''}.`);
        },
    });
}
