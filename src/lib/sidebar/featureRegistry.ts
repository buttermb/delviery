/**
 * Feature Registry for Sidebar
 * 
 * Maps features to their sidebar display properties.
 * Uses SubscriptionTier for consistent tier gating.
 * 
 * This is a secondary source - featureConfig.ts is the primary source of truth
 * for feature tier assignments. This file provides sidebar-specific metadata.
 */

import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Warehouse,
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
  Star,
  Tag,
  Shield,
  FileSpreadsheet,
  Receipt,
  Menu,
  Store,
  Globe,
  Zap,
  Brain,
  Download,
  FolderKanban,
  Layers,
  ScrollText,
  Headphones,
  HelpCircle,
  Flame,
  Activity,
  Briefcase,
  ArrowRightLeft,
  UserCog,
  Key,
  Calendar,
  MessageSquare,
  Barcode,
  MapPinned,
  Building,
  PieChart,
} from 'lucide-react';
import { type FeatureId, type SubscriptionTier } from '@/lib/featureConfig';

export type OperationSize = 'street' | 'small' | 'medium' | 'enterprise';

export interface FeatureDef {
  id: FeatureId;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  category: string;
  minTier: SubscriptionTier;
  description?: string;
  // Legacy/compatibility properties
  minBusinessTier?: string;
  minOperationSize?: OperationSize;
}

/**
 * Feature Registry - Maps feature IDs to sidebar display properties
 * 
 * The `minTier` field should match the tier in featureConfig.ts.
 * Categories should match the CATEGORY_ORDER in featureConfig.ts.
 */
export const FEATURE_REGISTRY: Record<string, FeatureDef> = {
  // ==========================================================================
  // COMMAND CENTER
  // ==========================================================================
  'dashboard': {
    id: 'dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin/dashboard',
    category: 'Command Center',
    minTier: 'starter',
  },
  'hotbox': {
    id: 'hotbox',
    name: 'Hotbox',
    icon: Flame,
    path: '/admin/hotbox',
    category: 'Command Center',
    minTier: 'starter',
  },
  'live-orders': {
    id: 'live-orders',
    name: 'Live Orders',
    icon: Activity,
    path: '/admin/orders?tab=live',
    category: 'Command Center',
    minTier: 'professional',
  },
  'notifications': {
    id: 'notifications',
    name: 'Notifications',
    icon: Bell,
    path: '/admin/notifications',
    category: 'Command Center',
    minTier: 'professional',
  },
  'realtime-dashboard': {
    id: 'realtime-dashboard',
    name: 'Real-Time Monitor',
    icon: Activity,
    path: '/admin/realtime-dashboard',
    category: 'Command Center',
    minTier: 'enterprise',
    description: 'Real-time operational monitoring dashboard',
  },
  'live-map': {
    id: 'live-map',
    name: 'Live Map',
    icon: MapPin,
    path: '/admin/live-map',
    category: 'Command Center',
    minTier: 'enterprise',
  },

  // ==========================================================================
  // SALES & ORDERS
  // ==========================================================================
  'basic-orders': {
    id: 'basic-orders',
    name: 'Orders',
    icon: ShoppingCart,
    path: '/admin/orders?tab=menu',
    category: 'Sales & Orders',
    minTier: 'starter',
  },
  'disposable-menus': {
    id: 'disposable-menus',
    name: 'Menus',
    icon: Menu,
    path: '/admin/disposable-menus',
    category: 'Sales & Orders',
    minTier: 'starter',
  },
  'wholesale-orders': {
    id: 'wholesale-orders',
    name: 'Wholesale',
    icon: FileText,
    path: '/admin/orders?tab=wholesale',
    category: 'Sales & Orders',
    minTier: 'starter',
  },
  'loyalty-program': {
    id: 'loyalty-program',
    name: 'Loyalty',
    icon: Star,
    path: '/admin/marketing-hub?tab=loyalty',
    category: 'Sales & Orders',
    minTier: 'starter',
  },
  'coupons': {
    id: 'coupons',
    name: 'Coupons',
    icon: Tag,
    path: '/admin/storefront-hub?tab=coupons',
    category: 'Sales & Orders',
    minTier: 'starter',
  },
  'menu-migration': {
    id: 'menu-migration',
    name: 'Menu Migration',
    icon: Download,
    path: '/admin/menu-migration',
    category: 'Sales & Orders',
    minTier: 'starter',
  },
  'marketplace': {
    id: 'marketplace',
    name: 'Marketplace',
    icon: Globe,
    path: '/admin/marketplace/dashboard',
    category: 'Sales & Orders',
    minTier: 'professional',
  },
  'sales-dashboard': {
    id: 'sales-dashboard',
    name: 'Deals & Pricing',
    icon: Tag,
    path: '/admin/sales-dashboard',
    category: 'Sales & Orders',
    minTier: 'professional',
  },
  'pos-system': {
    id: 'pos-system',
    name: 'POS Register',
    icon: Store,
    path: '/admin/pos-system',
    category: 'Sales & Orders',
    minTier: 'enterprise',
  },
  'storefront': {
    id: 'storefront',
    name: 'Storefront',
    icon: Store,
    path: '/admin/storefront-hub',
    category: 'Sales & Orders',
    minTier: 'professional',
  },

  // ==========================================================================
  // INVENTORY
  // ==========================================================================
  'products': {
    id: 'products',
    name: 'Products',
    icon: Package,
    path: '/admin/inventory-hub?tab=products',
    category: 'Inventory',
    minTier: 'starter',
  },
  'inventory-dashboard': {
    id: 'inventory-dashboard',
    name: 'Stock Levels',
    icon: Warehouse,
    path: '/admin/inventory-hub?tab=stock',
    category: 'Inventory',
    minTier: 'starter',
  },
  'stock-alerts': {
    id: 'stock-alerts',
    name: 'Stock Alerts',
    icon: AlertCircle,
    path: '/admin/inventory-hub?tab=monitoring',
    category: 'Inventory',
    minTier: 'starter',
  },
  'generate-barcodes': {
    id: 'generate-barcodes',
    name: 'Barcodes',
    icon: Barcode,
    path: '/admin/inventory-hub?tab=barcodes',
    category: 'Inventory',
    minTier: 'starter',
  },
  'advanced-inventory': {
    id: 'advanced-inventory',
    name: 'Advanced Inventory',
    icon: Box,
    path: '/admin/inventory-hub?tab=adjustments',
    category: 'Inventory',
    minTier: 'professional',
  },
  'inventory-transfers': {
    id: 'inventory-transfers',
    name: 'Transfers',
    icon: ArrowRightLeft,
    path: '/admin/inventory-transfers',
    category: 'Inventory',
    minTier: 'professional',
  },
  'fronted-inventory': {
    id: 'fronted-inventory',
    name: 'Who Owes Me',
    icon: CreditCard,
    path: '/admin/fronted-inventory',
    category: 'Inventory',
    minTier: 'professional',
  },
  'operations': {
    id: 'operations',
    name: 'Receiving & Packaging',
    icon: Warehouse,
    path: '/admin/operations/receiving',
    category: 'Inventory',
    minTier: 'professional',
  },
  'dispatch-inventory': {
    id: 'dispatch-inventory',
    name: 'Dispatch',
    icon: Truck,
    path: '/admin/dispatch-inventory',
    category: 'Inventory',
    minTier: 'enterprise',
  },

  // ==========================================================================
  // CUSTOMERS
  // ==========================================================================
  'customers': {
    id: 'customers',
    name: 'Customers',
    icon: Users,
    path: '/admin/customer-hub?tab=contacts',
    category: 'Customers',
    minTier: 'starter',
  },
  'customer-crm': {
    id: 'customer-crm',
    name: 'CRM',
    icon: Users,
    path: '/admin/customer-hub?tab=crm',
    category: 'Customers',
    minTier: 'professional',
  },
  'crm-invoices': {
    id: 'crm-invoices',
    name: 'Invoices',
    icon: FileText,
    path: '/admin/customer-hub?tab=invoices',
    category: 'Customers',
    minTier: 'professional',
  },
  'customer-insights': {
    id: 'customer-insights',
    name: 'Insights',
    icon: TrendingUp,
    path: '/admin/customer-hub?tab=insights',
    category: 'Customers',
    minTier: 'professional',
  },
  'marketing-automation': {
    id: 'marketing-automation',
    name: 'Marketing',
    icon: Mail,
    path: '/admin/marketing-hub',
    category: 'Customers',
    minTier: 'professional',
  },
  'customer-analytics': {
    id: 'customer-analytics',
    name: 'Customer Analytics',
    icon: BarChart3,
    path: '/admin/customer-hub?tab=analytics',
    category: 'Customers',
    minTier: 'professional',
  },
  'live-chat': {
    id: 'live-chat',
    name: 'Live Chat',
    icon: MessageSquare,
    path: '/admin/live-chat',
    category: 'Customers',
    minTier: 'professional',
  },

  // ==========================================================================
  // OPERATIONS
  // ==========================================================================
  'suppliers': {
    id: 'suppliers',
    name: 'Suppliers',
    icon: Building2,
    path: '/admin/operations-hub?tab=procurement&sub=vendors',
    category: 'Operations',
    minTier: 'starter',
  },
  'purchase-orders': {
    id: 'purchase-orders',
    name: 'Purchase Orders',
    icon: FileText,
    path: '/admin/operations-hub?tab=procurement&sub=purchase-orders',
    category: 'Operations',
    minTier: 'starter',
  },
  'returns': {
    id: 'returns',
    name: 'Returns & Refunds',
    icon: ArrowRightLeft,
    path: '/admin/operations-hub?tab=returns',
    category: 'Operations',
    minTier: 'starter',
  },
  'team-members': {
    id: 'team-members',
    name: 'Team',
    icon: Users,
    path: '/admin/team-members',
    category: 'Operations',
    minTier: 'professional',
  },
  'role-management': {
    id: 'role-management',
    name: 'Roles',
    icon: UserCog,
    path: '/admin/role-management',
    category: 'Operations',
    minTier: 'professional',
  },
  'activity-logs': {
    id: 'activity-logs',
    name: 'Activity Logs',
    icon: ScrollText,
    path: '/admin/activity-logs',
    category: 'Operations',
    minTier: 'professional',
  },
  'quality-control': {
    id: 'quality-control',
    name: 'Quality Control',
    icon: Shield,
    path: '/admin/operations-hub?tab=quality',
    category: 'Operations',
    minTier: 'professional',
  },
  'appointments': {
    id: 'appointments',
    name: 'Appointments',
    icon: Calendar,
    path: '/admin/operations-hub?tab=appointments',
    category: 'Operations',
    minTier: 'professional',
  },
  'support-tickets': {
    id: 'support-tickets',
    name: 'Support Desk',
    icon: Headphones,
    path: '/admin/operations-hub?tab=support',
    category: 'Operations',
    minTier: 'professional',
  },
  'locations': {
    id: 'locations',
    name: 'Locations',
    icon: Building,
    path: '/admin/locations',
    category: 'Operations',
    minTier: 'enterprise',
  },
  'user-management': {
    id: 'user-management',
    name: 'User Management',
    icon: UserCog,
    path: '/admin/team-members',
    category: 'Operations',
    minTier: 'enterprise',
  },
  'permissions': {
    id: 'permissions',
    name: 'Permissions',
    icon: Key,
    path: '/admin/role-management',
    category: 'Operations',
    minTier: 'enterprise',
  },

  // ==========================================================================
  // DELIVERY & FLEET (Enterprise only)
  // ==========================================================================
  'delivery-management': {
    id: 'delivery-management',
    name: 'Delivery',
    icon: Truck,
    path: '/admin/fulfillment-hub',
    category: 'Delivery & Fleet',
    minTier: 'enterprise',
  },
  'fleet-management': {
    id: 'fleet-management',
    name: 'Fleet',
    icon: Building2,
    path: '/admin/fulfillment-hub?tab=fleet',
    category: 'Delivery & Fleet',
    minTier: 'enterprise',
  },
  'couriers': {
    id: 'couriers',
    name: 'Couriers',
    icon: Users,
    path: '/admin/fulfillment-hub?tab=couriers',
    category: 'Delivery & Fleet',
    minTier: 'enterprise',
  },
  'route-optimization': {
    id: 'route-optimization',
    name: 'Route Optimizer',
    icon: MapPinned,
    path: '/admin/fulfillment-hub?tab=routes',
    category: 'Delivery & Fleet',
    minTier: 'enterprise',
  },
  'delivery-tracking': {
    id: 'delivery-tracking',
    name: 'Tracking',
    icon: MapPin,
    path: '/admin/fulfillment-hub?tab=tracking',
    category: 'Delivery & Fleet',
    minTier: 'enterprise',
  },
  'delivery-analytics': {
    id: 'delivery-analytics',
    name: 'Delivery Analytics',
    icon: BarChart3,
    path: '/admin/fulfillment-hub?tab=analytics',
    category: 'Delivery & Fleet',
    minTier: 'enterprise',
  },

  // ==========================================================================
  // POINT OF SALE (Enterprise only)
  // ==========================================================================
  'cash-register': {
    id: 'cash-register',
    name: 'Cash Register',
    icon: Wallet,
    path: '/admin/cash-register',
    category: 'Point of Sale',
    minTier: 'enterprise',
  },
  'pos-analytics': {
    id: 'pos-analytics',
    name: 'POS Analytics',
    icon: PieChart,
    path: '/admin/pos-analytics',
    category: 'Point of Sale',
    minTier: 'enterprise',
  },
  'location-analytics': {
    id: 'location-analytics',
    name: 'Location Analytics',
    icon: MapPin,
    path: '/admin/location-analytics',
    category: 'Point of Sale',
    minTier: 'enterprise',
  },

  // ==========================================================================
  // ANALYTICS & FINANCE
  // ==========================================================================
  'reports': {
    id: 'reports',
    name: 'Reports',
    icon: FileSpreadsheet,
    path: '/admin/reports',
    category: 'Analytics & Finance',
    minTier: 'starter',
  },
  'analytics': {
    id: 'analytics',
    name: 'Analytics',
    icon: BarChart3,
    path: '/admin/analytics-hub',
    category: 'Analytics & Finance',
    minTier: 'professional',
  },
  'revenue-reports': {
    id: 'revenue-reports',
    name: 'Revenue',
    icon: TrendingUp,
    path: '/admin/finance-hub?tab=revenue',
    category: 'Analytics & Finance',
    minTier: 'professional',
  },
  'financial-center': {
    id: 'financial-center',
    name: 'Financial Center',
    icon: Briefcase,
    path: '/admin/finance-hub',
    category: 'Analytics & Finance',
    minTier: 'professional',
  },
  'invoice-management': {
    id: 'invoice-management',
    name: 'Invoice Management',
    icon: Receipt,
    path: '/admin/advanced-invoice',
    category: 'Analytics & Finance',
    minTier: 'professional',
  },
  'commission-tracking': {
    id: 'commission-tracking',
    name: 'Commissions',
    icon: DollarSign,
    path: '/admin/commission-tracking',
    category: 'Analytics & Finance',
    minTier: 'professional',
  },
  'expense-tracking': {
    id: 'expense-tracking',
    name: 'Expenses',
    icon: Receipt,
    path: '/admin/finance-hub?tab=expenses',
    category: 'Analytics & Finance',
    minTier: 'professional',
  },
  'menu-analytics': {
    id: 'menu-analytics',
    name: 'Menu Analytics',
    icon: BarChart3,
    path: '/admin/menu-analytics',
    category: 'Analytics & Finance',
    minTier: 'professional',
  },
  'order-analytics': {
    id: 'order-analytics',
    name: 'Order Analytics',
    icon: PieChart,
    path: '/admin/order-analytics',
    category: 'Analytics & Finance',
    minTier: 'professional',
  },
  'advanced-reporting': {
    id: 'advanced-reporting',
    name: 'Advanced Reporting',
    icon: BarChart3,
    path: '/admin/advanced-reporting',
    category: 'Analytics & Finance',
    minTier: 'professional',
  },
  'predictive-analytics': {
    id: 'predictive-analytics',
    name: 'Forecasting',
    icon: Brain,
    path: '/admin/analytics-hub?tab=forecasting',
    category: 'Analytics & Finance',
    minTier: 'professional',
  },
  'advanced-analytics': {
    id: 'advanced-analytics',
    name: 'AI Analytics',
    icon: Brain,
    path: '/admin/advanced-analytics',
    category: 'Analytics & Finance',
    minTier: 'enterprise',
  },
  'custom-reports': {
    id: 'custom-reports',
    name: 'Custom Reports',
    icon: FileText,
    path: '/admin/custom-reports',
    category: 'Analytics & Finance',
    minTier: 'enterprise',
  },
  'data-export': {
    id: 'data-export',
    name: 'Data Warehouse',
    icon: Download,
    path: '/admin/data-export',
    category: 'Analytics & Finance',
    minTier: 'enterprise',
  },
  'risk-management': {
    id: 'risk-management',
    name: 'Risk Management',
    icon: Shield,
    path: '/admin/risk-management',
    category: 'Analytics & Finance',
    minTier: 'enterprise',
  },

  // ==========================================================================
  // INTEGRATIONS
  // ==========================================================================
  'bulk-operations': {
    id: 'bulk-operations',
    name: 'Bulk Operations',
    icon: FolderKanban,
    path: '/admin/bulk-operations',
    category: 'Integrations',
    minTier: 'professional',
  },
  'vendor-portal': {
    id: 'vendor-portal',
    name: 'Vendor Portal',
    icon: Building2,
    path: '/vendor/dashboard',
    category: 'Integrations',
    minTier: 'professional',
  },
  'api-access': {
    id: 'api-access',
    name: 'API & Webhooks',
    icon: Zap,
    path: '/admin/api-access',
    category: 'Integrations',
    minTier: 'enterprise',
  },
  'webhooks': {
    id: 'webhooks',
    name: 'Webhooks',
    icon: Activity,
    path: '/admin/webhooks',
    category: 'Integrations',
    minTier: 'enterprise',
  },
  'custom-integrations': {
    id: 'custom-integrations',
    name: 'Integrations',
    icon: Zap,
    path: '/admin/custom-integrations',
    category: 'Integrations',
    minTier: 'enterprise',
  },
  'automation': {
    id: 'automation',
    name: 'Workflows',
    icon: Zap,
    path: '/admin/workflow-automation',
    category: 'Integrations',
    minTier: 'enterprise',
  },
  'ai': {
    id: 'ai',
    name: 'Local AI',
    icon: Brain,
    path: '/admin/local-ai',
    category: 'Integrations',
    minTier: 'enterprise',
  },

  // ==========================================================================
  // SECURITY & COMPLIANCE
  // ==========================================================================
  'batch-recall': {
    id: 'batch-recall',
    name: 'Batch Recall',
    icon: AlertCircle,
    path: '/admin/operations-hub?tab=batch-recall',
    category: 'Security & Compliance',
    minTier: 'professional',
  },
  'compliance-vault': {
    id: 'compliance-vault',
    name: 'Compliance Vault',
    icon: FileText,
    path: '/admin/operations-hub?tab=vault',
    category: 'Security & Compliance',
    minTier: 'professional',
  },
  'audit-trail': {
    id: 'audit-trail',
    name: 'Audit Logs',
    icon: ScrollText,
    path: '/admin/audit-trail',
    category: 'Security & Compliance',
    minTier: 'enterprise',
  },
  'compliance': {
    id: 'compliance',
    name: 'Compliance',
    icon: Shield,
    path: '/admin/operations-hub?tab=compliance',
    category: 'Security & Compliance',
    minTier: 'enterprise',
  },

  // ==========================================================================
  // SETTINGS
  // ==========================================================================
  'settings': {
    id: 'settings',
    name: 'Settings',
    icon: Settings,
    path: '/admin/settings',
    category: 'Settings',
    minTier: 'starter',
  },
  'billing': {
    id: 'billing',
    name: 'Billing',
    icon: CreditCard,
    path: '/admin/settings?tab=payments',
    category: 'Settings',
    minTier: 'starter',
  },
  'help': {
    id: 'help',
    name: 'Help & Support',
    icon: HelpCircle,
    path: '/admin/help-hub',
    category: 'Settings',
    minTier: 'starter',
  },
  'white-label': {
    id: 'white-label',
    name: 'White Label',
    icon: Layers,
    path: '/admin/white-label',
    category: 'Settings',
    minTier: 'enterprise',
  },
  'custom-domain': {
    id: 'custom-domain',
    name: 'Custom Domain',
    icon: Globe,
    path: '/admin/custom-domain',
    category: 'Settings',
    minTier: 'enterprise',
  },
  'system-settings': {
    id: 'system-settings',
    name: 'System Settings',
    icon: Settings,
    path: '/admin/system-settings',
    category: 'Settings',
    minTier: 'enterprise',
  },
  'priority-support': {
    id: 'priority-support',
    name: 'Enterprise Support',
    icon: Headphones,
    path: '/admin/priority-support',
    category: 'Settings',
    minTier: 'enterprise',
  },
};

/**
 * Essential features that cannot be hidden
 */
export const ESSENTIAL_FEATURES = ['dashboard', 'hotbox', 'settings', 'billing', 'help'];

/**
 * Get a feature definition by ID
 */
export function getFeature(id: string): FeatureDef | undefined {
  return FEATURE_REGISTRY[id];
}

/**
 * Get all feature definitions
 */
export function getAllFeatures(): FeatureDef[] {
  return Object.values(FEATURE_REGISTRY);
}

/**
 * Get features by category
 */
export function getFeaturesByCategory(category: string): FeatureDef[] {
  return getAllFeatures().filter(f => f.category === category);
}

/**
 * Get features by minimum tier
 */
export function getFeaturesByTier(tier: SubscriptionTier): FeatureDef[] {
  const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
  const tierIndex = tierHierarchy.indexOf(tier);

  return getAllFeatures().filter(f => {
    const featureTierIndex = tierHierarchy.indexOf(f.minTier);
    return featureTierIndex <= tierIndex;
  });
}

/**
 * Check if a feature is accessible for a given tier
 */
export function isFeatureAccessible(featureId: string, currentTier: SubscriptionTier): boolean {
  const feature = FEATURE_REGISTRY[featureId];
  if (!feature) return false;

  const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
  const currentTierIndex = tierHierarchy.indexOf(currentTier);
  const requiredTierIndex = tierHierarchy.indexOf(feature.minTier);

  return currentTierIndex >= requiredTierIndex;
}
