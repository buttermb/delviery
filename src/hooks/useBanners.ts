/**
 * useBanners Hook
 * Fetches active marketing banners for a store's storefront
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

export interface Banner {
    id: string;
    heading: string | null;
    subheading: string | null;
    button_text: string | null;
    button_link: string | null;
    image_url: string;
    display_order: number;
}

export function useBanners(storeId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.storefront.banners(storeId),
        queryFn: async (): Promise<Banner[]> => {
            if (!storeId) return [];

            try {
                // Query marketplace_banners table for active banners
                const { data, error } = await supabase
                    .from('marketplace_banners')
                    .select('id, heading, subheading, button_text, button_link, image_url, display_order')
                    .eq('store_id', storeId)
                    .eq('is_active', true)
                    .order('display_order', { ascending: true });

                if (error) {
                    logger.warn('Failed to fetch banners', error);
                    return [];
                }

                return (data || []) as Banner[];
            } catch (err) {
                logger.warn('Banners not available', err);
                return [];
            }
        },
        enabled: !!storeId,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    });
}
