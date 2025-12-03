/**
 * Sidebar Configurations for All Operation Sizes
 * 
 * Defines sidebar menu items for each operation size tier:
 * - Street: Solo runner / small crew (10 items)
 * - Small: Small business (20-25 items)
 * - Medium: Medium business (40-50 items)
 * - Enterprise: Large operation (120+ items)
 * 
 * UPDATED: Consolidated into user-journey based groups
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
  Share2,
  User,
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
  Navigation,
  MapPinned,
  Image,
  FolderKanban,
  Key,
  Building,
  Lock,
  Flame,
  Menu,
  ClipboardList,
  ArrowRightLeft,
  MessageSquare,
  Layers,
  Briefcase
} from 'lucide-react';
import { FEATURES, type FeatureId } from '@/lib/featureConfig';

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
    submenu?: Array<{ name: string; path: string; badge?: number | string }>;
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
    submenu: options?.submenu?.map(sub => ({
      id: `${featureId}-${sub.path}`,
      name: sub.name,
      path: sub.path,
      icon,
      featureId,
    })),
  };
}

/**
 * STREET OPERATION SIDEBAR (10 items max)
 * For solo runners / small crews, mobile operations
 */
export const STREET_OPERATION_SIDEBAR: SidebarSection[] = [
  {
    section: '🚀 Quick Actions',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('basic-orders', 'New Sale', '/admin/disposable-menu-orders', ShoppingCart, { hot: true }),
      createItem('stock-check', 'Check Stock', '/admin/inventory/products', Package),
      createItem('stock-alerts', 'Restock Alert', '/admin/stock-alerts', AlertCircle),
    ],
  },
  {
    section: '💼 Business',
    items: [
      createItem('reports', "Today's Sales", '/admin/reports', TrendingUp, { hot: true }),
      createItem('fronted-inventory', 'Who Owes Me', '/admin/fronted-inventory', CreditCard),
      createItem('cash-register', 'Cash Count', '/admin/cash-register', Wallet),
      createItem('billing', 'Billing', '/admin/billing', DollarSign),
    ],
  },
  {
    section: '⚙️ Manage',
    items: [
      createItem('products', 'My Products', '/admin/inventory/products', Box),
      createItem('customer-crm', 'My Customers', '/admin/big-plug-clients', Users),
      createItem('disposable-menus', 'Quick Menu', '/admin/disposable-menus', Share2),
      createItem('settings', 'Settings', '/admin/settings', Settings),
    ],
  },
];

/**
 * SMALL BUSINESS SIDEBAR (20-25 items)
 * For small retail shops / delivery services, 2-5 employees
 */
export const SMALL_BUSINESS_SIDEBAR: SidebarSection[] = [
  {
    section: '🔥 Command Center',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('hotbox', 'Hotbox', '/admin/hotbox', Flame, { shortcut: '⌘H', hot: true }),
      createItem('dashboard', 'Overview', '/admin/dashboard', LayoutDashboard, { shortcut: '⌘1' }),
      createItem('live-orders', 'Live Orders', '/admin/live-orders', Activity),
    ],
  },
  {
    section: '🛍️ Sales & Orders',
    defaultExpanded: true,
    items: [
      createItem('basic-orders', 'Orders', '/admin/disposable-menu-orders', ShoppingCart),
      createItem('pos-system', 'POS Register', '/admin/pos-system', CreditCard),
      createItem('disposable-menus', 'Menus', '/admin/disposable-menus', Menu),
      createItem('wholesale-orders', 'Wholesale', '/admin/wholesale-orders', FileText),
    ],
  },
  {
    section: '📦 Inventory',
    items: [
      createItem('inventory-dashboard', 'Stock Levels', '/admin/inventory-dashboard', Package),
      createItem('products', 'Products', '/admin/inventory/products', Box),
      createItem('menu-migration', 'Import Products', '/admin/menu-migration', Download),
      createItem('stock-alerts', 'Alerts', '/admin/stock-alerts', Bell),
    ],
  },
  {
    section: '👥 Customers',
    items: [
      createItem('customer-crm', 'CRM', '/admin/crm/clients', Users),
      createItem('customer-list', 'Customer List', '/admin/big-plug-clients', Users),
      createItem('crm-invoices', 'Invoices', '/admin/crm/invoices', FileText),
    ],
  },
  {
    section: '📊 Reports',
    collapsed: true,
    items: [
      createItem('reports', 'Sales Reports', '/admin/reports', TrendingUp),
      createItem('revenue-reports', 'Expenses', '/admin/revenue-reports', Receipt),
    ],
  },
  {
    section: '⚙️ Settings',
    collapsed: true,
    items: [
      createItem('team-members', 'Staff', '/admin/staff-management', Users),
      createItem('settings', 'General Settings', '/admin/settings', Settings),
      createItem('billing', 'Billing', '/admin/billing', DollarSign),
    ],
  },
];

/**
 * MEDIUM BUSINESS SIDEBAR (40-50 items)
 * For multi-location operations, 5-20 employees
 * CONSOLIDATED STRUCTURE
 */
export const MEDIUM_BUSINESS_SIDEBAR: SidebarSection[] = [
  {
    section: '🔥 Command Center',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('hotbox', 'Hotbox', '/admin/hotbox', Flame, { shortcut: '⌘H', hot: true }),
      createItem('dashboard', 'Overview', '/admin/dashboard', LayoutDashboard, { shortcut: '⌘1' }),
      createItem('live-orders', 'Live Orders', '/admin/live-orders', Activity),
      createItem('live-map', 'Live Map', '/admin/live-map', MapPin),
      createItem('notifications', 'Notifications', '/admin/notifications', Bell),
    ],
  },
  {
    section: '🛍️ Catalog & Sales',
    defaultExpanded: true,
    items: [
      createItem('products', 'Products', '/admin/inventory/products', Box),
      createItem('basic-orders', 'Orders', '/admin/disposable-menu-orders', ShoppingCart, {
        submenu: [
          { name: 'All Orders', path: '/admin/disposable-menu-orders' },
          { name: 'New Orders', path: '/admin/disposable-menu-orders' },
          { name: 'Processing', path: '/admin/disposable-menu-orders' },
          { name: 'Ready', path: '/admin/disposable-menu-orders' },
        ],
      }),
      createItem('disposable-menus', 'Menus', '/admin/disposable-menus', Menu),
      createItem('pos-system', 'Point of Sale', '/admin/pos-system', Store),
      createItem('marketplace', 'Marketplace', '/admin/marketplace/listings', Globe),
      createItem('sales-dashboard', 'Deals & Pricing', '/admin/sales-dashboard', Tag),
    ],
  },
  {
    section: '👥 Customers',
    items: [
      createItem('customer-crm', 'CRM', '/admin/crm/clients', Users, { hot: true }),
      createItem('crm-invoices', 'Invoices', '/admin/crm/invoices', FileText),
      createItem('customer-insights', 'Insights', '/admin/customer-insights', TrendingUp),
      createItem('marketing-automation', 'Marketing', '/admin/marketing-automation', Mail),
      createItem('loyalty-program', 'Loyalty', '/admin/loyalty-program', Star),
    ],
  },
  {
    section: '⚙️ Operations',
    items: [
      createItem('inventory-dashboard', 'Inventory', '/admin/inventory-dashboard', Warehouse, {
        submenu: [
          { name: 'Stock Levels', path: '/admin/inventory-dashboard' },
          { name: 'Transfers', path: '/admin/inventory-transfers' },
          { name: 'Receiving', path: '/admin/operations/receiving' },
          { name: 'Alerts', path: '/admin/stock-alerts' },
        ],
      }),
      createItem('delivery-management', 'Delivery', '/admin/delivery-management', Truck),
      createItem('team-members', 'Team', '/admin/staff-management', Users),
      createItem('locations', 'Locations', '/admin/locations', Building),
      createItem('quality-control', 'Quality Control', '/admin/quality-control', Shield),
    ],
  },
  {
    section: '📊 Analytics & Finance',
    items: [
      createItem('analytics', 'Analytics', '/admin/analytics/comprehensive', BarChart3),
      createItem('revenue-reports', 'Revenue', '/admin/revenue-reports', DollarSign),
      createItem('invoice-management', 'Financial Center', '/admin/financial-center', Briefcase),
      createItem('reports', 'Reports', '/admin/reports', FileSpreadsheet),
    ],
  },
  {
    section: '🔧 Settings',
    collapsed: true,
    items: [
      createItem('settings', 'General', '/admin/settings', Settings),
      createItem('billing', 'Billing', '/admin/billing', CreditCard),
      createItem('custom-integrations', 'Integrations', '/admin/custom-integrations', Zap),
      createItem('help', 'Support', '/admin/help', HelpCircle),
    ],
  },
];

/**
 * ENTERPRISE SIDEBAR (120+ items)
 * For large-scale operations, multiple departments
 * CONSOLIDATED STRUCTURE
 */
export const ENTERPRISE_SIDEBAR: SidebarSection[] = [
  {
    section: '🔥 Command Center',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('hotbox', 'Hotbox', '/admin/hotbox', Flame, { shortcut: '⌘H', hot: true }),
      createItem('dashboard', 'Executive Dashboard', '/admin/dashboard', LayoutDashboard),
      createItem('realtime-dashboard', 'Real-Time Monitor', '/admin/realtime-dashboard', Activity),
      createItem('live-map', 'Global Map', '/admin/live-map', Globe),
      createItem('notifications', 'Alert Center', '/admin/notifications', Bell),
    ],
  },
  {
    section: '🛍️ Catalog & Sales',
    defaultExpanded: true,
    items: [
      createItem('products', 'Product Catalog', '/admin/inventory/products', Box),
      createItem('menu-migration', 'Menu Migration', '/admin/menu-migration', Download),
      createItem('basic-orders', 'Order Management', '/admin/disposable-menu-orders', ShoppingCart),
      createItem('disposable-menus', 'Menu Management', '/admin/disposable-menus', Menu),
      createItem('pos-system', 'POS System', '/admin/pos-system', Store),
      createItem('wholesale-orders', 'Wholesale Orders', '/admin/wholesale-orders', FileText),
      createItem('live-orders', 'Live Orders', '/admin/live-orders', Activity),
      createItem('marketplace', 'Marketplace', '/admin/marketplace/listings', Store),
      createItem('sales-dashboard', 'Pricing Strategy', '/admin/sales-dashboard', DollarSign),
      createItem('bulk-operations', 'Bulk Operations', '/admin/bulk-operations', FolderKanban),
    ],
  },
  {
    section: '👥 Customer Experience',
    items: [
      createItem('customer-crm', 'Advanced CRM', '/admin/crm/clients', Users),
      createItem('customer-list', 'Customer List', '/admin/big-plug-clients', Users),
      createItem('crm-invoices', 'Invoices', '/admin/crm/invoices', FileText),
      createItem('customer-insights', 'Customer 360', '/admin/customer-insights', Brain),
      createItem('marketing-automation', 'Marketing Automation', '/admin/marketing-automation', Mail),
      createItem('loyalty-program', 'Loyalty & Rewards', '/admin/loyalty-program', Star),
      createItem('support-tickets', 'Support Desk', '/admin/support-tickets', Headphones),
    ],
  },
  {
    section: '⚙️ Global Operations',
    items: [
      createItem('inventory-dashboard', 'Inventory Control', '/admin/inventory-dashboard', Warehouse),
      createItem('stock-alerts', 'Stock Alerts', '/admin/stock-alerts', AlertCircle),
      createItem('stock-check', 'Stock Check', '/admin/inventory/products', Package),
      createItem('quality-control', 'Quality Control', '/admin/quality-control', Shield),
      createItem('delivery-management', 'Fleet Logistics', '/admin/delivery-management', Truck),
      createItem('locations', 'Location Management', '/admin/locations', Building2),
      createItem('team-members', 'Workforce', '/admin/staff-management', Users),
      createItem('automation', 'Workflows', '/admin/workflow-automation', Zap),
      createItem('compliance', 'Compliance & Safety', '/admin/compliance', Shield),
    ],
  },
  {
    section: '📊 Intelligence',
    items: [
      createItem('analytics', 'BI Dashboard', '/admin/analytics/comprehensive', BarChart3),
      createItem('reports', 'Reports', '/admin/reports', TrendingUp),
      createItem('predictive-analytics', 'Predictive AI', '/admin/predictive-analytics', Brain),
      createItem('advanced-reporting', 'Custom Reports', '/admin/advanced-reporting', FileSpreadsheet),
      createItem('revenue-reports', 'Financial Performance', '/admin/revenue-reports', TrendingUp),
      createItem('invoice-management', 'Financial Center', '/admin/financial-center', Briefcase),
      createItem('fronted-inventory', 'Fronted Inventory', '/admin/fronted-inventory', CreditCard),
      createItem('cash-register', 'Cash Register', '/admin/cash-register', Wallet),
      createItem('data-export', 'Data Warehouse', '/admin/data-export', Download),
    ],
  },
  {
    section: '🔧 System & Admin',
    collapsed: true,
    items: [
      createItem('settings', 'Global Settings', '/admin/settings', Settings),
      createItem('billing', 'Billing & Contracts', '/admin/billing', CreditCard),
      createItem('custom-integrations', 'Integrations', '/admin/custom-integrations', Zap),
      createItem('api-access', 'API & Webhooks', '/admin/api-access', Zap),
      createItem('white-label', 'White Label', '/admin/white-label', Layers),
      createItem('audit-trail', 'Audit Logs', '/admin/audit-trail', ScrollText),
      createItem('help', 'Help & Support', '/admin/help', HelpCircle),
      createItem('priority-support', 'Enterprise Support', '/admin/priority-support', Headphones),
    ],
  },
];

/**
 * Map feature IDs to sidebar item IDs for reverse lookup
 */
export const SIDEBAR_FEATURE_MAP: Record<string, FeatureId> = {
  'dashboard': 'dashboard',
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
  'disposable-menu-analytics': 'disposable-menu-analytics',
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
 * Get sidebar config for operation size
 */
export function getSidebarConfig(size: 'street' | 'small' | 'medium' | 'enterprise'): SidebarSection[] {
  switch (size) {
    case 'street':
      return STREET_OPERATION_SIDEBAR;
    case 'small':
      return SMALL_BUSINESS_SIDEBAR;
    case 'medium':
      return MEDIUM_BUSINESS_SIDEBAR;
    case 'enterprise':
      return ENTERPRISE_SIDEBAR;
    default:
      return MEDIUM_BUSINESS_SIDEBAR;
  }
}
