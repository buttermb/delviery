/**
 * Business Tier Preset Definitions
 * 
 * 5-Tier Hotbox System (maps to 3-tier subscription):
 * - Street: <$10K/mo → Starter ($79)
 * - Trap: $10K-50K → Starter ($79)
 * - Block: $50K-200K → Professional ($150)
 * - Hood: $200K-500K → Professional ($150)
 * - Empire: $500K+ → Enterprise ($499)
 * 
 * Features are managed in featureConfig.ts - this file provides
 * business context, dashboard widgets, and UI customization.
 */

import { type SubscriptionTier } from '@/lib/featureConfig';

export type BusinessTier = 'street' | 'trap' | 'block' | 'hood' | 'empire';

export interface TierPreset {
  tier: BusinessTier;
  displayName: string;
  emoji: string;
  tagline: string;
  revenueRange: string;
  typicalLocations: string;
  typicalTeam: string;

  // Maps to subscription tier for feature access
  subscriptionTier: SubscriptionTier;

  // Dashboard widgets
  dashboardWidgets: string[];
  pulseMetrics: string[]; // The 4 key numbers

  // Quick actions for this tier
  quickActions: Array<{
    id: string;
    label: string;
    icon: string;
    path: string;
  }>;

  // Navigation sections visible
  navSections: string[];

  // Automation rules enabled
  automation: {
    enabled: boolean;
    rules: string[];
  };

  // Feature limits (enforced by subscription)
  limits: {
    locations: number;
    users: number;
    products: number;
    ordersPerMonth: number;
  };

  // Feature visibility (optional - for backward compatibility)
  enabledFeatures?: string[];
  hiddenFeatures?: string[];
}

export interface TierThresholds {
  revenue: number;
  locations: number;
  team: number;
  score: number;
}

/**
 * STREET TIER → Starter ($79)
 * Solo operator - needs simplicity, speed
 */
const STREET_TIER: TierPreset = {
  tier: 'street',
  displayName: 'Street',
  emoji: '🛵',
  tagline: 'Hustling solo',
  revenueRange: '<$10K/mo',
  typicalLocations: '1',
  typicalTeam: 'Just you',
  subscriptionTier: 'starter',

  dashboardWidgets: [
    'street-tips',
    'live-orders',
    'todays-revenue',
    'top-5-products',
    'pending-orders',
    'low-stock-alerts',
    'recent-orders',
  ],

  pulseMetrics: ['revenue', 'profit', 'orders_today', 'pending_actions'],

  quickActions: [
    { id: 'new-sale', label: '+ New Sale', icon: 'DollarSign', path: '/admin/orders?tab=menu' },
    { id: 'view-orders', label: 'Orders', icon: 'Package', path: '/admin/orders?tab=menu' },
    { id: 'inventory', label: 'Inventory', icon: 'Box', path: '/admin/inventory-hub?tab=products' },
    { id: 'menu', label: 'View Menu', icon: 'Menu', path: '/admin/disposable-menus' },
  ],

  navSections: ['command-center', 'sales', 'inventory', 'settings'],

  automation: {
    enabled: true,
    rules: [
      'low_stock_alert',
      'daily_revenue_summary',
    ],
  },

  limits: {
    locations: 1,
    users: 3,
    products: 500,
    ordersPerMonth: 1000,
  },
};

/**
 * TRAP TIER → Starter ($79)
 * Small team - needs visibility across crew
 */
const TRAP_TIER: TierPreset = {
  tier: 'trap',
  displayName: 'Trap',
  emoji: '🏪',
  tagline: 'Small crew running',
  revenueRange: '$10K-50K/mo',
  typicalLocations: '1-2',
  typicalTeam: '2-5',
  subscriptionTier: 'starter',

  dashboardWidgets: [
    'live-orders',
    'team-activity',
    'revenue-trend',
    'top-products',
    'pending-orders',
    'low-stock-alerts',
    'customer-tabs',
    'weekly-trends',
  ],

  pulseMetrics: ['revenue', 'profit_margin', 'orders_today', 'team_online'],

  quickActions: [
    { id: 'new-order', label: '+ New Order', icon: 'Plus', path: '/admin/orders?tab=menu' },
    { id: 'process-menu', label: 'Process Orders', icon: 'Menu', path: '/admin/orders?tab=menu' },
    { id: 'inventory', label: 'Inventory', icon: 'Box', path: '/admin/inventory-hub?tab=products' },
    { id: 'reports', label: 'Reports', icon: 'BarChart3', path: '/admin/reports' },
  ],

  navSections: ['command-center', 'sales', 'inventory', 'customers', 'settings'],

  automation: {
    enabled: true,
    rules: [
      'low_stock_alert',
      'auto_reorder_top_sellers',
      'customer_winback',
      'daily_summary',
      'loyalty_rewards',
    ],
  },

  limits: {
    locations: 2,
    users: 5,
    products: 1000,
    ordersPerMonth: 3000,
  },
};

/**
 * BLOCK TIER → Professional ($150)
 * Multiple locations - needs comparative view
 */
const BLOCK_TIER: TierPreset = {
  tier: 'block',
  displayName: 'Block',
  emoji: '🏢',
  tagline: 'Running the block',
  revenueRange: '$50K-200K/mo',
  typicalLocations: '2-3',
  typicalTeam: '5-15',
  subscriptionTier: 'professional',

  dashboardWidgets: [
    'live-orders',
    'location-overview',
    'team-activity',
    'weekly-trends',
    'revenue-by-location',
    'location-comparison',
    'top-products-network',
    'pending-orders-all',
    'team-performance',
    'inventory-value',
    'profit-margins',
  ],

  pulseMetrics: ['total_revenue', 'avg_margin', 'orders_network', 'issues_count'],

  quickActions: [
    { id: 'approve-orders', label: 'Approve Orders', icon: 'CheckCircle', path: '/admin/orders?tab=wholesale' },
    { id: 'live-orders', label: 'Live Orders', icon: 'Activity', path: '/admin/orders?tab=live' },
    { id: 'transfer', label: 'Transfer Stock', icon: 'ArrowRightLeft', path: '/admin/inventory-transfers' },
    { id: 'reports', label: 'Reports', icon: 'BarChart3', path: '/admin/reports' },
  ],

  navSections: ['command-center', 'sales', 'inventory', 'customers', 'operations', 'analytics', 'settings'],

  automation: {
    enabled: true,
    rules: [
      'low_stock_alert',
      'auto_reorder_top_sellers',
      'customer_winback',
      'daily_summary',
      'weekly_reports',
      'loyalty_rewards',
      'location_performance_alerts',
      'inventory_transfer_suggestions',
    ],
  },

  limits: {
    locations: 5,
    users: 25,
    products: 5000,
    ordersPerMonth: 10000,
  },
};

/**
 * HOOD TIER → Professional ($150)
 * Serious operation - executive summary
 */
const HOOD_TIER: TierPreset = {
  tier: 'hood',
  displayName: 'Hood',
  emoji: '🏙️',
  tagline: 'Running the hood',
  revenueRange: '$200K-500K/mo',
  typicalLocations: '3-5',
  typicalTeam: '15-30',
  subscriptionTier: 'professional',

  dashboardWidgets: [
    'live-orders',
    'executive-summary',
    'location-overview',
    'team-activity',
    'weekly-trends',
    'mtd-revenue',
    'projected-close',
    'net-profit',
    'cash-position',
    'kpi-grid',
    'location-scorecard',
    'customer-ltv',
    'churn-rate',
    'compliance-status',
    'management-alerts',
    'budget-variance',
  ],

  pulseMetrics: ['mtd_revenue', 'projected_revenue', 'net_profit', 'cash_position'],

  quickActions: [
    { id: 'executive-actions', label: 'Pending Approvals', icon: 'ClipboardList', path: '/admin/orders?tab=wholesale' },
    { id: 'pnl', label: 'P&L Summary', icon: 'DollarSign', path: '/admin/financial-center' },
    { id: 'analytics', label: 'Analytics', icon: 'BarChart3', path: '/admin/analytics-hub' },
    { id: 'team', label: 'Team', icon: 'Users', path: '/admin/staff-management' },
  ],

  navSections: ['command-center', 'sales', 'inventory', 'customers', 'operations', 'analytics', 'compliance', 'settings'],

  automation: {
    enabled: true,
    rules: [
      'predictive_inventory',
      'customer_lifecycle_campaigns',
      'loyalty_tier_upgrades',
      'executive_weekly_reports',
      'compliance_auto_reminders',
      'employee_performance_reviews',
      'wholesale_order_processing',
      'budget_variance_alerts',
      'churn_risk_detection',
    ],
  },

  limits: {
    locations: 10,
    users: 50,
    products: 10000,
    ordersPerMonth: 30000,
  },
};

/**
 * EMPIRE TIER → Enterprise ($499)
 * Full organization - board-level view
 */
const EMPIRE_TIER: TierPreset = {
  tier: 'empire',
  displayName: 'Empire',
  emoji: '👑',
  tagline: 'Running the empire',
  revenueRange: '$500K+/mo',
  typicalLocations: '5+',
  typicalTeam: '30+',
  subscriptionTier: 'enterprise',

  dashboardWidgets: [
    'live-orders',
    'executive-summary',
    'location-overview',
    'team-activity',
    'strategic-decisions',
    'weekly-trends',
    'organization-health',
    'ebitda',
    'cash-flow',
    'ar-outstanding',
    'ap-due',
    'regional-performance',
    'market-share',
    'competitor-alerts',
    'expansion-opportunities',
    'compliance-audit-status',
    'board-report-preview',
  ],

  pulseMetrics: ['mtd_revenue', 'ebitda', 'cash_position', 'ar_outstanding'],

  quickActions: [
    { id: 'realtime', label: 'Real-Time', icon: 'Activity', path: '/admin/realtime-dashboard' },
    { id: 'strategic', label: 'Strategic', icon: 'TrendingUp', path: '/admin/advanced-analytics' },
    { id: 'compliance', label: 'Compliance', icon: 'Shield', path: '/admin/compliance' },
    { id: 'fleet', label: 'Fleet', icon: 'Truck', path: '/admin/delivery-hub?tab=fleet' },
  ],

  navSections: ['all'],

  automation: {
    enabled: true,
    rules: [
      'predictive_inventory',
      'customer_lifecycle_campaigns',
      'loyalty_tier_upgrades',
      'delivery_route_optimization',
      'executive_weekly_reports',
      'compliance_auto_filing',
      'employee_performance_reviews',
      'wholesale_order_processing',
      'fraud_detection',
      'revenue_forecasting',
      'competitor_monitoring',
      'market_share_tracking',
      'board_report_generation',
      'regulatory_compliance_check',
    ],
  },

  limits: {
    locations: 999,
    users: 999,
    products: 999999,
    ordersPerMonth: 999999,
  },
};

/**
 * All tier presets
 */
export const BUSINESS_TIER_PRESETS: Record<BusinessTier, TierPreset> = {
  street: STREET_TIER,
  trap: TRAP_TIER,
  block: BLOCK_TIER,
  hood: HOOD_TIER,
  empire: EMPIRE_TIER,
};

/**
 * Get tier preset by tier name
 */
export function getTierPreset(tier: BusinessTier): TierPreset {
  return BUSINESS_TIER_PRESETS[tier] || STREET_TIER;
}

/**
 * Get subscription tier from business tier
 */
export function getSubscriptionTier(businessTier: BusinessTier): SubscriptionTier {
  return getTierPreset(businessTier).subscriptionTier;
}

/**
 * Convert subscription tier to a representative business tier
 * Used for backwards compatibility with components expecting BusinessTier
 */
export function subscriptionTierToBusinessTier(subscriptionTier: SubscriptionTier): BusinessTier {
  switch (subscriptionTier) {
    case 'starter':
      return 'street';
    case 'professional':
      return 'block';
    case 'enterprise':
      return 'empire';
    default:
      return 'street';
  }
}

/**
 * Get next tier upgrade path
 */
export function getNextTier(currentTier: BusinessTier): BusinessTier | null {
  const tierOrder: BusinessTier[] = ['street', 'trap', 'block', 'hood', 'empire'];
  const currentIndex = tierOrder.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex >= tierOrder.length - 1) {
    return null;
  }
  return tierOrder[currentIndex + 1];
}

/**
 * Get tier requirements for upgrade
 */
export function getTierRequirements(tier: BusinessTier): {
  minRevenue: number;
  minLocations: number;
  minTeam: number;
} {
  const requirements: Record<BusinessTier, { minRevenue: number; minLocations: number; minTeam: number }> = {
    street: { minRevenue: 0, minLocations: 1, minTeam: 1 },
    trap: { minRevenue: 10000, minLocations: 1, minTeam: 2 },
    block: { minRevenue: 50000, minLocations: 2, minTeam: 5 },
    hood: { minRevenue: 200000, minLocations: 3, minTeam: 15 },
    empire: { minRevenue: 500000, minLocations: 5, minTeam: 30 },
  };
  return requirements[tier];
}

/**
 * Check if tenant qualifies for a tier
 */
export function qualifiesForTier(
  tier: BusinessTier,
  metrics: { revenue: number; locations: number; teamSize: number }
): boolean {
  const req = getTierRequirements(tier);
  return (
    metrics.revenue >= req.minRevenue ||
    (metrics.locations >= req.minLocations && metrics.teamSize >= req.minTeam)
  );
}

/**
 * Detect best tier based on metrics
 */
export function detectBestTier(metrics: {
  revenue: number;
  locations: number;
  teamSize: number;
}): BusinessTier {
  const tiers: BusinessTier[] = ['empire', 'hood', 'block', 'trap', 'street'];
  for (const tier of tiers) {
    if (qualifiesForTier(tier, metrics)) {
      return tier;
    }
  }
  return 'street';
}

/**
 * Get tier badge color
 */
export function getTierColor(tier: BusinessTier): string {
  const colors: Record<BusinessTier, string> = {
    street: 'bg-gray-500',
    trap: 'bg-green-500',
    block: 'bg-blue-500',
    hood: 'bg-blue-600',
    empire: 'bg-purple-500',
  };
  return colors[tier];
}

/**
 * Get tier text color
 */
export function getTierTextColor(tier: BusinessTier): string {
  const colors: Record<BusinessTier, string> = {
    street: 'text-gray-600',
    trap: 'text-green-600',
    block: 'text-blue-600',
    hood: 'text-blue-700',
    empire: 'text-purple-600',
  };
  return colors[tier];
}

// ============================================================
// TIER GREETING SYSTEM
// ============================================================

/**
 * Tier-specific motivational messages
 */
export const TIER_GREETINGS: Record<BusinessTier, string[]> = {
  street: [
    "Let's get this bread.",
    'Time to hustle.',
    'Another day, another dollar.',
    'Stay grinding.',
    'Make it happen.',
  ],
  trap: [
    'Your crew is ready.',
    'The trap is open.',
    "Let's run it.",
    'Team is locked in.',
    "Let's get it.",
  ],
  block: [
    'All locations reporting in.',
    'The block is live.',
    'Operations running smooth.',
    'Network is active.',
    "Let's dominate.",
  ],
  hood: [
    "Here's your executive briefing.",
    'Empire status: operational.',
    "Let's review the numbers.",
    'Your operation awaits.',
    'Ready for growth.',
  ],
  empire: [
    'Your empire awaits.',
    'All systems operational.',
    "Here's the big picture.",
    'Board-ready status.',
    'Strategic overview ready.',
  ],
};

/**
 * Get time-appropriate greeting
 */
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Burning the midnight oil';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Working late';
}

/**
 * Get random message from tier greetings
 */
function getRandomTierMessage(tier: BusinessTier): string {
  const messages = TIER_GREETINGS[tier];
  return messages[Math.floor(Math.random() * messages.length)];
}

export interface Greeting {
  timeGreeting: string;
  tierMessage: string;
  full: string;
}

/**
 * Generate personalized greeting for user
 */
export function generateGreeting(userName: string, tier: BusinessTier): Greeting {
  const timeGreeting = getTimeGreeting();
  const tierMessage = getRandomTierMessage(tier);

  return {
    timeGreeting,
    tierMessage,
    full: `${timeGreeting}, ${userName}. ${tierMessage}`,
  };
}
