/**
 * Predefined sidebar layout presets
 */

import type { LayoutPreset } from '@/types/sidebar';

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
      'customers',
      'orders',
      'settings',
    ],
  },
  sales_focus: {
    id: 'sales_focus',
    name: 'Sales Focus',
    description: 'Optimized for sales and customer management',
    visibleFeatures: [
      'dashboard',
      'customers',
      'orders',
      'disposable-menus',
      'marketing',
      'analytics',
      'customer-portal',
      'loyalty-program',
    ],
  },
  operations_focus: {
    id: 'operations_focus',
    name: 'Operations Focus',
    description: 'Inventory, logistics, and fulfillment',
    visibleFeatures: [
      'dashboard',
      'products',
      'inventory',
      'warehouse',
      'logistics',
      'runners',
      'route-planning',
      'driver-tracking',
      'live-map',
    ],
  },
  financial_focus: {
    id: 'financial_focus',
    name: 'Financial Focus',
    description: 'Accounting, billing, and financial reports',
    visibleFeatures: [
      'dashboard',
      'billing',
      'invoices',
      'reports',
      'analytics',
      'accounting',
      'taxes',
      'subscriptions',
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
  return preset.visibleFeatures;
}
