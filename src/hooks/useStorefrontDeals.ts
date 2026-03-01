/**
 * useStorefrontDeals Hook
 * Fetches active deals/promotions for display on the storefront
 * Optimized for marketing display (vs useDeals which is for cart calculation)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface StorefrontDeal {
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
    image_url?: string | null;
}

export function useStorefrontDeals(storeId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.storefront.deals(storeId),
        queryFn: async (): Promise<StorefrontDeal[]> => {
            if (!storeId) return [];

            try {
                const { data, error } = await supabase
                    .from('marketplace_deals')
                    .select('id, name, description, discount_type, discount_value, applies_to, target_value, active_days, is_active, start_date, end_date, min_order_amount, first_time_only, image_url')
                    .eq('store_id', storeId)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });

                if (error) {
                    logger.warn('Failed to fetch storefront deals', error);
                    return [];
                }

                // Filter deals that are currently active based on day of week
                const currentDay = new Date().getDay();
                const now = new Date();

                const activeDeals = (data ?? []).filter((deal) => {
                    // Check if deal is active on current day
                    if (deal.active_days && deal.active_days.length > 0 && !deal.active_days.includes(currentDay)) {
                        return false;
                    }

                    // Check date range if specified
                    if (deal.start_date && new Date(deal.start_date) > now) {
                        return false;
                    }
                    if (deal.end_date && new Date(deal.end_date) < now) {
                        return false;
                    }

                    return true;
                });

                return activeDeals as StorefrontDeal[];
            } catch (err) {
                logger.warn('Deals not available', err);
                return [];
            }
        },
        enabled: !!storeId,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });
}

/**
 * Helper to format discount display
 */
export function formatDiscount(deal: StorefrontDeal): string {
    if (deal.discount_type === 'percentage') {
        return `${deal.discount_value}% OFF`;
    }
    return `$${deal.discount_value} OFF`;
}

/**
 * Helper to get day names from active_days array
 */
export function getDayNames(days: number[]): string {
    if (!days || days.length === 0 || days.length === 7) return 'Every Day';
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map(d => dayMap[d]).join(', ');
}
