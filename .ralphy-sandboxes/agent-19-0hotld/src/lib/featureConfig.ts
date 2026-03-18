/**
 * Feature Configuration & Tier Management
 * 
 * SINGLE SOURCE OF TRUTH for all features and subscription tiers.
 * 
 * Pricing:
 * - Starter ($79/mo): Core features for solo operators - 20 features
 * - Professional ($150/mo): Team & analytics for growing businesses - 35 additional = 55 total
 * - Enterprise ($499/mo): Full platform for large operations - 32 additional = 87 total
 */

export type SubscriptionTier = 'starter' | 'professional' | 'enterprise';

export interface Feature {
  id: string;
  name: string;
  description: string;
  tier: SubscriptionTier;
  category: FeatureCategory;
  route: string;
  icon?: string;
}

// Standardized categories matching sidebar structure
export type FeatureCategory =
  | 'Command Center'
  | 'Sales & Orders'
  | 'Menus'
  | 'Inventory'
  | 'Customers'
  | 'Operations'
  | 'Analytics & Finance'
  | 'Delivery & Fleet'
  | 'Point of Sale'
  | 'Integrations'
  | 'Security & Compliance'
  | 'Settings';

export const TIER_PRICES = {
  starter: 79,
  professional: 150,
  enterprise: 499,
} as const;

export const TIER_NAMES = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
} as const;

export const TIER_TAGLINES = {
  starter: 'Run Your Business',
  professional: 'Scale Your Operation',
  enterprise: 'Dominate Your Market',
} as const;

// Category display order for sidebar
export const CATEGORY_ORDER: FeatureCategory[] = [
  'Command Center',
  'Sales & Orders',
  'Menus',
  'Inventory',
  'Customers',
  'Operations',
  'Analytics & Finance',
  'Delivery & Fleet',
  'Point of Sale',
  'Integrations',
  'Security & Compliance',
  'Settings',
];

/**
 * =============================================================================
 * FEATURE DEFINITIONS
 * =============================================================================
 * Organized by tier, then by category within each tier.
 * Each higher tier includes all features from lower tiers.
 */

export const FEATURES = {
  // ==========================================================================
  // STARTER TIER ($79/mo) - 20 Core Features
  // ==========================================================================

  // --- Command Center (Starter) ---
  'dashboard': {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Overview of your business metrics and key performance indicators',
    tier: 'starter',
    category: 'Command Center',
    route: '/admin/dashboard',
  },
  'hotbox': {
    id: 'hotbox',
    name: 'Hotbox',
    description: 'Quick action command center for daily operations',
    tier: 'starter',
    category: 'Command Center',
    route: '/admin/hotbox',
  },

  // --- Sales & Orders (Starter) ---
  'basic-orders': {
    id: 'basic-orders',
    name: 'Orders',
    description: 'View and manage customer orders',
    tier: 'starter',
    category: 'Sales & Orders',
    route: '/admin/orders?tab=menu',
  },
  // --- Menus (Starter) ---
  'disposable-menus': {
    id: 'disposable-menus',
    name: 'Menus',
    description: 'Create and share disposable menus with customers',
    tier: 'starter',
    category: 'Menus',
    route: '/admin/disposable-menus',
  },
  'wholesale-orders': {
    id: 'wholesale-orders',
    name: 'Wholesale Orders',
    description: 'Manage bulk B2B orders',
    tier: 'starter',
    category: 'Sales & Orders',
    route: '/admin/orders?tab=wholesale',
  },
  'wholesale-pricing-tiers': {
    id: 'wholesale-pricing-tiers',
    name: 'Pricing Tiers',
    description: 'Configure wholesale pricing levels and discounts',
    tier: 'starter',
    category: 'Sales & Orders',
    route: '/admin/wholesale-pricing-tiers',
  },
  'loyalty-program': {
    id: 'loyalty-program',
    name: 'Loyalty Program',
    description: 'Configure rewards, earning rules, and track customer loyalty',
    tier: 'starter',
    category: 'Sales & Orders',
    route: '/admin/loyalty-program',
  },
  'coupons': {
    id: 'coupons',
    name: 'Coupons',
    description: 'Create and manage discount coupons and promotions',
    tier: 'starter',
    category: 'Sales & Orders',
    route: '/admin/coupons',
  },

  // --- Inventory (Starter) ---
  'products': {
    id: 'products',
    name: 'Products',
    description: 'Manage your product catalog',
    tier: 'starter',
    category: 'Inventory',
    route: '/admin/inventory-hub?tab=products',
  },
  'inventory-dashboard': {
    id: 'inventory-dashboard',
    name: 'Stock Levels',
    description: 'Overview of inventory levels and stock status',
    tier: 'starter',
    category: 'Inventory',
    route: '/admin/inventory-hub?tab=stock',
  },
  'stock-alerts': {
    id: 'stock-alerts',
    name: 'Stock Alerts',
    description: 'Low stock notifications and reorder reminders',
    tier: 'starter',
    category: 'Inventory',
    route: '/admin/stock-alerts',
  },
  'generate-barcodes': {
    id: 'generate-barcodes',
    name: 'Barcodes',
    description: 'Generate and print product barcodes',
    tier: 'starter',
    category: 'Inventory',
    route: '/admin/generate-barcodes',
  },

  // --- Customers (Starter) ---
  'customers': {
    id: 'customers',
    name: 'Customers',
    description: 'Basic customer list and contact management',
    tier: 'starter',
    category: 'Customers',
    route: '/admin/customer-hub',
  },

  // --- Operations (Starter) ---
  'suppliers': {
    id: 'suppliers',
    name: 'Suppliers',
    description: 'Manage supplier contacts and relationships',
    tier: 'starter',
    category: 'Operations',
    route: '/admin/suppliers',
  },
  'purchase-orders': {
    id: 'purchase-orders',
    name: 'Purchase Orders',
    description: 'Create and track purchase orders from suppliers',
    tier: 'starter',
    category: 'Operations',
    route: '/admin/purchase-orders',
  },
  'returns': {
    id: 'returns',
    name: 'Returns & Refunds',
    description: 'Manage product returns, refunds, and exchanges',
    tier: 'starter',
    category: 'Operations',
    route: '/admin/returns',
  },

  // --- Analytics & Finance (Starter) ---
  'reports': {
    id: 'reports',
    name: 'Reports',
    description: 'Basic sales and inventory reports',
    tier: 'starter',
    category: 'Analytics & Finance',
    route: '/admin/reports',
  },

  // --- Settings (Starter) ---
  'settings': {
    id: 'settings',
    name: 'Settings',
    description: 'Account and business settings',
    tier: 'starter',
    category: 'Settings',
    route: '/admin/settings',
  },
  'billing': {
    id: 'billing',
    name: 'Billing',
    description: 'Subscription and payment management',
    tier: 'starter',
    category: 'Settings',
    route: '/admin/billing',
  },
  'help': {
    id: 'help',
    name: 'Help & Support',
    description: 'Documentation and support resources',
    tier: 'starter',
    category: 'Settings',
    route: '/admin/help',
  },

  // ==========================================================================
  // PROFESSIONAL TIER ($150/mo) - 35 Additional Features
  // ==========================================================================

  // --- Command Center (Professional) ---
  'live-orders': {
    id: 'live-orders',
    name: 'Live Orders',
    description: 'Real-time order monitoring and status updates',
    tier: 'professional',
    category: 'Command Center',
    route: '/admin/orders?tab=live',
  },
  'notifications': {
    id: 'notifications',
    name: 'Notifications',
    description: 'Email & SMS alert management',
    tier: 'professional',
    category: 'Command Center',
    route: '/admin/notifications',
  },

  // --- sales & Orders / Menus ---
  'menu-migration': {
    id: 'menu-migration',
    name: 'Menu Migration',
    description: 'AI-powered bulk import from spreadsheets and images',
    tier: 'starter',
    category: 'Menus',
    route: '/admin/menu-migration',
  },
  'marketplace': {
    id: 'marketplace',
    name: 'Marketplace',
    description: 'List products on B2B marketplace and manage wholesale buyers',
    tier: 'professional',
    category: 'Sales & Orders',
    route: '/admin/marketplace/listings',
  },
  'marketplace-product-sync': {
    id: 'marketplace-product-sync',
    name: 'Product Sync',
    description: 'Sync B2B products to Marketplace listings',
    tier: 'professional',
    category: 'Sales & Orders',
    route: '/admin/marketplace/sync',
  },
  'sales-dashboard': {
    id: 'sales-dashboard',
    name: 'Deals & Pricing',
    description: 'Sales metrics, revenue trends, and pricing strategy',
    tier: 'professional',
    category: 'Sales & Orders',
    route: '/admin/sales-dashboard',
  },
  'storefront': {
    id: 'storefront',
    name: 'Storefront',
    description: 'Manage your white-label online store with products, orders, and customers',
    tier: 'professional',
    category: 'Sales & Orders',
    route: '/admin/storefront-hub',
  },

  // --- Inventory (Professional) ---
  'advanced-inventory': {
    id: 'advanced-inventory',
    name: 'Advanced Inventory',
    description: 'Full inventory management with tracking and history',
    tier: 'professional',
    category: 'Inventory',
    route: '/admin/inventory-hub?tab=adjustments',
  },
  'inventory-transfers': {
    id: 'inventory-transfers',
    name: 'Transfers',
    description: 'Move stock between locations',
    tier: 'professional',
    category: 'Inventory',
    route: '/admin/inventory-transfers',
  },
  'fronted-inventory': {
    id: 'fronted-inventory',
    name: 'Who Owes Me',
    description: 'Track fronted products and outstanding debts',
    tier: 'professional',
    category: 'Inventory',
    route: '/admin/fronted-inventory',
  },
  'operations': {
    id: 'operations',
    name: 'Receiving & Packaging',
    description: 'Manage product receiving and packaging operations',
    tier: 'professional',
    category: 'Inventory',
    route: '/admin/operations/receiving',
  },

  // --- Customers (Professional) ---
  'customer-crm': {
    id: 'customer-crm',
    name: 'CRM',
    description: 'Customer lifecycle, RFM analysis, and segmentation',
    tier: 'professional',
    category: 'Customers',
    route: '/admin/customer-hub?tab=crm',
  },
  'crm-invoices': {
    id: 'crm-invoices',
    name: 'Invoices',
    description: 'Create and manage customer invoices',
    tier: 'professional',
    category: 'Customers',
    route: '/admin/crm/invoices',
  },
  'customer-insights': {
    id: 'customer-insights',
    name: 'Insights',
    description: 'Customer behavior, segments, and lifetime value analysis',
    tier: 'professional',
    category: 'Customers',
    route: '/admin/customer-hub?tab=insights',
  },
  'marketing-automation': {
    id: 'marketing-automation',
    name: 'Marketing',
    description: 'Create campaigns, automate workflows, and track engagement',
    tier: 'professional',
    category: 'Customers',
    route: '/admin/marketing-automation',
  },
  'customer-analytics': {
    id: 'customer-analytics',
    name: 'Customer Analytics',
    description: 'Customer behavior insights and trends',
    tier: 'professional',
    category: 'Customers',
    route: '/admin/customer-hub?tab=analytics',
  },
  'live-chat': {
    id: 'live-chat',
    name: 'Live Chat',
    description: 'Real-time customer support chat',
    tier: 'professional',
    category: 'Customers',
    route: '/admin/live-chat',
  },

  // --- Operations (Professional) ---
  'team-members': {
    id: 'team-members',
    name: 'Team',
    description: 'Manage staff and permissions',
    tier: 'professional',
    category: 'Operations',
    route: '/admin/team-members',
  },
  'role-management': {
    id: 'role-management',
    name: 'Roles',
    description: 'Configure user roles and access levels',
    tier: 'professional',
    category: 'Operations',
    route: '/admin/role-management',
  },
  'activity-logs': {
    id: 'activity-logs',
    name: 'Activity Logs',
    description: 'Audit team actions and changes',
    tier: 'professional',
    category: 'Operations',
    route: '/admin/activity-logs',
  },
  'quality-control': {
    id: 'quality-control',
    name: 'Quality Control',
    description: 'Manage COAs, test results, and compliance',
    tier: 'professional',
    category: 'Operations',
    route: '/admin/quality-control',
  },
  'appointments': {
    id: 'appointments',
    name: 'Appointments',
    description: 'Schedule customer appointments and consultations',
    tier: 'professional',
    category: 'Operations',
    route: '/admin/appointments',
  },
  'support-tickets': {
    id: 'support-tickets',
    name: 'Support Desk',
    description: 'Manage customer support requests and tickets',
    tier: 'professional',
    category: 'Operations',
    route: '/admin/support-tickets',
  },

  // --- Analytics & Finance (Professional) ---
  'analytics': {
    id: 'analytics',
    name: 'Analytics',
    description: 'Comprehensive business analytics dashboard',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/analytics-hub',
  },
  'revenue-reports': {
    id: 'revenue-reports',
    name: 'Revenue',
    description: 'Financial performance and revenue analysis',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/finance-hub?tab=revenue',
  },
  'financial-center': {
    id: 'financial-center',
    name: 'Financial Center',
    description: 'Cash flow, P&L, and financial management',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/finance-hub',
  },
  'collections': {
    id: 'collections',
    name: 'Collections',
    description: 'Manage outstanding payments and collections',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/collection-mode',
  },
  'invoice-management': {
    id: 'invoice-management',
    name: 'Invoice Management',
    description: 'Create and manage professional invoices',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/advanced-invoice',
  },
  'commission-tracking': {
    id: 'commission-tracking',
    name: 'Commissions',
    description: 'Track and manage team commissions',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/commission-tracking',
  },
  'expense-tracking': {
    id: 'expense-tracking',
    name: 'Expenses',
    description: 'Track and categorize business expenses',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/finance-hub?tab=expenses',
  },
  'menu-analytics': {
    id: 'menu-analytics',
    name: 'Menu Analytics',
    description: 'Menu performance and product insights',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/analytics-hub?tab=menu',
  },
  'order-analytics': {
    id: 'order-analytics',
    name: 'Order Analytics',
    description: 'Order trends, patterns, and performance',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/analytics-hub?tab=orders',
  },
  'advanced-reporting': {
    id: 'advanced-reporting',
    name: 'Advanced Reporting',
    description: 'Build custom reports and schedule automated delivery',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/advanced-reporting',
  },
  'predictive-analytics': {
    id: 'predictive-analytics',
    name: 'Forecasting',
    description: 'AI-powered demand forecasting and predictions',
    tier: 'professional',
    category: 'Analytics & Finance',
    route: '/admin/predictive-analytics',
  },

  // --- Security & Compliance (Professional) ---
  'batch-recall': {
    id: 'batch-recall',
    name: 'Batch Recall',
    description: 'Manage product recalls and traceability',
    tier: 'professional',
    category: 'Security & Compliance',
    route: '/admin/batch-recall',
  },
  'compliance-vault': {
    id: 'compliance-vault',
    name: 'Compliance Vault',
    description: 'Document management and compliance tracking',
    tier: 'professional',
    category: 'Security & Compliance',
    route: '/admin/compliance-vault',
  },

  // --- Integrations (Professional) ---
  'bulk-operations': {
    id: 'bulk-operations',
    name: 'Bulk Operations',
    description: 'Mass update products, prices, and inventory',
    tier: 'professional',
    category: 'Integrations',
    route: '/admin/integrations-hub?tab=bulk',
  },
  'vendor-portal': {
    id: 'vendor-portal',
    name: 'Vendor Portal',
    description: 'External portal for vendors to manage POs and invoices',
    tier: 'professional',
    category: 'Integrations',
    route: '/vendor/dashboard',
  },

  // ==========================================================================
  // ENTERPRISE TIER ($499/mo) - 32 Additional Features
  // ==========================================================================

  // --- Command Center (Enterprise) ---
  'realtime-dashboard': {
    id: 'realtime-dashboard',
    name: 'Real-Time Monitor',
    description: 'Live business metrics and operational status',
    tier: 'enterprise',
    category: 'Command Center',
    route: '/admin/realtime-dashboard',
  },
  'live-map': {
    id: 'live-map',
    name: 'Live Map',
    description: 'Real-time driver and delivery tracking map',
    tier: 'enterprise',
    category: 'Command Center',
    route: '/admin/live-map',
  },

  // --- Sales & Orders (Enterprise) ---
  'pos-system': {
    id: 'pos-system',
    name: 'POS Register',
    description: 'Point of sale interface for in-person transactions',
    tier: 'enterprise',
    category: 'Sales & Orders',
    route: '/admin/pos-system',
  },

  // --- Inventory (Enterprise) ---
  'dispatch-inventory': {
    id: 'dispatch-inventory',
    name: 'Dispatch',
    description: 'Manage outbound inventory and delivery assignments',
    tier: 'enterprise',
    category: 'Inventory',
    route: '/admin/dispatch-inventory',
  },
  'vendor-management': {
    id: 'vendor-management',
    name: 'Vendor Management',
    description: 'Advanced supplier relationship management',
    tier: 'enterprise',
    category: 'Inventory',
    route: '/admin/vendor-management',
  },

  // --- Operations (Enterprise) ---
  'locations': {
    id: 'locations',
    name: 'Locations',
    description: 'Multi-location and warehouse management',
    tier: 'enterprise',
    category: 'Operations',
    route: '/admin/locations',
  },
  'user-management': {
    id: 'user-management',
    name: 'User Management',
    description: 'Advanced user controls and access management',
    tier: 'enterprise',
    category: 'Operations',
    route: '/admin/user-management',
  },
  'permissions': {
    id: 'permissions',
    name: 'Permissions',
    description: 'Granular role-based access control',
    tier: 'enterprise',
    category: 'Operations',
    route: '/admin/permissions',
  },

  // --- Delivery & Fleet (Enterprise) ---
  'delivery-management': {
    id: 'delivery-management',
    name: 'Delivery',
    description: 'Coordinate deliveries and driver assignments',
    tier: 'enterprise',
    category: 'Delivery & Fleet',
    route: '/admin/fulfillment-hub?tab=dashboard',
  },
  'fleet-management': {
    id: 'fleet-management',
    name: 'Fleet',
    description: 'Manage delivery vehicles and fleet operations',
    tier: 'enterprise',
    category: 'Delivery & Fleet',
    route: '/admin/fulfillment-hub?tab=fleet',
  },
  'couriers': {
    id: 'couriers',
    name: 'Couriers',
    description: 'Manage delivery drivers and couriers',
    tier: 'enterprise',
    category: 'Delivery & Fleet',
    route: '/admin/fulfillment-hub?tab=couriers',
  },
  'route-optimization': {
    id: 'route-optimization',
    name: 'Route Optimizer',
    description: 'AI-powered delivery route planning',
    tier: 'enterprise',
    category: 'Delivery & Fleet',
    route: '/admin/fulfillment-hub?tab=routes',
  },
  'delivery-tracking': {
    id: 'delivery-tracking',
    name: 'Tracking',
    description: 'Track individual delivery status and ETAs',
    tier: 'enterprise',
    category: 'Delivery & Fleet',
    route: '/admin/fulfillment-hub?tab=tracking',
  },
  'delivery-analytics': {
    id: 'delivery-analytics',
    name: 'Delivery Analytics',
    description: 'Delivery performance metrics and optimization',
    tier: 'enterprise',
    category: 'Delivery & Fleet',
    route: '/admin/fulfillment-hub?tab=analytics',
  },

  // --- Point of Sale (Enterprise) ---
  'cash-register': {
    id: 'cash-register',
    name: 'Cash Register',
    description: 'Manage cash transactions and drawer counts',
    tier: 'enterprise',
    category: 'Point of Sale',
    route: '/admin/cash-register',
  },
  'pos-analytics': {
    id: 'pos-analytics',
    name: 'POS Analytics',
    description: 'Point of sale performance insights',
    tier: 'enterprise',
    category: 'Point of Sale',
    route: '/admin/pos-analytics',
  },
  'location-analytics': {
    id: 'location-analytics',
    name: 'Location Analytics',
    description: 'Per-location performance analysis',
    tier: 'enterprise',
    category: 'Point of Sale',
    route: '/admin/location-analytics',
  },

  // --- Analytics & Finance (Enterprise) ---
  'advanced-analytics': {
    id: 'advanced-analytics',
    name: 'AI Analytics',
    description: 'AI-powered predictive analytics and insights',
    tier: 'enterprise',
    category: 'Analytics & Finance',
    route: '/admin/advanced-analytics',
  },
  'custom-reports': {
    id: 'custom-reports',
    name: 'Custom Reports',
    description: 'Build and schedule custom report templates',
    tier: 'enterprise',
    category: 'Analytics & Finance',
    route: '/admin/custom-reports',
  },
  'data-export': {
    id: 'data-export',
    name: 'Data Warehouse',
    description: 'Export data to Excel, CSV, PDF, and external systems',
    tier: 'enterprise',
    category: 'Analytics & Finance',
    route: '/admin/data-export',
  },
  'risk-management': {
    id: 'risk-management',
    name: 'Risk Management',
    description: 'Identify and manage business risks',
    tier: 'enterprise',
    category: 'Analytics & Finance',
    route: '/admin/risk-management',
  },

  // --- Integrations (Enterprise) ---
  'api-access': {
    id: 'api-access',
    name: 'API & Webhooks',
    description: 'Developer API access and webhook integrations',
    tier: 'enterprise',
    category: 'Integrations',
    route: '/admin/integrations-hub',
  },
  'webhooks': {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Real-time event notifications to external systems',
    tier: 'enterprise',
    category: 'Integrations',
    route: '/admin/integrations-hub?tab=webhooks',
  },
  'custom-integrations': {
    id: 'custom-integrations',
    name: 'Integrations',
    description: 'Connect third-party apps and services',
    tier: 'enterprise',
    category: 'Integrations',
    route: '/admin/custom-integrations',
  },
  'automation': {
    id: 'automation',
    name: 'Workflows',
    description: 'Automate business workflows and processes',
    tier: 'enterprise',
    category: 'Integrations',
    route: '/admin/integrations-hub?tab=automation',
  },
  'ai': {
    id: 'ai',
    name: 'Local AI',
    description: 'On-premise AI processing and ML capabilities',
    tier: 'enterprise',
    category: 'Integrations',
    route: '/admin/local-ai',
  },

  // --- Security & Compliance (Enterprise) ---
  'audit-trail': {
    id: 'audit-trail',
    name: 'Audit Logs',
    description: 'Complete action history and audit trail',
    tier: 'enterprise',
    category: 'Security & Compliance',
    route: '/admin/audit-trail',
  },
  'compliance': {
    id: 'compliance',
    name: 'Compliance',
    description: 'Regulatory compliance tools and reporting',
    tier: 'enterprise',
    category: 'Security & Compliance',
    route: '/admin/compliance',
  },

  // --- Settings (Enterprise) ---
  'white-label': {
    id: 'white-label',
    name: 'White Label',
    description: 'Custom branding and white-label options',
    tier: 'enterprise',
    category: 'Settings',
    route: '/admin/white-label',
  },
  'custom-domain': {
    id: 'custom-domain',
    name: 'Custom Domain',
    description: 'Use your own custom domain',
    tier: 'enterprise',
    category: 'Settings',
    route: '/admin/custom-domain',
  },
  'system-settings': {
    id: 'system-settings',
    name: 'System Settings',
    description: 'Advanced system configuration',
    tier: 'enterprise',
    category: 'Settings',
    route: '/admin/system-settings',
  },
  'priority-support': {
    id: 'priority-support',
    name: 'Enterprise Support',
    description: '24/7 priority support with dedicated account manager',
    tier: 'enterprise',
    category: 'Settings',
    route: '/admin/priority-support',
  },
} satisfies Record<string, Feature>;

// Derived from FEATURES so invalid IDs fail at compile-time
export type FeatureId = keyof typeof FEATURES;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all features available for a specific tier (includes all lower tier features)
 */
export function getFeaturesForTier(tier: SubscriptionTier): Feature[] {
  const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
  const tierIndex = tierHierarchy.indexOf(tier);

  return Object.values(FEATURES).filter(feature => {
    const featureTierIndex = tierHierarchy.indexOf(feature.tier);
    return featureTierIndex <= tierIndex;
  });
}

/**
 * Check if a tier has access to a specific feature
 */
export function hasFeatureAccess(currentTier: SubscriptionTier, featureId: FeatureId): boolean {
  const feature = FEATURES[featureId];
  if (!feature) return false;

  const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
  const currentTierIndex = tierHierarchy.indexOf(currentTier);
  const requiredTierIndex = tierHierarchy.indexOf(feature.tier);

  return currentTierIndex >= requiredTierIndex;
}

/**
 * Get the minimum required tier for a feature
 */
export function getRequiredTier(featureId: FeatureId): SubscriptionTier | null {
  return FEATURES[featureId]?.tier || null;
}

/**
 * Get upgrade requirement info for a locked feature
 */
export function getUpgradeRequirement(currentTier: SubscriptionTier, featureId: FeatureId): {
  required: boolean;
  targetTier: SubscriptionTier | null;
  priceDifference: number;
} {
  const feature = FEATURES[featureId];
  if (!feature) {
    return { required: true, targetTier: null, priceDifference: 0 };
  }

  const hasAccess = hasFeatureAccess(currentTier, featureId);

  if (hasAccess) {
    return { required: false, targetTier: null, priceDifference: 0 };
  }

  const targetTier = feature.tier;
  const priceDifference = TIER_PRICES[targetTier] - TIER_PRICES[currentTier];

  return { required: true, targetTier, priceDifference };
}

/**
 * Get features grouped by category for a specific tier
 */
export function getFeaturesByCategory(tier?: SubscriptionTier): Record<string, Feature[]> {
  const features = tier ? getFeaturesForTier(tier) : Object.values(FEATURES);

  return features.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>);
}

/**
 * Get features grouped by category, ordered by CATEGORY_ORDER
 */
export function getFeaturesByCategoryOrdered(tier?: SubscriptionTier): Array<{ category: FeatureCategory; features: Feature[] }> {
  const grouped = getFeaturesByCategory(tier);

  return CATEGORY_ORDER
    .filter(cat => grouped[cat]?.length > 0)
    .map(cat => ({
      category: cat,
      features: grouped[cat] ?? [],
    }));
}

/**
 * Get feature counts by tier
 */
export function getFeatureCountsByTier(): Record<SubscriptionTier, number> {
  return {
    starter: getFeaturesForTier('starter').length,
    professional: getFeaturesForTier('professional').length,
    enterprise: getFeaturesForTier('enterprise').length,
  };
}

/**
 * Essential features that are always accessible (billing, settings, dashboard)
 */
export const ESSENTIAL_FEATURES: FeatureId[] = [
  'dashboard',
  'hotbox',
  'settings',
  'billing',
  'help',
];

/**
 * Check if a feature is essential (always accessible)
 */
export function isEssentialFeature(featureId: FeatureId): boolean {
  return ESSENTIAL_FEATURES.includes(featureId);
}
