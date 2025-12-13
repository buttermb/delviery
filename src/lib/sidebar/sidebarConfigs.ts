/**
 * Sidebar Configurations by Subscription Tier
 * 
 * Defines sidebar menu items organized by category.
 * Features are filtered by the user's subscription tier:
 * - Starter ($79): Core features for solo operators
 * - Professional ($150): Team & analytics for growing businesses
 * - Enterprise ($499): Full platform for large operations
 */

import type { SidebarSection } from '@/types/sidebar';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Warehouse,
  Barcode,
  AlertCircle,
  CreditCard,
  Wallet,
  Box,
  Settings,
  FileText,
  Building2,
  Truck,
  Mail,
  MapPin,
  Bell,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Star,
  Tag,
  Shield,
  FileSpreadsheet,
  Receipt,
  UserCog,
  ScrollText,
  Headphones,
  HelpCircle,
  Globe,
  Zap,
  Brain,
  Download,
  Store,
  MapPinned,
  FolderKanban,
  Key,
  Building,
  Flame,
  Menu,
  ArrowRightLeft,
  MessageSquare,
  Layers,
  Briefcase,
} from 'lucide-react';
import { FEATURES, type FeatureId, type SubscriptionTier } from '@/lib/featureConfig';

/**
 * Helper to create sidebar item from feature config
 */
function createItem(
  featureId: FeatureId,
  name: string,
  path: string,
  icon: React.ComponentType<{ className?: string }>,
  options?: {
    badge?: number | string;
    hot?: boolean;
    shortcut?: string;
  }
) {
  const feature = FEATURES[featureId];
  return {
    id: featureId,
    name,
    path,
    icon,
    featureId,
    minTier: feature?.tier || 'starter',
    badge: options?.badge,
    hot: options?.hot,
    shortcut: options?.shortcut,
  };
}

/**
 * STARTER TIER SIDEBAR ($79/mo)
 * Core features for solo operators and small crews
 */
export const STARTER_SIDEBAR: SidebarSection[] = [
  {
    section: 'Command Center',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('dashboard', 'Dashboard', '/admin/dashboard', LayoutDashboard, { shortcut: '⌘1' }),
      createItem('hotbox', 'Hotbox', '/admin/hotbox', Flame, { hot: true }),
    ],
  },
  {
    section: 'Sales & Orders',
    defaultExpanded: true,
    items: [
      createItem('basic-orders', 'Orders', '/admin/orders', ShoppingCart),
      createItem('disposable-menus', 'Menus', '/admin/disposable-menus', Menu),
    ],
  },
  {
    section: 'Inventory',
    items: [
      createItem('products', 'Inventory', '/admin/inventory-hub', Package),
    ],
  },
  {
    section: 'Customers',
    items: [
      createItem('customers', 'Customers', '/admin/customer-hub', Users),
    ],
  },
  {
    section: 'Operations',
    items: [
      createItem('suppliers', 'Suppliers', '/admin/suppliers', Building2),
    ],
  },
  {
    section: 'Analytics & Finance',
    items: [
      createItem('reports', 'Reports', '/admin/reports', FileSpreadsheet),
    ],
  },
  {
    section: 'Settings',
    collapsed: true,
    items: [
      createItem('settings', 'Settings', '/admin/settings', Settings),
      createItem('billing', 'Billing', '/admin/billing', CreditCard),
      createItem('help', 'Help', '/admin/help', HelpCircle),
    ],
  },
];

/**
 * PROFESSIONAL TIER SIDEBAR ($150/mo)
 * Team & analytics for growing businesses
 */
export const PROFESSIONAL_SIDEBAR: SidebarSection[] = [
  {
    section: 'Command Center',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('dashboard', 'Dashboard', '/admin/dashboard', LayoutDashboard, { shortcut: '⌘1' }),
      createItem('hotbox', 'Hotbox', '/admin/hotbox', Flame, { hot: true }),
      createItem('notifications', 'Notifications', '/admin/notifications', Bell),
    ],
  },
  {
    section: 'Sales & Orders',
    defaultExpanded: true,
    items: [
      createItem('basic-orders', 'Orders', '/admin/orders', ShoppingCart),
      createItem('disposable-menus', 'Menus', '/admin/disposable-menus', Menu),
      createItem('storefront', 'Storefront', '/admin/storefront-hub', Store),
      createItem('marketplace', 'Marketplace', '/admin/marketplace/dashboard', Globe),
    ],
  },
  {
    section: 'Inventory',
    items: [
      createItem('products', 'Inventory', '/admin/inventory-hub', Package),
      createItem('fronted-inventory', 'Who Owes Me', '/admin/fronted-inventory', CreditCard),
    ],
  },
  {
    section: 'Customers',
    items: [
      createItem('customers', 'Customers', '/admin/customer-hub', Users),
      createItem('marketing-automation', 'Marketing', '/admin/marketing-automation', Mail),
    ],
  },
  {
    section: 'Operations',
    items: [
      createItem('suppliers', 'Suppliers', '/admin/suppliers', Building2),
      createItem('team-members', 'Team', '/admin/staff-management', Users),
    ],
  },
  {
    section: 'Analytics & Finance',
    items: [
      createItem('analytics', 'Analytics', '/admin/analytics-hub', BarChart3),
      createItem('financial-center', 'Finance', '/admin/finance-hub', Briefcase),
    ],
  },
  {
    section: 'Integrations',
    collapsed: true,
    items: [
      createItem('bulk-operations', 'Bulk Operations', '/admin/integrations-hub', FolderKanban),
    ],
  },
  {
    section: 'Settings',
    collapsed: true,
    items: [
      createItem('settings', 'Settings', '/admin/settings', Settings),
      createItem('billing', 'Billing', '/admin/billing', CreditCard),
      createItem('help', 'Help', '/admin/help', HelpCircle),
    ],
  },
];

/**
 * ENTERPRISE TIER SIDEBAR ($499/mo)
 * Hub-based navigation with core features directly accessible
 */
export const ENTERPRISE_SIDEBAR: SidebarSection[] = [
  {
    section: 'Command Center',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('dashboard', 'Dashboard', '/admin/dashboard', LayoutDashboard, { shortcut: '⌘1' }),
      createItem('hotbox', 'Hotbox', '/admin/hotbox', Flame, { hot: true }),
      createItem('notifications', 'Notifications', '/admin/notifications', Bell),
    ],
  },
  {
    section: 'Sales & Orders',
    defaultExpanded: true,
    items: [
      createItem('disposable-menus', 'Menus', '/admin/disposable-menus', Menu),
      createItem('basic-orders', 'Orders', '/admin/orders-hub', ShoppingCart),
      createItem('wholesale-orders', 'Wholesale Orders', '/admin/wholesale-orders', Package),
      createItem('wholesale-clients', 'Wholesale Clients', '/admin/wholesale-clients', Briefcase),
      createItem('pos-system', 'POS', '/admin/pos-hub', Store),
    ],
  },
  {
    section: 'Inventory & Customers',
    items: [
      createItem('products', 'Inventory', '/admin/inventory-hub', Package),
      createItem('customers', 'Customers', '/admin/customer-hub', Users),
      createItem('storefront', 'Storefront', '/admin/storefront-hub', Store),
    ],
  },
  {
    section: 'Management',
    items: [
      createItem('team-members', 'Operations', '/admin/operations-hub', Building2),
      createItem('financial-center', 'Finance', '/admin/finance-hub', DollarSign),
    ],
  },
  {
    section: 'System',
    collapsed: true,
    items: [
      createItem('settings', 'Settings', '/admin/settings-hub', Settings),
      createItem('billing', 'Billing', '/admin/billing', CreditCard),
      createItem('help', 'Help', '/admin/help', HelpCircle),
    ],
  },
];


/**
 * Map feature IDs to sidebar item IDs for reverse lookup
 */
export const SIDEBAR_FEATURE_MAP: Record<string, FeatureId> = {
  'dashboard': 'dashboard',
  'hotbox': 'hotbox',
  'products': 'products',
  'inventory-dashboard': 'inventory-dashboard',
  'generate-barcodes': 'generate-barcodes',
  'advanced-inventory': 'advanced-inventory',
  'stock-alerts': 'stock-alerts',
  'inventory-transfers': 'inventory-transfers',
  'fronted-inventory': 'fronted-inventory',
  'returns': 'returns',
  'disposable-menus': 'disposable-menus',
  'basic-orders': 'basic-orders',
  'wholesale-orders': 'wholesale-orders',
  'storefront': 'storefront',
  'loyalty-program': 'loyalty-program',
  'coupons': 'coupons',
  'live-orders': 'live-orders',
  'order-analytics': 'order-analytics',
  'customers': 'customers',
  'customer-crm': 'customer-crm',
  'customer-analytics': 'customer-analytics',
  'customer-insights': 'customer-insights',
  'marketing-automation': 'marketing-automation',
  'reports': 'reports',
  'menu-analytics': 'menu-analytics',
  'sales-dashboard': 'sales-dashboard',
  'analytics': 'analytics',
  'advanced-reporting': 'advanced-reporting',
  'predictive-analytics': 'predictive-analytics',
  'advanced-analytics': 'advanced-analytics',
  'realtime-dashboard': 'realtime-dashboard',
  'custom-reports': 'custom-reports',
  'billing': 'billing',
  'suppliers': 'suppliers',
  'purchase-orders': 'purchase-orders',
  'invoice-management': 'invoice-management',
  'financial-center': 'financial-center',
  'commission-tracking': 'commission-tracking',
  'revenue-reports': 'revenue-reports',
  'delivery-management': 'delivery-management',
  'fleet-management': 'fleet-management',
  'live-map': 'live-map',
  'route-optimization': 'route-optimization',
  'delivery-analytics': 'delivery-analytics',
  'appointments': 'appointments',
  'pos-system': 'pos-system',
  'cash-register': 'cash-register',
  'pos-analytics': 'pos-analytics',
  'team-members': 'team-members',
  'role-management': 'role-management',
  'activity-logs': 'activity-logs',
  'locations': 'locations',
  'location-analytics': 'location-analytics',
  'user-management': 'user-management',
  'permissions': 'permissions',
  'bulk-operations': 'bulk-operations',
  'notifications': 'notifications',
  'ai': 'ai',
  'api-access': 'api-access',
  'webhooks': 'webhooks',
  'custom-integrations': 'custom-integrations',
  'automation': 'automation',
  'data-export': 'data-export',
  'quality-control': 'quality-control',
  'batch-recall': 'batch-recall',
  'compliance-vault': 'compliance-vault',
  'audit-trail': 'audit-trail',
  'compliance': 'compliance',
  'white-label': 'white-label',
  'custom-domain': 'custom-domain',
  'settings': 'settings',
  'support-tickets': 'support-tickets',
  'help': 'help',
  'priority-support': 'priority-support',
};

/**
 * Get sidebar config for subscription tier
 */
export function getSidebarConfigByTier(tier: SubscriptionTier): SidebarSection[] {
  switch (tier) {
    case 'starter':
      return STARTER_SIDEBAR;
    case 'professional':
      return PROFESSIONAL_SIDEBAR;
    case 'enterprise':
      return ENTERPRISE_SIDEBAR;
    default:
      return STARTER_SIDEBAR;
  }
}

/**
 * Legacy function - maps operation size to subscription tier
 * @deprecated Use getSidebarConfigByTier instead
 */
export function getSidebarConfig(size: 'street' | 'small' | 'medium' | 'enterprise'): SidebarSection[] {
  // Map operation sizes to subscription tiers
  switch (size) {
    case 'street':
    case 'small':
      return STARTER_SIDEBAR;
    case 'medium':
      return PROFESSIONAL_SIDEBAR;
    case 'enterprise':
      return ENTERPRISE_SIDEBAR;
    default:
      return STARTER_SIDEBAR;
  }
}

// Legacy exports for backwards compatibility
export const STREET_OPERATION_SIDEBAR = STARTER_SIDEBAR;
export const SMALL_BUSINESS_SIDEBAR = STARTER_SIDEBAR;
export const MEDIUM_BUSINESS_SIDEBAR = PROFESSIONAL_SIDEBAR;
