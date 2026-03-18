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
  Star,
  Tag,
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
    featureFlag?: string;
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
    featureFlag: options?.featureFlag,
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
      createItem('suppliers', 'Suppliers', '/admin/operations-hub', Building2),
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
      createItem('billing', 'Billing', '/admin/settings?tab=payments', CreditCard),
      createItem('help', 'Help', '/admin/help-hub', HelpCircle),
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
      createItem('storefront', 'Builder', '/admin/storefront-hub?tab=builder', Layers),
      createItem('storefront', 'Store Settings', '/admin/storefront-hub?tab=settings', Settings),
      createItem('storefront', 'Live Orders', '/admin/storefront-hub?tab=live', Activity),
      createItem('storefront', 'Store Analytics', '/admin/storefront-hub?tab=analytics', BarChart3),
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
      createItem('customers', 'All Customers', '/admin/customer-hub', Users),
      createItem('marketing-automation', 'Marketing', '/admin/marketing-hub', Mail, { featureFlag: 'marketing_hub' }),
      createItem('storefront', 'Reviews', '/admin/storefront-hub?tab=reviews', MessageSquare),
    ],
  },
  {
    section: 'Operations',
    items: [
      createItem('suppliers', 'Suppliers', '/admin/operations-hub', Building2),
      createItem('team-members', 'Team', '/admin/team-members', Users),
    ],
  },
  {
    section: 'Analytics & Finance',
    items: [
      createItem('analytics', 'Analytics', '/admin/analytics-hub', BarChart3, { featureFlag: 'analytics_advanced' }),
      createItem('financial-center', 'Finance', '/admin/finance-hub', Briefcase),
    ],
  },
  {
    section: 'Integrations',
    collapsed: true,
    items: [
      createItem('bulk-operations', 'Bulk Operations', '/admin/settings-hub?tab=integrations', FolderKanban),
    ],
  },
  {
    section: 'Settings',
    collapsed: true,
    items: [
      createItem('settings', 'Settings', '/admin/settings', Settings),
      createItem('billing', 'Billing', '/admin/settings?tab=payments', CreditCard),
      createItem('help', 'Help', '/admin/help-hub', HelpCircle),
    ],
  },
];

/**
 * ENTERPRISE TIER SIDEBAR ($499/mo)
 * Full feature access organized into 12 logical sections
 */
export const ENTERPRISE_SIDEBAR: SidebarSection[] = [
  // ==========================================================================
  // 1. COMMAND CENTER (5 items - pinned for quick access)
  // ==========================================================================
  {
    section: 'Command Center',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('dashboard', 'Dashboard', '/admin/dashboard', LayoutDashboard, { shortcut: '⌘1' }),
      createItem('hotbox', 'Hotbox', '/admin/hotbox', Flame, { hot: true }),
      createItem('live-orders', 'Live Orders', '/admin/orders?tab=live', Activity),
      createItem('pos-system', 'POS', '/admin/pos-system', CreditCard, { featureFlag: 'pos' }),
      createItem('live-map', 'Live Map', '/admin/live-map', MapPinned, { featureFlag: 'live_map' }),
    ],
  },
  // ==========================================================================
  // 2. ORDERS (4 items)
  // ==========================================================================
  {
    section: 'Orders',
    defaultExpanded: true,
    items: [
      createItem('basic-orders', 'All Orders', '/admin/orders', ShoppingCart),
      createItem('wholesale-orders', 'B2B Orders', '/admin/orders?tab=wholesale', Building),
      createItem('storefront', 'Store Orders', '/admin/orders?tab=storefront', Store),
    ],
  },
  // ==========================================================================
  // 3. INVENTORY (5 items)
  // ==========================================================================
  {
    section: 'Inventory',
    items: [
      createItem('products', 'Products', '/admin/inventory-hub', Package),
      createItem('disposable-menus', 'Menus', '/admin/inventory-hub?tab=menus', Menu),
      createItem('inventory-dashboard', 'Stock Levels', '/admin/inventory-hub?tab=stock', Warehouse),
      createItem('stock-alerts', 'Alerts', '/admin/inventory-hub?tab=monitoring', AlertCircle),
      createItem('inventory-transfers', 'Transfers', '/admin/inventory-hub?tab=adjustments', ArrowRightLeft),
      createItem('generate-barcodes', 'Barcodes', '/admin/inventory-hub?tab=barcodes', Barcode),
    ],
  },
  // ==========================================================================
  // 4. CUSTOMERS (4 items)
  // ==========================================================================
  {
    section: 'Customers',
    items: [
      createItem('customers', 'All Customers', '/admin/customer-hub', Users),
      createItem('customer-crm', 'CRM', '/admin/customer-hub?tab=crm', Briefcase, { featureFlag: 'crm_advanced' }),
      createItem('crm-invoices', 'Invoices', '/admin/customer-hub?tab=invoices', Receipt),
      createItem('support-tickets', 'Support', '/admin/customer-hub?tab=support', Layers),
      createItem('loyalty-program', 'Loyalty', '/admin/customer-hub?tab=loyalty', Star, { featureFlag: 'marketing_hub' }),
      createItem('customer-analytics', 'Analytics', '/admin/customer-hub?tab=analytics', PieChart, { featureFlag: 'crm_advanced' }),
    ],
  },
  // ==========================================================================
  // 5. FINANCE (5 items) - Moved up for priority
  // ==========================================================================
  {
    section: 'Finance',
    items: [
      createItem('financial-center', 'Dashboard', '/admin/finance-hub', DollarSign),
      createItem('revenue-reports', 'Revenue', '/admin/finance-hub?tab=revenue', TrendingUp),
      createItem('expense-tracking', 'Expenses', '/admin/finance-hub?tab=expenses', Wallet),
      createItem('invoice-management', 'Invoices', '/admin/finance-hub?tab=invoices', FileSpreadsheet),
      createItem('commission-tracking', 'Payouts', '/admin/finance-hub?tab=payouts', CreditCard),
    ],
  },
  // ==========================================================================
  // 6. FULFILLMENT & DELIVERY (4 items) - Dedicated hub
  // ==========================================================================
  {
    section: 'Fulfillment',
    items: [
      createItem('delivery-management', 'Overview', '/admin/fulfillment-hub', Truck, { featureFlag: 'delivery_tracking' }),
      createItem('fleet-management', 'Fleet', '/admin/fulfillment-hub?tab=fleet', Truck, { featureFlag: 'fleet_management' }),
      createItem('couriers', 'Couriers', '/admin/fulfillment-hub?tab=couriers', Users, { featureFlag: 'courier_portal' }),
      createItem('delivery-tracking', 'Tracking', '/admin/fulfillment-hub?tab=map', MapPinned, { featureFlag: 'delivery_tracking' }),
    ],
  },
  // ==========================================================================
  // 7. STOREFRONT & MARKETING (5 items)
  // ==========================================================================
  {
    section: 'Marketing',
    items: [
      createItem('storefront', 'Storefront', '/admin/storefront-hub', Store),
      createItem('storefront', 'Builder', '/admin/storefront-hub?tab=builder', Layers),
      createItem('storefront', 'Store Settings', '/admin/storefront-hub?tab=settings', Settings),
      createItem('storefront', 'Live Orders', '/admin/storefront-hub?tab=live', Activity),
      createItem('storefront', 'Store Analytics', '/admin/storefront-hub?tab=analytics', BarChart3),
      createItem('storefront', 'Reviews', '/admin/storefront-hub?tab=reviews', Star),
      createItem('coupons', 'Coupons', '/admin/storefront-hub?tab=coupons', Tag, { featureFlag: 'marketing_hub' }),
      createItem('marketing-automation', 'Campaigns', '/admin/marketing-hub?tab=campaigns', Mail, { featureFlag: 'marketing_hub' }),
      createItem('live-chat', 'Live Chat', '/admin/marketing-hub?tab=live-chat', MessageSquare, { featureFlag: 'live_chat' }),
    ],
  },
  // ==========================================================================
  // 8. ANALYTICS (5 items)
  // ==========================================================================
  {
    section: 'Analytics',
    items: [
      createItem('analytics', 'Overview', '/admin/analytics-hub', BarChart3, { featureFlag: 'analytics_advanced' }),
      createItem('reports', 'Reports', '/admin/analytics-hub?tab=reports', FileText, { featureFlag: 'analytics_advanced' }),
      createItem('advanced-reporting', 'Advanced', '/admin/analytics-hub?tab=advanced', PieChart, { featureFlag: 'analytics_advanced' }),
      createItem('data-export', 'Export', '/admin/analytics-hub?tab=export', Download, { featureFlag: 'analytics_advanced' }),
    ],
  },
  // ==========================================================================
  // 9. OPERATIONS (6 items)
  // ==========================================================================
  {
    section: 'Operations',
    items: [
      createItem('team-members', 'Team', '/admin/operations-hub?tab=team', Users),
      createItem('role-management', 'Roles', '/admin/operations-hub?tab=team&sub=roles', UserCog),
      createItem('suppliers', 'Vendors', '/admin/operations-hub?tab=procurement&sub=vendors', Building2, { featureFlag: 'vendor_management' }),
      createItem('purchase-orders', 'Purchase Orders', '/admin/operations-hub?tab=procurement&sub=purchase-orders', FileText, { featureFlag: 'purchase_orders' }),
      createItem('locations', 'Locations', '/admin/operations-hub?tab=locations', MapPin),
      createItem('activity-logs', 'Activity Logs', '/admin/operations-hub?tab=activity', ScrollText),
    ],
  },
  // ==========================================================================
  // 10. INTEGRATIONS (4 items)
  // ==========================================================================
  {
    section: 'Integrations',
    collapsed: true,
    items: [
      createItem('api-access', 'API Access', '/admin/api-access', Key),
      createItem('webhooks', 'Webhooks', '/admin/webhooks', Zap),
      createItem('automation', 'Automation', '/admin/workflow-automation', FolderKanban),
      createItem('ai', 'Local AI', '/admin/local-ai', Brain),
    ],
  },
  // ==========================================================================
  // 11. SETTINGS (3 items) - Compliance merged into Operations
  // ==========================================================================
  {
    section: 'Settings',
    collapsed: true,
    items: [
      createItem('settings', 'Settings', '/admin/settings-hub', Settings),
      createItem('help', 'Help Center', '/admin/help-hub', HelpCircle),
      createItem('priority-support', 'Priority Support', '/admin/help-hub?tab=support', Headphones),
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
