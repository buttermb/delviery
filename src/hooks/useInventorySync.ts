import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface UseInventorySyncProps {
    tenantId?: string;
    enabled?: boolean;
}

export function useInventorySync({ tenantId, enabled = true }: UseInventorySyncProps) {
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!enabled || !tenantId) return;

        const channel = supabase
            .channel('inventory-sync')
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

                    // Optional: Show toast for significant updates or low stock
                    const newStock = payload.new.stock_quantity;
                    const oldStock = payload.old.stock_quantity;

                    if (newStock === 0 && oldStock > 0) {
                        toast({
                            title: "Product Out of Stock",
                            description: `${payload.new.name} is now out of stock.`,
                            variant: "destructive"
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [tenantId, enabled, toast]);

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
    const { toast } = useToast();

    return useMutation<void, Error, ConfirmOrderInventoryInput, InventorySyncContext>({
        mutationFn: async ({ items }: ConfirmOrderInventoryInput) => {
            if (!tenant?.id) throw new Error('No tenant context');

            for (const item of items) {
                // @ts-ignore - RPC function not in generated types
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
                const productKey = queryKeys.products.detail(item.product_id);
                const previous = queryClient.getQueryData<ProductCacheEntry>(productKey);
                previousProducts.set(item.product_id, previous);

                // Optimistically decrement stock in product detail cache
                if (previous) {
                    queryClient.setQueryData<ProductCacheEntry>(productKey, {
                        ...previous,
                        stock_quantity: Math.max(0, (previous.stock_quantity || 0) - item.quantity),
                        available_quantity: previous.available_quantity != null
                            ? Math.max(0, previous.available_quantity - item.quantity)
                            : undefined,
                    });
                }
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

        onError: (error, { items }, context) => {
            logger.error('Confirm order inventory sync failed, rolling back', error);

            // Rollback product detail caches
            if (context?.previousProducts) {
                for (const item of items) {
                    const productKey = queryKeys.products.detail(item.product_id);
                    const previous = context.previousProducts.get(item.product_id);
                    if (previous) {
                        queryClient.setQueryData(productKey, previous);
                    } else {
                        queryClient.removeQueries({ queryKey: productKey });
                    }
                }
            }

            // Invalidate list caches to refetch correct state
            queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

            toast({
                title: "Inventory Update Failed",
                description: error.message || "Failed to update stock levels. Please try again.",
                variant: "destructive",
            });
        },

        onSuccess: (_data, { items }) => {
            logger.info('Order inventory decremented successfully', {
                itemCount: items.length,
            });

            // Invalidate to ensure caches stay fresh after optimistic update
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

            toast({
                title: "Inventory Updated",
                description: `Stock decremented for ${items.length} product${items.length > 1 ? 's' : ''}.`,
            });
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
    const { toast } = useToast();

    return useMutation<void, Error, CancelOrderInventoryInput, InventorySyncContext>({
        mutationFn: async ({ items }: CancelOrderInventoryInput) => {
            if (!tenant?.id) throw new Error('No tenant context');

            for (const item of items) {
                // @ts-ignore - RPC function not in generated types
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
                const productKey = queryKeys.products.detail(item.product_id);
                const previous = queryClient.getQueryData<ProductCacheEntry>(productKey);
                previousProducts.set(item.product_id, previous);

                // Optimistically increment stock in product detail cache
                if (previous) {
                    queryClient.setQueryData<ProductCacheEntry>(productKey, {
                        ...previous,
                        stock_quantity: (previous.stock_quantity || 0) + item.quantity,
                        available_quantity: previous.available_quantity != null
                            ? previous.available_quantity + item.quantity
                            : undefined,
                    });
                }
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

        onError: (error, { items }, context) => {
            logger.error('Cancel order inventory sync failed, rolling back', error);

            // Rollback product detail caches
            if (context?.previousProducts) {
                for (const item of items) {
                    const productKey = queryKeys.products.detail(item.product_id);
                    const previous = context.previousProducts.get(item.product_id);
                    if (previous) {
                        queryClient.setQueryData(productKey, previous);
                    } else {
                        queryClient.removeQueries({ queryKey: productKey });
                    }
                }
            }

            // Invalidate list caches to refetch correct state
            queryClient.invalidateQueries({ queryKey: queryKeys.products.lists() });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

            toast({
                title: "Inventory Restoration Failed",
                description: error.message || "Failed to restore stock levels. Please try again.",
                variant: "destructive",
            });
        },

        onSuccess: (_data, { items }) => {
            logger.info('Order inventory restored successfully', {
                itemCount: items.length,
            });

            // Invalidate to ensure caches stay fresh after optimistic update
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });

            toast({
                title: "Inventory Restored",
                description: `Stock restored for ${items.length} product${items.length > 1 ? 's' : ''}.`,
            });
        },
    });
}
