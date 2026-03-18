/**
 * Storefront Hot Items Type Definitions
 *
 * Types for context-aware hot items that change based on time of day
 * and other contextual factors in the storefront.
 */

import type { MarketplaceProduct } from '@/components/shop/StorefrontProductCard';

/**
 * Time period categories for contextual product display
 */
export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Context for determining which hot items to show
 */
export interface StorefrontContext {
  /** Current hour (0-23) */
  hour: number;
  /** Current day of week (0-6, 0 = Sunday) */
  dayOfWeek: number;
  /** Current time period */
  timePeriod: TimePeriod;
  /** Whether it's a weekend */
  isWeekend: boolean;
}

/**
 * Hot item configuration for a time period
 */
export interface HotItemConfig {
  /** Time period this config applies to */
  timePeriod: TimePeriod;
  /** Display title for the section */
  title: string;
  /** Subtitle/description */
  subtitle: string;
  /** Icon name to display */
  icon: 'sun' | 'coffee' | 'moon' | 'sparkles' | 'zap' | 'star';
  /** Categories to prioritize */
  priorityCategories: string[];
  /** Strain types to prioritize */
  priorityStrains: string[];
  /** Effects to prioritize (if available) */
  priorityEffects: string[];
  /** Badge text to show on products */
  badge: string;
  /** Accent color for the section */
  accentColor: string;
}

/**
 * Hot item with context metadata
 */
export interface StorefrontHotItem extends MarketplaceProduct {
  /** Why this item is "hot" */
  hotReason: string;
  /** Match score for sorting */
  matchScore: number;
  /** Time-based badge */
  timeBadge?: string;
}

/**
 * Result from the useContextAwareHotItems hook
 */
export interface ContextAwareHotItemsResult {
  /** Hot items for current context */
  items: StorefrontHotItem[];
  /** Current context information */
  context: StorefrontContext;
  /** Current config being used */
  config: HotItemConfig;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}
