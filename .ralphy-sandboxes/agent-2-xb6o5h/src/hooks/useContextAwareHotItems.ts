/**
 * Context-Aware Hot Items Hook
 *
 * Provides products tailored to the current time of day and day of week:
 *
 * Weekday recommendations:
 * - Morning (6am-12pm): Energizing sativas, focus strains
 * - Afternoon (12pm-5pm): Balanced hybrids, productivity strains
 * - Evening (5pm-9pm): Relaxing indicas, wind-down strains
 * - Night (9pm-6am): Sleep aids, heavy indicas
 *
 * Weekend recommendations (adjusted for leisure):
 * - Morning (6am-12pm): Gentle wake-up, social strains
 * - Afternoon (12pm-5pm): Social hybrids, party strains
 * - Evening (5pm-9pm): Relaxing indica-leaning hybrids
 * - Night (9pm-6am): Deep relaxation, sleep aids
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
 * Configuration for weekday time periods
 */
const WEEKDAY_CONFIGS: Record<TimePeriod, HotItemConfig> = {
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
 * Configuration for weekend time periods
 * More relaxed and social-focused recommendations
 */
const WEEKEND_CONFIGS: Record<TimePeriod, HotItemConfig> = {
  morning: {
    timePeriod: 'morning',
    title: 'Weekend Wake & Bake',
    subtitle: 'Gentle morning picks for a relaxed start',
    icon: 'coffee',
    priorityCategories: ['Flower', 'Edibles', 'Pre-Rolls'],
    priorityStrains: ['Hybrid', 'Sativa'],
    priorityEffects: ['Happy', 'Relaxed', 'Creative', 'Euphoric', 'Giggly'],
    badge: 'Weekend Fave',
    accentColor: '#10b981', // emerald
  },
  afternoon: {
    timePeriod: 'afternoon',
    title: 'Weekend Social Picks',
    subtitle: 'Perfect for hanging with friends',
    icon: 'star',
    priorityCategories: ['Flower', 'Vapes', 'Pre-Rolls', 'Edibles'],
    priorityStrains: ['Hybrid', 'Sativa'],
    priorityEffects: ['Social', 'Giggly', 'Talkative', 'Happy', 'Euphoric'],
    badge: 'Party Pick',
    accentColor: '#f97316', // orange
  },
  evening: {
    timePeriod: 'evening',
    title: 'Weekend Unwind',
    subtitle: 'Chill vibes for your evening',
    icon: 'moon',
    priorityCategories: ['Flower', 'Edibles', 'Pre-Rolls', 'Tinctures'],
    priorityStrains: ['Hybrid', 'Indica'],
    priorityEffects: ['Relaxed', 'Euphoric', 'Hungry', 'Happy', 'Sleepy'],
    badge: 'Chill Pick',
    accentColor: '#a855f7', // purple
  },
  night: {
    timePeriod: 'night',
    title: 'Saturday Night Special',
    subtitle: 'Deep relaxation for the weekend',
    icon: 'sparkles',
    priorityCategories: ['Flower', 'Edibles', 'Tinctures'],
    priorityStrains: ['Indica'],
    priorityEffects: ['Sleepy', 'Relaxed', 'Calm', 'Sedated', 'Euphoric'],
    badge: 'Weekend Night',
    accentColor: '#6366f1', // indigo
  },
};

/**
 * Get the appropriate config based on time period and day type
 */
function getTimeConfig(timePeriod: TimePeriod, isWeekend: boolean): HotItemConfig {
  return isWeekend ? WEEKEND_CONFIGS[timePeriod] : WEEKDAY_CONFIGS[timePeriod];
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getTimeConfig with isWeekend parameter instead
 */
const TIME_PERIOD_CONFIGS = WEEKDAY_CONFIGS;

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
 * Calculate match score for a product based on current config and context
 */
function calculateMatchScore(
  product: MarketplaceProduct,
  config: HotItemConfig,
  context: StorefrontContext
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

  // Weekend-specific boosts
  if (context.isWeekend) {
    // Boost edibles on weekends (more leisure time for onset)
    if (product.category?.toLowerCase() === 'edibles') {
      score += 15;
    }

    // Boost social strains on weekend afternoons
    if (config.timePeriod === 'afternoon' && product.effects) {
      const socialEffects = ['Social', 'Giggly', 'Talkative', 'Happy'];
      const hasSocialEffect = product.effects.some((effect) =>
        socialEffects.some((se) => effect.toLowerCase().includes(se.toLowerCase()))
      );
      if (hasSocialEffect) {
        score += 10;
      }
    }

    // Boost balanced hybrids on weekend mornings (relaxed wake-up)
    if (config.timePeriod === 'morning' && product.strain_type?.toLowerCase() === 'hybrid') {
      score += 8;
    }
  } else {
    // Weekday-specific boosts
    // Boost vapes on weekday mornings/afternoons (quick, discreet)
    if (
      (config.timePeriod === 'morning' || config.timePeriod === 'afternoon') &&
      product.category?.toLowerCase() === 'vapes'
    ) {
      score += 8;
    }

    // Boost focused effects on weekday mornings
    if (config.timePeriod === 'morning' && product.effects) {
      const focusEffects = ['Focused', 'Energetic', 'Creative'];
      const hasFocusEffect = product.effects.some((effect) =>
        focusEffects.some((fe) => effect.toLowerCase().includes(fe.toLowerCase()))
      );
      if (hasFocusEffect) {
        score += 8;
      }
    }
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
 * Get reason why this product is hot for the current time and day
 */
function getHotReason(
  product: MarketplaceProduct,
  config: HotItemConfig,
  context: StorefrontContext
): string {
  // Weekend-specific reasons
  if (context.isWeekend) {
    // Check for social/party strains on weekend afternoons
    if (config.timePeriod === 'afternoon' && product.effects) {
      const socialEffects = ['Social', 'Giggly', 'Talkative'];
      const matchingSocial = product.effects.find((effect) =>
        socialEffects.some((se) => effect.toLowerCase().includes(se.toLowerCase()))
      );
      if (matchingSocial) {
        return `Great for weekend hangouts`;
      }
    }

    // Weekend morning chill
    if (config.timePeriod === 'morning' && product.strain_type?.toLowerCase() === 'hybrid') {
      return 'Perfect for a lazy weekend morning';
    }

    // Edibles recommendation on weekend
    if (product.category?.toLowerCase() === 'edibles') {
      return 'Take your time this weekend';
    }
  }

  // Check strain match
  if (config.priorityStrains.some(
    (strain) => product.strain_type?.toLowerCase() === strain.toLowerCase()
  )) {
    if (context.isWeekend) {
      switch (config.timePeriod) {
        case 'morning':
          return 'Weekend wake-up favorite';
        case 'afternoon':
          return 'Perfect for weekend vibes';
        case 'evening':
          return 'Unwind your weekend night';
        case 'night':
          return 'Drift off after a great weekend';
      }
    } else {
      switch (config.timePeriod) {
        case 'morning':
          return 'Great for morning energy';
        case 'afternoon':
          return 'Perfect afternoon balance';
        case 'evening':
          return 'Ideal for winding down';
        case 'night':
          return 'Perfect for restful nights';
      }
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

  // Default based on time period and day type
  if (context.isWeekend) {
    switch (config.timePeriod) {
      case 'morning':
        return 'Weekend morning pick';
      case 'afternoon':
        return 'Saturday/Sunday favorite';
      case 'evening':
        return 'Weekend wind-down';
      case 'night':
        return 'Weekend late night choice';
      default:
        return 'Weekend favorite';
    }
  }

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
  // Use weekend-aware config based on context
  const config = useMemo(() => getTimeConfig(context.timePeriod, context.isWeekend), [context.timePeriod, context.isWeekend]);

  // Fetch products from the store
  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    // Include isWeekend in query key for proper cache separation
    queryKey: [...queryKeys.shopProducts.list(storeId), 'hot-items', context.timePeriod, context.isWeekend],
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

  // Score and sort products based on current context (time of day + weekend/weekday)
  const hotItems = useMemo((): StorefrontHotItem[] => {
    if (!products.length) return [];

    // Only consider visible, in-stock products
    const eligibleProducts = products.filter(
      (p) => p.is_visible && (p.stock_quantity === undefined || p.stock_quantity > 0)
    );

    // Score each product based on time of day and weekend/weekday context
    const scoredProducts = eligibleProducts.map((product) => ({
      ...product,
      matchScore: calculateMatchScore(product, config, context),
      hotReason: getHotReason(product, config, context),
      timeBadge: config.badge,
    }));

    // Sort by score (descending) and take top items
    return scoredProducts
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }, [products, config, context, limit]);

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
 * Returns weekend-aware configuration
 */
export function useCurrentTimeContext(): {
  context: StorefrontContext;
  config: HotItemConfig;
} {
  const context = useMemo(() => getStorefrontContext(), []);
  const config = useMemo(
    () => getTimeConfig(context.timePeriod, context.isWeekend),
    [context.timePeriod, context.isWeekend]
  );

  return { context, config };
}

// Export configs for use in other components
export {
  TIME_PERIOD_CONFIGS,
  WEEKDAY_CONFIGS,
  WEEKEND_CONFIGS,
  getTimePeriod,
  getStorefrontContext,
  getTimeConfig,
};
