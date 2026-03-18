import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShopCartItem } from '@/hooks/useShopCart';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface Deal {
    id: string;
    name: string;
    description: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    applies_to: 'order' | 'category' | 'brand' | 'collection' | 'product' | 'expiring_inventory';
    target_value: string | null;
    active_days: number[];
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
    min_order_amount: number;
    first_time_only?: boolean;
    max_uses_per_customer?: number | null;
}

export interface AppliedDeal {
    deal: Deal;
    discountAmount: number;
}

export function useDeals(storeId: string | undefined, cartItems: ShopCartItem[], customerEmail?: string) {
    // Fetch active deals from marketplace_deals table directly
    const { data: deals = [], isLoading } = useQuery({
        queryKey: queryKeys.activeDeals.byStore(storeId),
        queryFn: async (): Promise<Deal[]> => {
            if (!storeId) return [];

            try {
                // Query marketplace_deals table directly instead of RPC
                const { data, error } = await supabase
                    .from('marketplace_deals')
                    .select('id, name, description, discount_type, discount_value, applies_to, target_value, active_days, is_active, start_date, end_date, min_order_amount, first_time_only, max_uses_per_customer')
                    .eq('store_id', storeId)
                    .eq('is_active', true);

                if (error) {
                    logger.warn('Deals not available', error);
                    return [];
                }

                return (data ?? []) as unknown as Deal[];
            } catch (err) {
                logger.warn('Failed to fetch deals', err);
                return [];
            }
        },
        enabled: !!storeId,
        staleTime: 1000 * 60 * 5,
    });

    // Fetch customer order count for first-time deals
    const { data: customerData } = useQuery({
        queryKey: queryKeys.customerOrderCount.byStoreEmail(storeId, customerEmail),
        queryFn: async () => {
            if (!storeId || !customerEmail) return { orderCount: 0, dealUsage: {} };

            try {
                // Get order count from storefront_orders
                const { count } = await supabase
                    .from('storefront_orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('store_id', storeId)
                    .eq('customer_email', customerEmail);

                return {
                    orderCount: count ?? 0,
                    dealUsage: {} as Record<string, number>
                };
            } catch (err) {
                logger.warn('Failed to fetch customer data', err);
                return { orderCount: 0, dealUsage: {} };
            }
        },
        enabled: !!storeId && !!customerEmail,
        staleTime: 1000 * 60 * 2,
    });

    // Calculate applied deals
    const { appliedDeals, totalDiscount } = useMemo(() => {
        if (!deals.length || !cartItems.length) {
            return { appliedDeals: [], totalDiscount: 0 };
        }

        const currentDay = new Date().getDay();
        const validDeals = deals.filter(deal => {
            if (deal.active_days && !deal.active_days.includes(currentDay)) return false;
            if (deal.first_time_only && customerData?.orderCount && customerData.orderCount > 0) {
                return false;
            }
            return true;
        });

        let totalDiscount = 0;
        const applied: AppliedDeal[] = [];

        const discountableItems = cartItems.filter(item => !item.excludeFromDiscounts);
        const discountableSubtotal = discountableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const fullCartSubtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        for (const deal of validDeals) {
            if (deal.min_order_amount > 0 && fullCartSubtotal < deal.min_order_amount) continue;

            let dealDiscount = 0;

            if (deal.applies_to === 'order') {
                if (deal.discount_type === 'percentage') {
                    dealDiscount = discountableSubtotal * (deal.discount_value / 100);
                } else {
                    dealDiscount = deal.discount_value;
                    if (dealDiscount > discountableSubtotal) dealDiscount = discountableSubtotal;
                }

                // Enforce minimum price compliance
                // Calculate the total minimum allowed for all discountable items
                const minimumAllowedTotal = discountableItems.reduce((sum, item) => {
                    const minPrice = item.minimumPrice ?? 0;
                    return sum + (minPrice * item.quantity);
                }, 0);

                // Cap the discount so final price doesn't go below minimum
                const maxAllowedDiscount = Math.max(0, discountableSubtotal - minimumAllowedTotal);
                if (dealDiscount > maxAllowedDiscount) {
                    dealDiscount = maxAllowedDiscount;
                }
            } else if (deal.applies_to === 'expiring_inventory') {
                // Check for items matching expiry criteria
                const expiryThreshold = parseInt(deal.target_value || '0');

                const eligibleItems = discountableItems.filter(item =>
                    item.minExpiryDays !== undefined &&
                    item.minExpiryDays <= expiryThreshold
                );

                if (eligibleItems.length > 0) {
                    const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                    if (deal.discount_type === 'percentage') {
                        dealDiscount = eligibleSubtotal * (deal.discount_value / 100);
                    } else {
                        // For fixed amount on generic items, it's tricky.
                        // Let's treat it as "up to X off the eligible subtotal"
                        dealDiscount = deal.discount_value;
                        if (dealDiscount > eligibleSubtotal) dealDiscount = eligibleSubtotal;
                    }
                }
            }

            if (dealDiscount > 0) {
                applied.push({ deal, discountAmount: dealDiscount });
                totalDiscount += dealDiscount;
            }
        }

        if (totalDiscount > fullCartSubtotal) {
            totalDiscount = fullCartSubtotal;
        }

        return { appliedDeals: applied, totalDiscount };
    }, [deals, cartItems, customerData]);

    return {
        deals,
        isLoading,
        appliedDeals,
        totalDiscount
    };
}
