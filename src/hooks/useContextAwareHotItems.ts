/**
 * Context-Aware Hot Items Hook
 *
 * Provides products tailored to the current time of day:
 * - Morning (6am-12pm): Energizing sativas, focus strains
 * - Afternoon (12pm-5pm): Balanced hybrids, productivity strains
 * - Evening (5pm-9pm): Relaxing indicas, wind-down strains
 * - Night (9pm-6am): Sleep aids, heavy indicas
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { MarketplaceProduct } from '@/components/shop/StorefrontProductCard';
import type {
  StorefrontContext,
  HotItemConfig,
  StorefrontHotItem,
  TimePeriod,
  ContextAwareHotItemsResult,
} from '@/types/storefront-hot-items';

/**
 * Configuration for each time period
 */
const TIME_PERIOD_CONFIGS: Record<TimePeriod, HotItemConfig> = {
  morning: {
    timePeriod: 'morning',
    title: 'Rise & Shine Picks',
    subtitle: 'Energizing strains to start your day right',
    icon: 'sun',
    priorityCategories: ['Flower', 'Vapes', 'Pre-Rolls'],
    priorityStrains: ['Sativa', 'Hybrid'],
    priorityEffects: ['Energetic', 'Creative', 'Focused', 'Uplifted', 'Happy'],
    badge: 'Morning Pick',
    accentColor: '#f59e0b', // amber
  },
  afternoon: {
    timePeriod: 'afternoon',
    title: 'Midday Favorites',
    subtitle: 'Balanced options for your afternoon',
    icon: 'zap',
    priorityCategories: ['Flower', 'Edibles', 'Vapes'],
    priorityStrains: ['Hybrid', 'Sativa'],
    priorityEffects: ['Balanced', 'Creative', 'Social', 'Giggly', 'Talkative'],
    badge: 'Afternoon Fave',
    accentColor: '#06b6d4', // cyan
  },
  evening: {
    timePeriod: 'evening',
    title: 'Evening Essentials',
    subtitle: 'Wind down with these relaxing picks',
    icon: 'moon',
    priorityCategories: ['Flower', 'Edibles', 'Pre-Rolls', 'Tinctures'],
    priorityStrains: ['Indica', 'Hybrid'],
    priorityEffects: ['Relaxed', 'Calm', 'Hungry', 'Sleepy', 'Euphoric'],
    badge: 'Evening Pick',
    accentColor: '#8b5cf6', // violet
  },
  night: {
    timePeriod: 'night',
    title: 'Late Night Selection',
    subtitle: 'Deep relaxation for restful nights',
    icon: 'sparkles',
    priorityCategories: ['Flower', 'Edibles', 'Tinctures'],
    priorityStrains: ['Indica'],
    priorityEffects: ['Sleepy', 'Relaxed', 'Calm', 'Sedated'],
    badge: 'Night Owl',
    accentColor: '#6366f1', // indigo
  },
};

/**
 * Determine the current time period based on hour
 */
function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Get the current storefront context
 */
function getStorefrontContext(): StorefrontContext {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  return {
    hour,
    dayOfWeek,
    timePeriod: getTimePeriod(hour),
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
  };
}

/**
 * Calculate match score for a product based on current config
 */
function calculateMatchScore(
  product: MarketplaceProduct,
  config: HotItemConfig
): number {
  let score = 0;

  // Category match (highest priority)
  if (config.priorityCategories.some(
    (cat) => product.category?.toLowerCase() === cat.toLowerCase()
  )) {
    score += 30;
  }

  // Strain type match
  if (config.priorityStrains.some(
    (strain) => product.strain_type?.toLowerCase() === strain.toLowerCase()
  )) {
    score += 25;
  }

  // Effects match (if product has effects)
  if (product.effects && product.effects.length > 0) {
    const matchingEffects = product.effects.filter((effect) =>
      config.priorityEffects.some(
        (pe) => effect.toLowerCase().includes(pe.toLowerCase())
      )
    );
    score += matchingEffects.length * 10;
  }

  // Boost high-THC products for morning/afternoon (energy)
  if (
    (config.timePeriod === 'morning' || config.timePeriod === 'afternoon') &&
    product.thc_content &&
    product.thc_content >= 20
  ) {
    score += 10;
  }

  // Boost high-CBD products for evening/night (relaxation)
  if (
    (config.timePeriod === 'evening' || config.timePeriod === 'night') &&
    product.cbd_content &&
    product.cbd_content >= 5
  ) {
    score += 15;
  }

  // Boost products with images (better UX)
  if (product.image_url) {
    score += 5;
  }

  // Boost in-stock items
  if (product.stock_quantity && product.stock_quantity > 0) {
    score += 5;
  }

  // Penalize out-of-stock items heavily
  if (product.stock_quantity !== undefined && product.stock_quantity <= 0) {
    score -= 100;
  }

  return score;
}

/**
 * Get reason why this product is hot for the current time
 */
function getHotReason(
  product: MarketplaceProduct,
  config: HotItemConfig
): string {
  // Check strain match first
  if (config.priorityStrains.includes(product.strain_type || '')) {
    if (config.timePeriod === 'morning') {
      return 'Great for morning energy';
    }
    if (config.timePeriod === 'afternoon') {
      return 'Perfect afternoon balance';
    }
    if (config.timePeriod === 'evening') {
      return 'Ideal for winding down';
    }
    if (config.timePeriod === 'night') {
      return 'Perfect for restful nights';
    }
  }

  // Check effects match
  if (product.effects && product.effects.length > 0) {
    const matchingEffect = product.effects.find((effect) =>
      config.priorityEffects.some((pe) =>
        effect.toLowerCase().includes(pe.toLowerCase())
      )
    );
    if (matchingEffect) {
      return `Known for ${matchingEffect.toLowerCase()} effects`;
    }
  }

  // Default based on time period
  switch (config.timePeriod) {
    case 'morning':
      return 'Popular morning choice';
    case 'afternoon':
      return 'Afternoon favorite';
    case 'evening':
      return 'Evening essential';
    case 'night':
      return 'Late night favorite';
    default:
      return 'Trending now';
  }
}

interface UseContextAwareHotItemsOptions {
  storeId?: string;
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook for getting context-aware hot items
 */
export function useContextAwareHotItems({
  storeId,
  limit = 8,
  enabled = true,
}: UseContextAwareHotItemsOptions): ContextAwareHotItemsResult {
  // Get current context (recalculates on each render, but memoized below)
  const context = useMemo(() => getStorefrontContext(), []);
  const config = TIME_PERIOD_CONFIGS[context.timePeriod];

  // Fetch products from the store
  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [...queryKeys.shopProducts.list(storeId), 'hot-items', context.timePeriod],
    queryFn: async () => {
      if (!storeId || storeId.length < 32) return [];
      try {
        const { data, error: fetchError } = await supabase.rpc(
          'get_marketplace_products',
          { p_store_id: storeId }
        );
        if (fetchError) {
          logger.error('Failed to fetch products for hot items', fetchError);
          return [];
        }
        return (data as unknown as MarketplaceProduct[]) || [];
      } catch (err) {
        logger.error('Error fetching products for hot items', err);
        return [];
      }
    },
    enabled: enabled && !!storeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  // Score and sort products based on current context
  const hotItems = useMemo((): StorefrontHotItem[] => {
    if (!products.length) return [];

    // Only consider visible, in-stock products
    const eligibleProducts = products.filter(
      (p) => p.is_visible && (p.stock_quantity === undefined || p.stock_quantity > 0)
    );

    // Score each product
    const scoredProducts = eligibleProducts.map((product) => ({
      ...product,
      matchScore: calculateMatchScore(product, config),
      hotReason: getHotReason(product, config),
      timeBadge: config.badge,
    }));

    // Sort by score (descending) and take top items
    return scoredProducts
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }, [products, config, limit]);

  return {
    items: hotItems,
    context,
    config,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Get the time period config without fetching products
 * Useful for UI elements that just need the current context info
 */
export function useCurrentTimeContext(): {
  context: StorefrontContext;
  config: HotItemConfig;
} {
  const context = useMemo(() => getStorefrontContext(), []);
  const config = TIME_PERIOD_CONFIGS[context.timePeriod];

  return { context, config };
}

// Export configs for use in other components
export { TIME_PERIOD_CONFIGS, getTimePeriod, getStorefrontContext };
