/**
 * Feature Mapping — bridges toggle keys (snake_case) to featureConfig IDs (kebab-case).
 *
 * The two systems evolved independently:
 *   - Feature Toggles: `tenants.feature_toggles` JSONB (`pos`, `live_map`, etc.)
 *   - Subscription Tiers: `featureConfig.ts` IDs (`pos-system`, `live-map`, etc.)
 *
 * This module provides explicit, compile-time-checked mappings between them.
 */

import type { FeatureToggleKey } from '@/lib/featureFlags';
import type { FeatureId } from '@/lib/featureConfig';

/**
 * Maps each feature toggle key to the corresponding featureConfig ID.
 * Not every toggle has a featureConfig counterpart (core toggles like
 * `orders`, `products` map to starter-tier features that are always on).
 */
export const TOGGLE_TO_FEATURE_MAP: Record<FeatureToggleKey, FeatureId | null> = {
  // Core toggles (always on) → starter-tier features
  orders: 'basic-orders',
  products: 'products',
  menus: 'disposable-menus',
  invoices: 'crm-invoices',
  customers: 'customers',
  storefront: 'storefront',
  inventory: 'inventory-dashboard',

  // Advanced toggles → tier-gated features
  pos: 'pos-system',
  crm_advanced: 'customer-crm',
  delivery_tracking: 'delivery-tracking',
  live_map: 'live-map',
  courier_portal: 'couriers',
  analytics_advanced: 'analytics',
  marketing_hub: 'marketing-automation',
  purchase_orders: 'purchase-orders',
  quality_control: 'quality-control',
  credits_system: 'collections',
  live_chat: 'live-chat',
  fleet_management: 'fleet-management',
  vendor_management: 'vendor-management',
  storefront_builder_advanced: 'storefront-builder',
} satisfies Record<FeatureToggleKey, FeatureId | null>;

/**
 * Reverse map: featureConfig ID → toggle key (only for features that have a toggle).
 */
export const FEATURE_TO_TOGGLE_MAP: Partial<Record<FeatureId, FeatureToggleKey>> =
  Object.entries(TOGGLE_TO_FEATURE_MAP).reduce(
    (acc, [toggleKey, featureId]) => {
      if (featureId) {
        acc[featureId] = toggleKey as FeatureToggleKey;
      }
      return acc;
    },
    {} as Partial<Record<FeatureId, FeatureToggleKey>>,
  );

/**
 * Check whether a featureConfig ID has an associated toggle.
 */
export function hasToggle(featureId: FeatureId): boolean {
  return featureId in FEATURE_TO_TOGGLE_MAP;
}

/**
 * Get the toggle key for a featureConfig ID, or null if none exists.
 */
export function getToggleKey(featureId: FeatureId): FeatureToggleKey | null {
  return FEATURE_TO_TOGGLE_MAP[featureId] ?? null;
}
