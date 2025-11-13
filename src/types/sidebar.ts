/**
 * Sidebar Type Definitions
 * 
 * TypeScript interfaces and types for the Smart Adaptive Sidebar system
 */

import type { ReactNode } from 'react';
import type { Permission } from '@/lib/permissions/checkPermissions';
import type { SubscriptionTier } from '@/lib/featureConfig';

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

