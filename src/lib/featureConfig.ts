/**
 * Feature Configuration & Tier Management
 * Maps all 56 admin features to subscription tiers
 */

export type SubscriptionTier = 'starter' | 'professional' | 'enterprise';
export type FeatureId = string;

export interface Feature {
  id: FeatureId;
  name: string;
  description: string;
  tier: SubscriptionTier;
  category: string;
  route: string;
  icon?: string;
}

export const TIER_PRICES = {
  starter: 79,
  professional: 150,
  enterprise: 499,
} as const;

export const TIER_NAMES = {
  starter: 'Basic',
  professional: 'Professional',
  enterprise: 'Enterprise',
} as const;

// All 87 features organized by tier and category
export const FEATURES: Record<FeatureId, Feature> = {
  // ===== BASIC TIER (28 features) =====
  'dashboard': {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Overview of your business metrics',
    tier: 'starter',
    category: 'Core',
    route: '/admin/dashboard',
  },
  'products': {
    id: 'products',
    name: 'Products',
    description: 'Manage your product catalog',
    tier: 'starter',
    category: 'Inventory',
    route: '/admin/inventory/products',
  },
  'disposable-menus': {
    id: 'disposable-menus',
    name: 'Disposable Menus',
    description: 'Create shareable menus',
    tier: 'starter',
    category: 'Menus',
    route: '/admin/disposable-menus',
  },
  'customers': {
    id: 'customers',
    name: 'Customers',
    description: 'Customer management',
    tier: 'starter',
    category: 'Customers',
    route: '/admin/big-plug-clients',
  },
  'basic-orders': {
    id: 'basic-orders',
    name: 'Orders',
    description: 'View basic order information',
    tier: 'starter',
    category: 'Orders',
    route: '/admin/disposable-menu-orders',
  },
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
  'suppliers': {
    id: 'suppliers',
    name: 'Suppliers',
    description: 'Manage suppliers and track performance',
    tier: 'starter',
    category: 'Financial',
    route: '/admin/suppliers',
  },
  'purchase-orders': {
    id: 'purchase-orders',
    name: 'Purchase Orders',
    description: 'Create and manage purchase orders from suppliers',
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
  'loyalty-program': {
    id: 'loyalty-program',
    name: 'Loyalty Program',
    description: 'Configure earning rules, manage rewards, and track customer loyalty',
    tier: 'starter',
    category: 'Sales',
    route: '/admin/loyalty-program',
  },
  'coupons': {
    id: 'coupons',
    name: 'Coupons',
    description: 'Create and manage discount coupons and promotions',
    tier: 'starter',
    category: 'Sales',
    route: '/admin/coupons',
  },
  'quality-control': {
    id: 'quality-control',
    name: 'Quality Control',
    description: 'Manage COAs, track test results, and ensure compliance',
    tier: 'professional',
    category: 'Compliance',
    route: '/admin/quality-control',
  },
  'customer-crm': {
    id: 'customer-crm',
    name: 'Advanced CRM',
    description: 'Customer lifecycle, RFM analysis, segmentation, and communication timeline',
    tier: 'professional',
    category: 'Customers',
    route: '/admin/customer-crm',
  },
  'marketing-automation': {
    id: 'marketing-automation',
    name: 'Marketing Automation',
    description: 'Create campaigns, automate workflows, and track engagement',
    tier: 'professional',
    category: 'Marketing',
    route: '/admin/marketing-automation',
  },
  'appointments': {
    id: 'appointments',
    name: 'Appointment Scheduling',
    description: 'Manage customer appointments, consultations, and deliveries',
    tier: 'professional',
    category: 'Operations',
    route: '/admin/appointments',
  },
  'support-tickets': {
    id: 'support-tickets',
    name: 'Support Ticket Management',
    description: 'Manage customer support requests and track resolution',
    tier: 'professional',
    category: 'Support',
    route: '/admin/support-tickets',
  },
  'batch-recall': {
    id: 'batch-recall',
    name: 'Batch Recall & Traceability',
    description: 'Manage product recalls, track affected customers, and generate regulatory reports',
    tier: 'professional',
    category: 'Compliance',
    route: '/admin/batch-recall',
  },
  'compliance-vault': {
    id: 'compliance-vault',
    name: 'Compliance Document Vault',
    description: 'Manage compliance documents, track expiration dates, and maintain audit trails',
    tier: 'professional',
    category: 'Compliance',
    route: '/admin/compliance-vault',
  },
  'advanced-reporting': {
    id: 'advanced-reporting',
    name: 'Advanced Reporting & BI',
    description: 'Build custom reports, schedule automated deliveries, and create visual dashboards',
    tier: 'professional',
    category: 'Analytics',
    route: '/admin/advanced-reporting',
  },
  'vendor-portal': {
    id: 'vendor-portal',
    name: 'Vendor/Supplier Portal',
    description: 'External portal for vendors to view POs, upload invoices, and track payments',
    tier: 'professional',
    category: 'Integrations',
    route: '/vendor/dashboard',
  },
  'predictive-analytics': {
    id: 'predictive-analytics',
    name: 'Predictive Analytics & Forecasting',
    description: 'AI-powered demand forecasting, inventory optimization, and cash flow projections',
    tier: 'professional',
    category: 'Analytics',
    route: '/admin/predictive-analytics',
  },
  'help': {
    id: 'help',
    name: 'Help & Support',
    description: 'Get assistance and documentation',
    tier: 'starter',
    category: 'Settings',
    route: '/admin/help',
  },
  'generate-barcodes': {
    id: 'generate-barcodes',
    name: 'Generate Barcodes',
    description: 'Create product barcodes',
    tier: 'starter',
    category: 'Tools',
    route: '/admin/generate-barcodes',
  },
  'wholesale-orders': {
    id: 'wholesale-orders',
    name: 'Wholesale Orders',
    description: 'Manage bulk orders',
    tier: 'starter',
    category: 'Orders',
    route: '/admin/wholesale-orders',
  },
  'reports': {
    id: 'reports',
    name: 'Basic Reports',
    description: 'View basic business reports',
    tier: 'starter',
    category: 'Reports',
    route: '/admin/reports',
  },
  'inventory-dashboard': {
    id: 'inventory-dashboard',
    name: 'Inventory Overview',
    description: 'Basic inventory dashboard',
    tier: 'starter',
    category: 'Inventory',
    route: '/admin/inventory-dashboard',
  },

  // ===== PROFESSIONAL TIER (19 additional features = 31 total) =====
  'menu-analytics': {
    id: 'menu-analytics',
    name: 'Menu Analytics',
    description: 'Advanced menu performance analytics',
    tier: 'professional',
    category: 'Analytics',
    route: '/admin/menu-analytics',
  },
  'disposable-menu-analytics': {
    id: 'disposable-menu-analytics',
    name: 'Disposable Menu Analytics',
    description: 'Track disposable menu performance',
    tier: 'professional',
    category: 'Analytics',
    route: '/admin/disposable-menu-analytics',
  },
  'live-orders': {
    id: 'live-orders',
    name: 'Live Orders Dashboard',
    description: 'Real-time order monitoring',
    tier: 'professional',
    category: 'Orders',
    route: '/admin/live-orders',
  },
  'order-analytics': {
    id: 'order-analytics',
    name: 'Order Analytics',
    description: 'Deep insights into order performance, trends, and patterns',
    tier: 'professional',
    category: 'Analytics',
    route: '/admin/order-analytics',
  },
  'customer-analytics': {
    id: 'customer-analytics',
    name: 'Customer Analytics',
    description: 'Customer behavior insights',
    tier: 'professional',
    category: 'Analytics',
    route: '/admin/customer-analytics',
  },
  'sales-dashboard': {
    id: 'sales-dashboard',
    name: 'Sales Dashboard',
    description: 'Comprehensive sales metrics, revenue trends, and profit analysis',
    tier: 'professional',
    category: 'Sales',
    route: '/admin/sales-dashboard',
  },
  'marketplace': {
    id: 'marketplace',
    name: 'Wholesale Marketplace',
    description: 'List products on B2B marketplace, manage wholesale orders, and communicate with buyers',
    tier: 'professional',
    category: 'Marketplace',
    route: '/admin/marketplace/listings',
  },
  'commission-tracking': {
    id: 'commission-tracking',
    name: 'Commission Tracking',
    description: 'Monitor team commissions',
    tier: 'professional',
    category: 'Financial',
    route: '/admin/commission-tracking',
  },
  'team-members': {
    id: 'team-members',
    name: 'Team Members',
    description: 'Manage staff and permissions',
    tier: 'professional',
    category: 'Team',
    route: '/admin/team-members',
  },
  'role-management': {
    id: 'role-management',
    name: 'Role Management',
    description: 'Configure user roles',
    tier: 'professional',
    category: 'Team',
    route: '/admin/role-management',
  },
  'activity-logs': {
    id: 'activity-logs',
    name: 'Activity Logs',
    description: 'Audit team actions',
    tier: 'professional',
    category: 'Team',
    route: '/admin/activity-logs',
  },
  'advanced-inventory': {
    id: 'advanced-inventory',
    name: 'Advanced Inventory',
    description: 'Full inventory management',
    tier: 'professional',
    category: 'Inventory',
    route: '/admin/advanced-inventory',
  },
  'stock-alerts': {
    id: 'stock-alerts',
    name: 'Stock Alerts',
    description: 'Low stock notifications',
    tier: 'professional',
    category: 'Inventory',
    route: '/admin/stock-alerts',
  },
  'inventory-transfers': {
    id: 'inventory-transfers',
    name: 'Inventory Transfers',
    description: 'Move stock between locations',
    tier: 'professional',
    category: 'Inventory',
    route: '/admin/inventory-transfers',
  },
  'fronted-inventory': {
    id: 'fronted-inventory',
    name: 'Fronted Inventory',
    description: 'Manage fronted products',
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
  'revenue-reports': {
    id: 'revenue-reports',
    name: 'Revenue Reports',
    description: 'Financial performance analysis',
    tier: 'professional',
    category: 'Financial',
    route: '/admin/revenue-reports',
  },
  'invoice-management': {
    id: 'invoice-management',
    name: 'Advanced Invoice',
    description: 'Create and manage invoices',
    tier: 'professional',
    category: 'Financial',
    route: '/admin/advanced-invoice',
  },
  'customer-insights': {
    id: 'customer-insights',
    name: 'Customer Insights',
    description: 'Understand customer behavior, segments, and lifetime value',
    tier: 'professional',
    category: 'Customers',
    route: '/admin/customer-insights',
  },
  'bulk-operations': {
    id: 'bulk-operations',
    name: 'Bulk Operations',
    description: 'Mass update products/orders',
    tier: 'professional',
    category: 'Tools',
    route: '/admin/bulk-operations',
  },
  'notifications': {
    id: 'notifications',
    name: 'Notifications',
    description: 'Email & SMS alerts',
    tier: 'professional',
    category: 'Tools',
    route: '/admin/notifications',
  },
  'expense-tracking': {
    id: 'expense-tracking',
    name: 'Expense Tracking',
    description: 'Track business expenses',
    tier: 'professional',
    category: 'Financial',
    route: '/admin/expense-tracking',
  },
  
  // Additional Professional features (Hidden Gems)
  'live-chat': {
    id: 'live-chat',
    name: 'Live Chat',
    description: 'Real-time customer support chat',
    tier: 'professional',
    category: 'Customers',
    route: '/admin/live-chat',
  },
  'customer-details': {
    id: 'customer-details',
    name: 'Customer Details',
    description: 'Detailed customer profiles',
    tier: 'professional',
    category: 'Customers',
    route: '/admin/customer-details',
  },
  'customer-reports': {
    id: 'customer-reports',
    name: 'Customer Reports',
    description: 'Generate customer-specific reports',
    tier: 'professional',
    category: 'Reports',
    route: '/admin/customer-reports',
  },
  'fronted-inventory-analytics': {
    id: 'fronted-inventory-analytics',
    name: 'Fronted Inventory Analytics',
    description: 'Analyze fronted product performance',
    tier: 'professional',
    category: 'Analytics',
    route: '/admin/fronted-inventory-analytics',
  },
  'global-search': {
    id: 'global-search',
    name: 'Global Search',
    description: 'Search across all data',
    tier: 'professional',
    category: 'Tools',
    route: '/admin/global-search',
  },

  // ===== ENTERPRISE TIER (25 additional features = 56 total) =====
  'fleet-management': {
    id: 'fleet-management',
    name: 'Fleet Management',
    description: 'Manage delivery fleet',
    tier: 'enterprise',
    category: 'Delivery',
    route: '/admin/fleet-management',
  },
  'delivery-management': {
    id: 'delivery-management',
    name: 'Delivery Management',
    description: 'Coordinate deliveries',
    tier: 'enterprise',
    category: 'Delivery',
    route: '/admin/delivery-management',
  },
  'live-map': {
    id: 'live-map',
    name: 'Live Map Tracking',
    description: 'Real-time driver tracking',
    tier: 'enterprise',
    category: 'Delivery',
    route: '/admin/live-map',
  },
  'route-optimization': {
    id: 'route-optimization',
    name: 'Route Optimizer',
    description: 'AI-powered delivery route planning',
    tier: 'enterprise',
    category: 'Delivery',
    route: '/admin/route-optimizer',
  },
  'delivery-analytics': {
    id: 'delivery-analytics',
    name: 'Delivery Analytics',
    description: 'Comprehensive delivery performance metrics',
    tier: 'enterprise',
    category: 'Delivery',
    route: '/admin/delivery-analytics',
  },
  'pos-system': {
    id: 'pos-system',
    name: 'POS System',
    description: 'Point of sale interface',
    tier: 'enterprise',
    category: 'POS',
    route: '/admin/pos-system',
  },
  'cash-register': {
    id: 'cash-register',
    name: 'Cash Register',
    description: 'Manage cash transactions',
    tier: 'enterprise',
    category: 'POS',
    route: '/admin/cash-register',
  },
  'pos-analytics': {
    id: 'pos-analytics',
    name: 'POS Analytics',
    description: 'Point of sale performance insights',
    tier: 'enterprise',
    category: 'POS',
    route: '/admin/pos-analytics',
  },
  'locations': {
    id: 'locations',
    name: 'Locations',
    description: 'Multi-location management',
    tier: 'enterprise',
    category: 'Locations',
    route: '/admin/locations',
  },
  'location-analytics': {
    id: 'location-analytics',
    name: 'Location Analytics',
    description: 'Per-location performance analysis',
    tier: 'enterprise',
    category: 'Locations',
    route: '/admin/location-analytics',
  },
  'api-access': {
    id: 'api-access',
    name: 'API Access',
    description: 'Developer API access and documentation',
    tier: 'enterprise',
    category: 'Integrations',
    route: '/admin/api-access',
  },
  'webhooks': {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Real-time event notifications',
    tier: 'enterprise',
    category: 'Integrations',
    route: '/admin/webhooks',
  },
  'custom-integrations': {
    id: 'custom-integrations',
    name: 'Custom Integrations',
    description: 'Build custom third-party connections',
    tier: 'enterprise',
    category: 'Integrations',
    route: '/admin/custom-integrations',
  },
  'ai': {
    id: 'ai',
    name: 'Local AI',
    description: 'On-premise AI processing and machine learning capabilities',
    tier: 'enterprise',
    category: 'Integrations',
    route: '/admin/local-ai',
  },
  'automation': {
    id: 'automation',
    name: 'Workflow Automation',
    description: 'Automate workflows and processes',
    tier: 'enterprise',
    category: 'Integrations',
    route: '/admin/workflow-automation',
  },
  'white-label': {
    id: 'white-label',
    name: 'White Label',
    description: 'Custom branding and white-label options',
    tier: 'enterprise',
    category: 'Branding',
    route: '/admin/white-label',
  },
  'custom-domain': {
    id: 'custom-domain',
    name: 'Custom Domain',
    description: 'Use your own custom domain',
    tier: 'enterprise',
    category: 'Branding',
    route: '/admin/custom-domain',
  },
  'analytics': {
    id: 'analytics',
    name: 'Analytics Dashboard',
    description: 'Self-hosted analytics with privacy-first tracking',
    tier: 'enterprise',
    category: 'Analytics',
    route: '/admin/analytics-dashboard',
  },
  'advanced-analytics': {
    id: 'advanced-analytics',
    name: 'Advanced Analytics',
    description: 'AI-powered predictive analytics',
    tier: 'enterprise',
    category: 'Analytics',
    route: '/admin/advanced-analytics',
  },
  'realtime-dashboard': {
    id: 'realtime-dashboard',
    name: 'Realtime Dashboard',
    description: 'Real-time business metrics',
    tier: 'enterprise',
    category: 'Analytics',
    route: '/admin/realtime-dashboard',
  },
  'custom-reports': {
    id: 'custom-reports',
    name: 'Custom Reports',
    description: 'Build and schedule custom reports',
    tier: 'enterprise',
    category: 'Reports',
    route: '/admin/custom-reports',
  },
  'data-export': {
    id: 'data-export',
    name: 'Data Export',
    description: 'Export data to Excel, CSV, PDF',
    tier: 'enterprise',
    category: 'Tools',
    route: '/admin/data-export',
  },
  'user-management': {
    id: 'user-management',
    name: 'User Management',
    description: 'Advanced user controls',
    tier: 'enterprise',
    category: 'Team',
    route: '/admin/user-management',
  },
  'permissions': {
    id: 'permissions',
    name: 'Permissions',
    description: 'Granular access control',
    tier: 'enterprise',
    category: 'Team',
    route: '/admin/permissions',
  },
  'audit-trail': {
    id: 'audit-trail',
    name: 'Audit Trail',
    description: 'Complete action history',
    tier: 'enterprise',
    category: 'Security',
    route: '/admin/audit-trail',
  },
  'compliance': {
    id: 'compliance',
    name: 'Compliance',
    description: 'Regulatory compliance tools',
    tier: 'enterprise',
    category: 'Security',
    route: '/admin/compliance',
  },
  'priority-support': {
    id: 'priority-support',
    name: '24/7 Priority Support',
    description: 'Dedicated account manager',
    tier: 'enterprise',
    category: 'Support',
    route: '/admin/priority-support',
  },
  
  // Additional Enterprise features (Hidden Gems)
  'couriers': {
    id: 'couriers',
    name: 'Courier Management',
    description: 'Manage delivery couriers',
    tier: 'enterprise',
    category: 'Delivery',
    route: '/admin/couriers',
  },
  'delivery-tracking': {
    id: 'delivery-tracking',
    name: 'Delivery Tracking',
    description: 'Track individual deliveries',
    tier: 'enterprise',
    category: 'Delivery',
    route: '/admin/delivery-tracking',
  },
  'dispatch-inventory': {
    id: 'dispatch-inventory',
    name: 'Dispatch Inventory',
    description: 'Manage outbound inventory',
    tier: 'enterprise',
    category: 'Inventory',
    route: '/admin/dispatch-inventory',
  },
  'financial-center': {
    id: 'financial-center',
    name: 'Financial Center',
    description: 'Comprehensive financial management',
    tier: 'enterprise',
    category: 'Financial',
    route: '/admin/financial-center',
  },
  'risk-management': {
    id: 'risk-management',
    name: 'Risk Management',
    description: 'Identify and manage business risks',
    tier: 'enterprise',
    category: 'Security',
    route: '/admin/risk-management',
  },
  'system-settings': {
    id: 'system-settings',
    name: 'System Settings',
    description: 'Advanced system configuration',
    tier: 'enterprise',
    category: 'Settings',
    route: '/admin/system-settings',
  },
  'vendor-management': {
    id: 'vendor-management',
    name: 'Vendor Management',
    description: 'Manage supplier relationships',
    tier: 'enterprise',
    category: 'Inventory',
    route: '/admin/vendor-management',
  },
};

// Get all features for a specific tier (includes lower tiers)
export function getFeaturesForTier(tier: SubscriptionTier): Feature[] {
  const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
  const tierIndex = tierHierarchy.indexOf(tier);
  
  return Object.values(FEATURES).filter(feature => {
    const featureTierIndex = tierHierarchy.indexOf(feature.tier);
    return featureTierIndex <= tierIndex;
  });
}

// Check if a tier has access to a feature
export function hasFeatureAccess(currentTier: SubscriptionTier, featureId: FeatureId): boolean {
  const feature = FEATURES[featureId];
  if (!feature) return false;
  
  const tierHierarchy: SubscriptionTier[] = ['starter', 'professional', 'enterprise'];
  const currentTierIndex = tierHierarchy.indexOf(currentTier);
  const requiredTierIndex = tierHierarchy.indexOf(feature.tier);
  
  return currentTierIndex >= requiredTierIndex;
}

// Get the required tier for a feature
export function getRequiredTier(featureId: FeatureId): SubscriptionTier | null {
  return FEATURES[featureId]?.tier || null;
}

// Get upgrade requirement
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

// Get features grouped by category
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
