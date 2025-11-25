/**
 * Predefined sidebar layout presets
 */

import type { LayoutPreset } from '@/types/sidebar';
import { FEATURE_REGISTRY } from './featureRegistry';
import { logger } from '@/lib/logger';

export const LAYOUT_PRESETS: Record<string, LayoutPreset> = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'Standard layout with all features',
    visibleFeatures: 'all',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Only essential features for quick operations',
    visibleFeatures: [
      'dashboard',
      'products',
      'customer-crm',
      'basic-orders',
      'billing',
      'settings',
    ],
  },
  sales_focus: {
    id: 'sales_focus',
    name: 'Sales Focus',
    description: 'Optimized for sales and customer management',
    visibleFeatures: [
      'dashboard',
      'customer-crm',
      'basic-orders',
      'disposable-menus',
      'pos-system',
      'sales-dashboard',
      'customer-insights',
      'fronted-inventory',
      'reports',
      'loyalty-program',
      'marketing-automation',
    ],
  },
  operations_focus: {
    id: 'operations_focus',
    name: 'Operations Focus',
    description: 'Inventory, logistics, and fulfillment',
    visibleFeatures: [
      'dashboard',
      'products',
      'inventory-dashboard',
      'stock-alerts',
      'locations',
      'delivery-management',
      'live-map',
      'team-members',
      'bulk-operations',
      'quality-control',
    ],
  },
  financial_focus: {
    id: 'financial_focus',
    name: 'Financial Focus',
    description: 'Accounting, billing, and financial reports',
    visibleFeatures: [
      'dashboard',
      'billing',
      'reports',
      'revenue-reports',
      'pos-system',
      'cash-register',
      'fronted-inventory',
      'invoice-management',
    ],
  },
  full_featured: {
    id: 'full_featured',
    name: 'Full Featured',
    description: 'All features enabled for power users',
    visibleFeatures: 'all',
  },
};

/**
 * Validate that all features in a preset exist in the registry
 */
function validatePresetFeatures(presetId: string, features: string[] | 'all'): string[] | 'all' {
  if (features === 'all') return 'all';

  const validFeatures = features.filter(id => {
    const exists = !!FEATURE_REGISTRY[id];
    if (!exists) {
      logger.warn(`Invalid feature ID in preset ${presetId}: ${id}`, { component: 'layoutPresets' });
    }
    return exists;
  });

  return validFeatures;
}

/**
 * Get all available presets
 */
export function getLayoutPresets(): LayoutPreset[] {
  return Object.values(LAYOUT_PRESETS);
}

/**
 * Get preset by ID
 */
export function getLayoutPreset(id: string): LayoutPreset | undefined {
  return LAYOUT_PRESETS[id];
}

/**
 * Apply a preset to get list of visible features
 */
export function applyLayoutPreset(presetId: string): string[] | 'all' {
  const preset = LAYOUT_PRESETS[presetId];
  if (!preset) return 'all';

  return validatePresetFeatures(presetId, preset.visibleFeatures);
}
