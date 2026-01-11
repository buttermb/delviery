import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ShopCartItem } from '@/hooks/useShopCart';
import { useMemo } from 'react';

export interface Deal {
    id: string;
    name: string;
    description: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    applies_to: 'order' | 'category' | 'brand' | 'collection' | 'product';
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
    // Fetch active deals
    const { data: deals = [], isLoading } = useQuery({
        queryKey: ['active-deals', storeId],
        queryFn: async () => {
            if (!storeId) return [];

            const { data, error } = await supabase
                .rpc('get_active_store_deals', { p_store_id: storeId });

            if (error) throw error;
            return data as Deal[];
        },
        enabled: !!storeId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Fetch customer order count for first-time deals
    const { data: customerData } = useQuery({
        queryKey: ['customer-order-count', storeId, customerEmail],
        queryFn: async () => {
            if (!storeId || !customerEmail) return { orderCount: 0, dealUsage: {} };

            // Get customer order count
            const { data: customer } = await supabase
                .from('marketplace_customers')
                .select('order_count')
                .eq('store_id', storeId)
                .eq('email', customerEmail)
                .maybeSingle();

            // Get deal usage counts
            const { data: usage } = await supabase
                .from('marketplace_deal_usage')
                .select('deal_id')
                .eq('store_id', storeId)
                .eq('customer_email', customerEmail);

            const usageCounts: Record<string, number> = {};
            (usage || []).forEach((u: any) => {
                usageCounts[u.deal_id] = (usageCounts[u.deal_id] || 0) + 1;
            });

            return {
                orderCount: customer?.order_count || 0,
                dealUsage: usageCounts
            };
        },
        enabled: !!storeId && !!customerEmail,
        staleTime: 1000 * 60 * 2,
    });

    // Calculate applied deals
    const { appliedDeals, totalDiscount } = useMemo(() => {
        if (!deals.length || !cartItems.length) {
            return { appliedDeals: [], totalDiscount: 0 };
        }

        const currentDay = new Date().getDay(); // 0-6
        const validDeals = deals.filter(deal => {
            // Check active days
            if (deal.active_days && !deal.active_days.includes(currentDay)) return false;

            // Check first-time only
            if (deal.first_time_only && customerData?.orderCount && customerData.orderCount > 0) {
                return false; // Customer has ordered before
            }

            // Check per-customer usage limits
            if (deal.max_uses_per_customer && customerData?.dealUsage) {
                const usageCount = customerData.dealUsage[deal.id] || 0;
                if (usageCount >= deal.max_uses_per_customer) {
                    return false; // Reached usage limit
                }
            }

            return true;
        });

        let totalDiscount = 0;
        const applied: AppliedDeal[] = [];

        // Simple calculation for now (doesn't handle category/brand matching without product details)
        // TODO: Fetch product details to support category/brand targeting
        // For this MVP, we'll support 'order' level deals primarily, 
        // and assume we can match 'target_value' against item name/variant for simple cases if needed.

        // Calculate discountable subtotal (exclude items marked as non-discountable)
        const discountableItems = cartItems.filter(item => !item.excludeFromDiscounts);
        const discountableSubtotal = discountableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Total cart value (for min order checks)
        const fullCartSubtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Check for Minimum Price Compliance
        // Calculate the maximum allowable discount for the entire cart based on per-item minimum prices
        let maxAllowableDiscount = 0;

        cartItems.forEach(item => {
            const itemMinPrice = (item as any).minimumPrice || 0; // Assuming item has minimumPrice attached
            const itemTotal = item.price * item.quantity;
            const itemMinTotal = itemMinPrice * item.quantity;

            // Should exclude items marked as excludeFromDiscounts? 
            // If excluded, max discount for that item is 0.
            if (item.excludeFromDiscounts) {
                // maxAllowableDiscount += 0; 
            } else {
                maxAllowableDiscount += Math.max(0, itemTotal - itemMinTotal);
            }
        });

        // Filter valid deals and calculate raw potential discount
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
            }

            if (dealDiscount > 0) {
                applied.push({ deal, discountAmount: dealDiscount });
                totalDiscount += dealDiscount;
            }
        }

        // Cap total discount at maxAllowableDiscount
        // Note: This is an order-level cap. If we had line-item discounts, we'd need more granular logic.
        // If no minimum prices are set (0), maxAllowableDiscount = fullCartSubtotal (or discountableSubtotal).

        // If we don't track minimum_price on ShopCartItem usage yet, we need to ensure it's passed.
        // Assuming it's passed, or defaulting to 0 implies no floor.

        if (totalDiscount > maxAllowableDiscount) {
            // We need to reduce the discount. 
            // Simplest approach: Reduce globally. 
            // Ideally we should warn the user, but for auto-apply deals we just cap.

            // We need to adjust 'applied' deals to reflect the cap?
            // Or just return the capped totalDiscount?
            // It's better to adjust the values so the UI matches.

            const reductionFactor = maxAllowableDiscount / totalDiscount;
            totalDiscount = maxAllowableDiscount;

            applied.forEach(ad => {
                ad.discountAmount = ad.discountAmount * reductionFactor;
            });
        }

        // Final safety check against negative cart
        if (totalDiscount > fullCartSubtotal) {
            totalDiscount = fullCartSubtotal;
            const reductionFactor = fullCartSubtotal / totalDiscount;
            applied.forEach(ad => {
                ad.discountAmount = ad.discountAmount * reductionFactor;
            });
        }

        return { appliedDeals: applied, totalDiscount };
    }, [deals, cartItems]);

    return {
        deals,
        isLoading,
        appliedDeals,
        totalDiscount
    };
}
