/**
 * Sidebar Configurations for All Operation Sizes
 * 
 * Defines sidebar menu items for each operation size tier:
 * - Street: Solo runner / small crew (10 items)
 * - Small: Small business (20-25 items)
 * - Medium: Medium business (40-50 items)
 * - Enterprise: Large operation (120+ items)
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
  MapPin,
  Bell,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Mail,
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
  Menu,
  ClipboardList,
  ArrowRightLeft,
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
    section: '📦 Quick Actions',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('basic-orders', 'New Sale', '/admin/disposable-menu-orders', ShoppingCart, { hot: true }),
      createItem('products', 'Check Stock', '/admin/inventory/products', Package),
      createItem('stock-alerts', 'Restock Alert', '/admin/stock-alerts', AlertCircle),
    ],
  },
  {
    section: '💰 Money',
    items: [
      createItem('reports', "Today's Sales", '/admin/reports', TrendingUp, { hot: true }),
      createItem('fronted-inventory', 'Who Owes Me', '/admin/fronted-inventory', CreditCard),
      createItem('cash-register', 'Cash Count', '/admin/cash-register', Wallet),
    ],
  },
  {
    section: '📋 Essential',
    items: [
      createItem('products', 'My Products', '/admin/inventory/products', Box),
      createItem('customers', 'My Customers', '/admin/big-plug-clients', Users),
      createItem('disposable-menus', 'Quick Menu', '/admin/disposable-menus', Share2),
    ],
  },
  {
    section: '⚙️ Settings',
    collapsed: true,
    items: [
      createItem('billing', 'Billing', '/admin/billing', CreditCard),
      createItem('settings', 'My Profile', '/admin/settings', User),
    ],
  },
];

/**
 * SMALL BUSINESS SIDEBAR (20-25 items)
 * For small retail shops / delivery services, 2-5 employees
 */
export const SMALL_BUSINESS_SIDEBAR: SidebarSection[] = [
  {
    section: '🏠 Home',
    items: [
      createItem('dashboard', 'Dashboard', '/admin/dashboard', LayoutDashboard, { shortcut: '⌘1' }),
    ],
  },
  {
    section: '📦 Orders & Sales',
    defaultExpanded: true,
    items: [
      createItem('basic-orders', "Today's Orders", '/admin/disposable-menu-orders', ShoppingCart, { hot: true }),
      createItem('wholesale-orders', 'All Orders', '/admin/wholesale-orders', FileText),
      createItem('pos-system', 'POS / Cash Register', '/admin/pos-system', CreditCard),
      createItem('fronted-inventory', 'Fronted Inventory', '/admin/fronted-inventory', AlertCircle),
    ],
  },
  {
    section: '📊 Inventory',
    items: [
      createItem('inventory-dashboard', 'Stock Levels', '/admin/inventory-dashboard', Package),
      createItem('products', 'Add Products', '/admin/inventory/products', Package),
      createItem('stock-alerts', 'Restock Alerts', '/admin/stock-alerts', Bell),
      createItem('inventory-dashboard', 'Quick Stock Count', '/admin/inventory-dashboard', Package),
    ],
  },
  {
    section: '👥 Customers',
    items: [
      createItem('customers', 'Customer List', '/admin/big-plug-clients', Users),
      createItem('disposable-menus', 'Share Menu', '/admin/disposable-menus', Share2, { hot: true }),
      createItem('customers', 'Credit Balances', '/admin/big-plug-clients', DollarSign),
    ],
  },
  {
    section: '🚗 Delivery',
    items: [
      createItem('delivery-management', 'Active Deliveries', '/admin/delivery-management', Truck),
      createItem('delivery-management', 'Assign Drivers', '/admin/delivery-management', UserCog),
      createItem('live-map', 'Delivery Map', '/admin/live-map', MapPin),
    ],
  },
  {
    section: '💰 Money',
    collapsed: true,
    items: [
      createItem('reports', "Today's Revenue", '/admin/reports', TrendingUp),
      createItem('reports', 'This Week', '/admin/reports', Calendar),
      createItem('revenue-reports', 'Expenses', '/admin/revenue-reports', Receipt),
    ],
  },
  {
    section: '⚙️ Settings',
    collapsed: true,
    items: [
      createItem('billing', 'Subscription', '/admin/billing', CreditCard),
      createItem('team-members', 'Team', '/admin/staff-management', Users),
      createItem('settings', 'Business Info', '/admin/settings', Building),
    ],
  },
];

/**
 * MEDIUM BUSINESS SIDEBAR (40-50 items)
 * For multi-location operations, 5-20 employees
 */
export const MEDIUM_BUSINESS_SIDEBAR: SidebarSection[] = [
  {
    section: '🎯 Command Center',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('dashboard', 'Dashboard', '/admin/dashboard', LayoutDashboard, { shortcut: '⌘1' }),
      createItem('live-map', 'Live Map', '/admin/live-map', MapPin),
      createItem('notifications', 'Notifications', '/admin/notifications', Bell),
    ],
  },
  {
    section: '📦 Operations',
    defaultExpanded: true,
    items: [
      createItem('basic-orders', 'Orders', '/admin/disposable-menu-orders', ShoppingCart, {
        submenu: [
          { name: 'All Orders', path: '/admin/disposable-menu-orders' },
          { name: 'New Orders', path: '/admin/disposable-menu-orders' },
          { name: 'Processing', path: '/admin/disposable-menu-orders' },
          { name: 'Ready for Delivery', path: '/admin/disposable-menu-orders' },
          { name: 'Order History', path: '/admin/disposable-menu-orders' },
        ],
      }),
      createItem('inventory-dashboard', 'Inventory', '/admin/inventory-dashboard', Package, {
        submenu: [
          { name: 'All Products', path: '/admin/inventory/products' },
          { name: 'Low Stock', path: '/admin/stock-alerts' },
          { name: 'Out of Stock', path: '/admin/stock-alerts' },
          { name: 'Transfers', path: '/admin/inventory-transfers' },
          { name: 'Receiving', path: '/admin/operations/receiving' },
          { name: 'Batch Operations', path: '/admin/bulk-operations' },
        ],
      }),
      createItem('delivery-management', 'Delivery & Fleet', '/admin/delivery-management', Truck, {
        submenu: [
          { name: 'Active Deliveries', path: '/admin/delivery-management' },
          { name: 'Driver Management', path: '/admin/fleet-management' },
          { name: 'Route Optimization', path: '/admin/route-optimizer' },
          { name: 'Delivery Zones', path: '/admin/delivery-management' },
          { name: 'Fleet Tracking', path: '/admin/fleet-management' },
        ],
      }),
    ],
  },
  {
    section: '🏷️ Catalog',
    items: [
      createItem('products', 'Products', '/admin/inventory/products', Box),
      createItem('products', 'Categories', '/admin/catalog/categories', Tag),
      createItem('sales-dashboard', 'Pricing & Deals', '/admin/sales-dashboard', DollarSign),
      createItem('bulk-operations', 'Bulk Updates', '/admin/bulk-operations', FolderKanban),
      createItem('generate-barcodes', 'Generate Barcodes', '/admin/generate-barcodes', Barcode),
    ],
  },
  {
    section: '👥 Customers',
    items: [
      createItem('customers', 'Customer List', '/admin/big-plug-clients', Users),
      createItem('disposable-menus', 'Disposable Menus', '/admin/disposable-menus', Lock, { hot: true }),
      createItem('customer-insights', 'Customer Insights', '/admin/customer-insights', TrendingUp),
      createItem('customers', 'Credit Management', '/admin/big-plug-clients', CreditCard),
      createItem('fronted-inventory', 'Fronted Inventory', '/admin/fronted-inventory', AlertCircle),
    ],
  },
  {
    section: '📍 Locations',
    items: [
      createItem('locations', 'Warehouses', '/admin/locations/warehouses', Warehouse),
      createItem('location-analytics', 'Location Analytics', '/admin/location-analytics', MapPin),
      createItem('inventory-dashboard', 'Inventory by Location', '/admin/inventory-dashboard', Package),
    ],
  },
  {
    section: '💰 Finance',
    items: [
      createItem('revenue-reports', 'Revenue Dashboard', '/admin/revenue-reports', TrendingUp),
      createItem('invoice-management', 'Payments & Invoices', '/admin/financial-center', FileText),
      createItem('revenue-reports', 'Expenses', '/admin/revenue-reports', Receipt),
      createItem('commission-tracking', 'Commission Tracking', '/admin/commission-tracking', DollarSign),
      createItem('pos-system', 'POS Sessions', '/admin/pos-system', CreditCard),
      createItem('pos-analytics', 'Z-Reports', '/admin/pos-analytics', FileText),
    ],
  },
  {
    section: '📈 Analytics',
    items: [
      createItem('analytics', 'Business Intelligence', '/admin/analytics/comprehensive', BarChart3),
      createItem('sales-dashboard', 'Sales Analytics', '/admin/sales-dashboard', TrendingUp),
      createItem('menu-analytics', 'Menu Performance', '/admin/menu-analytics', PieChart),
      createItem('delivery-analytics', 'Delivery Analytics', '/admin/delivery-analytics', Truck),
      createItem('advanced-reporting', 'Custom Reports', '/admin/advanced-reporting', FileSpreadsheet),
    ],
  },
  {
    section: '👤 Team',
    items: [
      createItem('team-members', 'Staff Management', '/admin/staff-management', Users),
      createItem('role-management', 'Roles & Permissions', '/admin/role-management', Shield),
      createItem('activity-logs', 'Activity Logs', '/admin/activity-logs', ScrollText),
    ],
  },
  {
    section: '⚙️ Settings',
    collapsed: true,
    items: [
      createItem('billing', 'Billing & Plans', '/admin/billing', CreditCard),
      createItem('settings', 'Business Settings', '/admin/settings', Settings),
      createItem('notifications', 'Notifications', '/admin/notifications', Bell),
      createItem('custom-integrations', 'Integrations', '/admin/custom-integrations', Zap),
      createItem('generate-barcodes', 'Printing & Labels', '/admin/generate-barcodes', Barcode),
      createItem('audit-trail', 'Security', '/admin/audit-trail', Lock),
    ],
  },
];

/**
 * ENTERPRISE SIDEBAR (120+ items)
 * For large-scale operations, multiple departments
 */
export const ENTERPRISE_SIDEBAR: SidebarSection[] = [
  {
    section: '🎯 Mission Control',
    pinned: true,
    defaultExpanded: true,
    items: [
      createItem('dashboard', 'Executive Dashboard', '/admin/dashboard', LayoutDashboard),
      createItem('realtime-dashboard', 'Real-Time Monitor', '/admin/realtime-dashboard', Activity),
      createItem('notifications', 'Alert Center', '/admin/notifications', Bell),
    ],
  },
  // Include all Medium Business items
  ...MEDIUM_BUSINESS_SIDEBAR.slice(1),
  {
    section: '🤖 Automation',
    items: [
      createItem('automation', 'Workflow Automation', '/admin/workflow-automation', Zap),
      createItem('automation', 'Auto-Reordering', '/admin/workflow-automation', Zap),
      createItem('predictive-analytics', 'Smart Pricing', '/admin/predictive-analytics', Brain),
      createItem('route-optimization', 'Route Optimization', '/admin/route-optimizer', MapPinned),
    ],
  },
  {
    section: '🔐 Compliance & Security',
    items: [
      createItem('compliance', 'Compliance Dashboard', '/admin/compliance', Shield),
      createItem('compliance-vault', 'Data Encryption', '/admin/compliance-vault', Lock),
      createItem('audit-trail', 'Audit Trail', '/admin/audit-trail', ScrollText),
      createItem('batch-recall', 'Chain of Custody', '/admin/batch-recall', FileText),
      createItem('activity-logs', 'Access Logs', '/admin/activity-logs', ScrollText),
    ],
  },
  {
    section: '🔌 Integrations',
    items: [
      createItem('api-access', 'API Dashboard', '/admin/api-access', Zap),
      createItem('webhooks', 'Webhooks', '/admin/webhooks', Activity),
      createItem('custom-integrations', 'Connected Apps', '/admin/custom-integrations', Zap),
      createItem('ai', 'Custom Scripts', '/admin/local-ai', Brain),
    ],
  },
  {
    section: '🧠 Advanced Analytics',
    items: [
      createItem('advanced-analytics', 'AI Insights', '/admin/advanced-analytics', Brain),
      createItem('predictive-analytics', 'Predictive Analytics', '/admin/predictive-analytics', TrendingUp),
      createItem('custom-reports', 'Custom Dashboards', '/admin/custom-reports', LayoutDashboard),
      createItem('data-export', 'Data Export', '/admin/data-export', Download),
    ],
  },
  {
    section: '🏢 Enterprise',
    items: [
      createItem('white-label', 'White Label', '/admin/white-label', Globe),
      createItem('custom-domain', 'Custom Domain', '/admin/custom-domain', Globe),
      createItem('priority-support', 'Priority Support', '/admin/priority-support', Headphones),
      createItem('api-access', 'Developer Portal', '/admin/api-access', Zap),
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

