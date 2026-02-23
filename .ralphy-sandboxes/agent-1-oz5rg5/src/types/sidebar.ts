/**
 * Sidebar Type Definitions
 * 
 * TypeScript interfaces and types for the Smart Adaptive Sidebar system
 */

import type { Permission } from '@/lib/permissions/rolePermissions';
import type { SubscriptionTier } from '@/lib/featureConfig';

export type { Permission };

/**
 * Operation size classification
 */
export type OperationSize = 'street' | 'small' | 'medium' | 'enterprise';

/**
 * Priority level for hot items
 */
export type HotItemPriority = 'urgent' | 'high' | 'normal';

/**
 * Sidebar menu item interface
 */
export interface SidebarItem {
  /** Unique identifier for the item */
  id: string;
  /** Display name */
  name: string;
  /** Route path */
  path: string;
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Badge count or text (optional) */
  badge?: number | string;
  /** Whether this is a hot/contextual item */
  hot?: boolean;
  /** Keyboard shortcut (e.g., "⌘1") */
  shortcut?: string;
  /** Required permissions (optional) */
  permissions?: Permission[];
  /** Minimum subscription tier required */
  minTier?: SubscriptionTier;
  /** Nested submenu items (optional) */
  submenu?: SidebarItem[];
  /** Feature ID for feature access checking */
  featureId?: string;
  /** Feature toggle key — when set, item is only visible if the toggle is enabled */
  featureFlag?: string;
}

/**
 * Sidebar section interface
 */
export interface SidebarSection {
  /** Section label */
  section: string;
  /** Items in this section */
  items: SidebarItem[];
  /** Whether section is pinned (always expanded) */
  pinned?: boolean;
  /** Whether section is expanded by default */
  defaultExpanded?: boolean;
  /** Whether section is collapsed */
  collapsed?: boolean;
  /** Required permissions for entire section (optional) */
  permissions?: Permission[];
  /** Minimum subscription tier for entire section */
  minTier?: SubscriptionTier;
}

/**
 * Custom section created by user
 */
export interface CustomSection {
  id: string;
  name: string;
  items: string[]; // Array of item IDs
  order: number;
}

/**
 * Custom menu item created by user
 */
export interface CustomMenuItem {
  id: string;
  name: string;
  url: string;
  icon: string; // Icon name
  permissions?: Permission[];
  openInNewTab?: boolean;
}

/**
 * Sidebar behavior settings
 */
export interface SidebarBehavior {
  autoCollapse: boolean;
  iconOnly: boolean;
  showTooltips: boolean;
}

/**
 * Custom preset created by user
 */
export interface CustomPreset {
  id: string;
  name: string;
  visibleFeatures: string[];
}

/**
 * Sidebar preferences stored in database
 */
export interface SidebarPreferences {
  /** User's operation size preference */
  operationSize: OperationSize | null;
  /** Whether user has customized layout */
  customLayout: boolean;
  /** Array of favorite feature IDs */
  favorites: string[];
  /** Array of collapsed section names */
  collapsedSections: string[];
  /** Array of pinned item IDs */
  pinnedItems: string[];
  /** Last accessed features with timestamps */
  lastAccessedFeatures: Array<{
    id: string;
    timestamp: number;
  }>;
  /** Array of hidden feature IDs */
  hiddenFeatures?: string[];
  /** Custom order of sections */
  sectionOrder?: string[];
  /** User-created custom sections */
  customSections?: CustomSection[];
  /** Enabled integrations */
  enabledIntegrations?: string[];
  /** Custom menu items */
  customMenuItems?: CustomMenuItem[];
  /** Selected layout preset */
  layoutPreset?: string;
  /** Sidebar behavior settings */
  sidebarBehavior?: SidebarBehavior;
  /** User-created custom presets */
  customPresets?: CustomPreset[];
}

/**
 * Hot item for contextual quick actions
 */
export interface HotItem {
  /** Item identifier */
  id: string;
  /** Display name */
  name: string;
  /** Route path */
  path: string;
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Priority level */
  priority: HotItemPriority;
  /** Badge count (optional) */
  badge?: number | string;
  /** Feature ID */
  featureId?: string;
}

/**
 * Business context for hot items generation
 */
export interface BusinessContext {
  /** Number of low stock items */
  lowStock?: number;
  /** Number of pending orders */
  pendingOrders?: number;
  /** Number of active drivers */
  activeDrivers?: number;
  /** Current hour (0-23) */
  timeOfDay?: number;
  /** Current day of week (0-6, 0 = Sunday) */
  dayOfWeek?: number;
  /** Last user action */
  lastAction?: string;
  /** Credit owed amount */
  creditOwed?: number;
  /** Fronted inventory total */
  frontedTotal?: number;
}

/**
 * Operation profile for size detection
 */
export interface OperationProfile {
  /** Detected operation size */
  size: OperationSize;
  /** Monthly order count */
  monthlyOrders: number;
  /** Product count */
  productCount: number;
  /** Team size */
  teamSize: number;
  /** Location count */
  locationCount: number;
  /** Enabled features */
  features: string[];
}

/**
 * Integration definition
 */
export interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  featuresEnabled: string[];
  setupUrl: string;
  connected: boolean;
}

/**
 * Layout preset definition
 */
export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  visibleFeatures: string[] | 'all';
  sectionOrder?: string[];
}

