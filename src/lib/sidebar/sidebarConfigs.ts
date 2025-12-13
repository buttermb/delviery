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
 * Full platform for large operations - ALL 86 features
 */
export const ENTERPRISE_SIDEBAR: SidebarSection[] = [
  // ==========================================================================
  // COMMAND CENTER (6 items)
  // ==========================================================================
  {
    section: 'Command Center',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('dashboard', 'Dashboard', '/admin/dashboard', LayoutDashboard, { shortcut: '⌘1' }),
      createItem('hotbox', 'Hotbox', '/admin/hotbox', Flame, { hot: true }),
      createItem('live-orders', 'Live Orders', '/admin/live-orders', Activity),
      createItem('notifications', 'Notifications', '/admin/notifications', Bell),
      createItem('realtime-dashboard', 'Real-Time Monitor', '/admin/realtime-dashboard', Activity),
      createItem('live-map', 'Live Map', '/admin/live-map', MapPin),
    ],
  },
  // ==========================================================================
  // SALES & ORDERS (12 items)
  // ==========================================================================
  {
    section: 'Sales & Orders',
    defaultExpanded: true,
    items: [
      createItem('basic-orders', 'Orders', '/admin/orders', ShoppingCart),
      createItem('disposable-menus', 'Menus', '/admin/disposable-menus', Menu),
      createItem('wholesale-orders', 'Wholesale', '/admin/wholesale', FileText),
      createItem('loyalty-program', 'Loyalty', '/admin/marketing-hub?tab=loyalty', Star),
      createItem('coupons', 'Coupons', '/admin/marketing-hub?tab=coupons', Tag),
      createItem('menu-migration', 'Menu Migration', '/admin/menu-migration', Download),
      createItem('marketplace', 'Marketplace', '/admin/marketplace/dashboard', Globe),
      createItem('sales-dashboard', 'Deals & Pricing', '/admin/sales-dashboard', Tag),
      createItem('pos-system', 'POS Register', '/admin/pos-hub', Store),
      createItem('storefront', 'Storefront', '/admin/storefront-hub', Store),
    ],
  },
  // ==========================================================================
  // INVENTORY (10 items)
  // ==========================================================================
  {
    section: 'Inventory',
    items: [
      createItem('products', 'Products', '/admin/inventory-hub', Package),
      createItem('inventory-dashboard', 'Stock Levels', '/admin/inventory-hub?tab=stock', Warehouse),
      createItem('stock-alerts', 'Stock Alerts', '/admin/stock-alerts', AlertCircle),
      createItem('generate-barcodes', 'Barcodes', '/admin/generate-barcodes', Barcode),
      createItem('advanced-inventory', 'Advanced Inventory', '/admin/inventory-hub?tab=adjustments', Box),
      createItem('inventory-transfers', 'Transfers', '/admin/inventory-transfers', ArrowRightLeft),
      createItem('fronted-inventory', 'Who Owes Me', '/admin/inventory-hub?tab=fronted', CreditCard),
      createItem('operations', 'Receiving & Packaging', '/admin/operations/receiving', Warehouse),
      createItem('dispatch-inventory', 'Dispatch', '/admin/inventory-hub?tab=dispatch', Truck),
    ],
  },
  // ==========================================================================
  // CUSTOMERS (7 items)
  // ==========================================================================
  {
    section: 'Customers',
    items: [
      createItem('customers', 'Customers', '/admin/customer-hub', Users),
      createItem('customer-crm', 'CRM', '/admin/customer-hub?tab=crm', Users),
      createItem('crm-invoices', 'Invoices', '/admin/crm/invoices', FileText),
      createItem('customer-insights', 'Insights', '/admin/customer-hub?tab=insights', TrendingUp),
      createItem('marketing-automation', 'Marketing', '/admin/marketing-hub?tab=campaigns', Mail),
      createItem('customer-analytics', 'Customer Analytics', '/admin/customer-hub?tab=analytics', BarChart3),
      createItem('live-chat', 'Live Chat', '/admin/live-chat', MessageSquare),
    ],
  },
  // ==========================================================================
  // OPERATIONS (12 items)
  // ==========================================================================
  {
    section: 'Operations',
    items: [
      createItem('suppliers', 'Suppliers', '/admin/operations-hub?tab=suppliers', Building2),
      createItem('purchase-orders', 'Purchase Orders', '/admin/operations-hub?tab=purchase-orders', FileText),
      createItem('returns', 'Returns & Refunds', '/admin/operations-hub?tab=returns', ArrowRightLeft),
      createItem('team-members', 'Team', '/admin/operations-hub?tab=team', Users),
      createItem('role-management', 'Roles', '/admin/operations-hub?tab=roles', UserCog),
      createItem('activity-logs', 'Activity Logs', '/admin/operations-hub?tab=activity', ScrollText),
      createItem('quality-control', 'Quality Control', '/admin/operations-hub?tab=quality', Shield),
      createItem('appointments', 'Appointments', '/admin/operations-hub?tab=appointments', Calendar),
      createItem('support-tickets', 'Support Desk', '/admin/operations-hub?tab=support', Headphones),
      createItem('locations', 'Locations', '/admin/operations-hub?tab=locations', Building),
      createItem('user-management', 'User Management', '/admin/user-management', UserCog),
      createItem('permissions', 'Permissions', '/admin/permissions', Key),
    ],
  },
  // ==========================================================================
  // DELIVERY & FLEET (6 items)
  // ==========================================================================
  {
    section: 'Delivery & Fleet',
    items: [
      createItem('delivery-management', 'Delivery', '/admin/delivery-hub', Truck),
      createItem('fleet-management', 'Fleet', '/admin/delivery-hub?tab=fleet', Building2),
      createItem('couriers', 'Couriers', '/admin/delivery-hub?tab=couriers', Users),
      createItem('route-optimization', 'Route Optimizer', '/admin/delivery-hub?tab=routes', MapPinned),
      createItem('delivery-tracking', 'Tracking', '/admin/delivery-hub?tab=tracking', MapPin),
      createItem('delivery-analytics', 'Delivery Analytics', '/admin/delivery-hub?tab=analytics', BarChart3),
    ],
  },
  // ==========================================================================
  // POINT OF SALE (3 items)
  // ==========================================================================
  {
    section: 'Point of Sale',
    collapsed: true,
    items: [
      createItem('cash-register', 'Cash Register', '/admin/cash-register', Wallet),
      createItem('pos-analytics', 'POS Analytics', '/admin/pos-analytics', PieChart),
      createItem('location-analytics', 'Location Analytics', '/admin/location-analytics', MapPin),
    ],
  },
  // ==========================================================================
  // ANALYTICS & FINANCE (15 items)
  // ==========================================================================
  {
    section: 'Analytics & Finance',
    items: [
      createItem('reports', 'Reports', '/admin/reports', FileSpreadsheet),
      createItem('analytics', 'Analytics', '/admin/analytics-hub', BarChart3),
      createItem('revenue-reports', 'Revenue', '/admin/revenue-reports', TrendingUp),
      createItem('financial-center', 'Financial Center', '/admin/finance-hub', Briefcase),
      createItem('invoice-management', 'Invoice Management', '/admin/advanced-invoice', Receipt),
      createItem('commission-tracking', 'Commissions', '/admin/commission-tracking', DollarSign),
      createItem('expense-tracking', 'Expenses', '/admin/expense-tracking', Receipt),
      createItem('menu-analytics', 'Menu Analytics', '/admin/menu-analytics', BarChart3),
      createItem('order-analytics', 'Order Analytics', '/admin/order-analytics', PieChart),
      createItem('advanced-reporting', 'Advanced Reporting', '/admin/advanced-reporting', BarChart3),
      createItem('predictive-analytics', 'Forecasting', '/admin/predictive-analytics', Brain),
      createItem('advanced-analytics', 'AI Analytics', '/admin/advanced-analytics', Brain),
      createItem('custom-reports', 'Custom Reports', '/admin/custom-reports', FileText),
      createItem('data-export', 'Data Warehouse', '/admin/data-export', Download),
      createItem('risk-management', 'Risk Management', '/admin/risk-management', Shield),
    ],
  },
  // ==========================================================================
  // INTEGRATIONS (7 items)
  // ==========================================================================
  {
    section: 'Integrations',
    collapsed: true,
    items: [
      createItem('bulk-operations', 'Bulk Operations', '/admin/bulk-operations', FolderKanban),
      createItem('vendor-portal', 'Vendor Portal', '/vendor/dashboard', Building2),
      createItem('api-access', 'API & Webhooks', '/admin/api-access', Zap),
      createItem('webhooks', 'Webhooks', '/admin/webhooks', Activity),
      createItem('custom-integrations', 'Integrations', '/admin/custom-integrations', Zap),
      createItem('automation', 'Workflows', '/admin/workflow-automation', Zap),
      createItem('ai', 'Local AI', '/admin/local-ai', Brain),
    ],
  },
  // ==========================================================================
  // SECURITY & COMPLIANCE (4 items)
  // ==========================================================================
  {
    section: 'Security & Compliance',
    collapsed: true,
    items: [
      createItem('batch-recall', 'Batch Recall', '/admin/compliance-hub?tab=batch-recall', AlertCircle),
      createItem('compliance-vault', 'Compliance Vault', '/admin/compliance-hub?tab=vault', FileText),
      createItem('audit-trail', 'Audit Logs', '/admin/compliance-hub?tab=audit', ScrollText),
      createItem('compliance', 'Compliance', '/admin/compliance-hub', Shield),
    ],
  },
  // ==========================================================================
  // SETTINGS (7 items)
  // ==========================================================================
  {
    section: 'Settings',
    collapsed: true,
    items: [
      createItem('settings', 'Settings', '/admin/settings', Settings),
      createItem('billing', 'Billing', '/admin/billing', CreditCard),
      createItem('help', 'Help & Support', '/admin/help', HelpCircle),
      createItem('white-label', 'White Label', '/admin/white-label', Layers),
      createItem('custom-domain', 'Custom Domain', '/admin/custom-domain', Globe),
      createItem('system-settings', 'System Settings', '/admin/system-settings', Settings),
      createItem('priority-support', 'Enterprise Support', '/admin/priority-support', Headphones),
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
