/**
 * Business Tier Preset Definitions
 * 
 * 5-Tier Hotbox System:
 * - Street: <$10K/mo, 1 location, solo
 * - Trap: $10K-50K, 1-2 locations, 2-5 team
 * - Block: $50K-200K, 2-3 locations, 5-15 team
 * - Hood: $200K-500K, 3-5 locations, 15-30 team
 * - Empire: $500K+, 5+ locations, 30+ team
 */

export type BusinessTier = 'street' | 'trap' | 'block' | 'hood' | 'empire';

export interface TierPreset {
  tier: BusinessTier;
  displayName: string;
  emoji: string;
  tagline: string;
  revenueRange: string;
  typicalLocations: string;
  typicalTeam: string;

  // Sidebar features
  enabledFeatures: string[];
  hiddenFeatures: string[];

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

  // Feature limits
  limits: {
    locations: number;
    users: number;
    products: number;
    ordersPerMonth: number;
  };
}

export interface TierThresholds {
  revenue: number;
  locations: number;
  team: number;
  score: number;
}

/**
 * STREET TIER
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

  enabledFeatures: [
    'dashboard',
    'pos-system',
    'products',
    'basic-orders',
    'customers-basic',
    'disposable-menus',
    'delivery-management',
    'inventory-basic',
    'compliance-basic',
    'settings',
  ],

  hiddenFeatures: [
    'advanced-analytics',
    'multi-location',
    'wholesale-marketplace',
    'fleet-management',
    'api-access',
    'white-label',
    'predictive-par',
    'custom-integrations',
    'metrc-integration',
    'team-management',
    'marketing-automation',
    'customer-insights',
    'financial-center',
  ],

  dashboardWidgets: [
    'street-tips',
    'todays-revenue',
    'top-5-products',
    'pending-orders',
    'low-stock-alerts',
    'recent-orders',
  ],

  pulseMetrics: ['revenue', 'profit', 'orders_today', 'pending_actions'],

  quickActions: [
    { id: 'new-sale', label: '+ New Sale', icon: 'DollarSign', path: '/admin/pos-system' },
    { id: 'view-orders', label: 'Orders', icon: 'Package', path: '/admin/orders' },
    { id: 'inventory', label: 'Inventory', icon: 'Box', path: '/admin/inventory/products' },
    { id: 'menu', label: 'View Menu', icon: 'Menu', path: '/admin/disposable-menus' },
  ],

  navSections: ['operations', 'settings'],

  automation: {
    enabled: true,
    rules: [
      'low_stock_alert',
      'daily_revenue_summary',
      'compliance_reminders',
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
 * TRAP TIER
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

  enabledFeatures: [
    'dashboard',
    'pos-system',
    'products',
    'basic-orders',
    'customers-basic',
    'disposable-menus',
    'delivery-management',
    'inventory-dashboard',
    'team-management',
    'compliance-basic',
    'settings',
    'reports',
    'loyalty-program',
    'stock-alerts',
  ],

  hiddenFeatures: [
    'advanced-analytics',
    'wholesale-marketplace',
    'fleet-management',
    'api-access',
    'white-label',
    'predictive-par',
    'custom-integrations',
    'metrc-integration',
    'financial-center',
    'marketing-automation',
  ],

  dashboardWidgets: [
    'team-activity',
    'revenue-trend',
    'top-products',
    'pending-orders',
    'low-stock-alerts',
    'customer-tabs',
    'delivery-status',
    'weekly-trends',
  ],

  pulseMetrics: ['revenue', 'profit_margin', 'orders_today', 'team_online'],

  quickActions: [
    { id: 'new-order', label: '+ New Order', icon: 'Plus', path: '/admin/orders/new' },
    { id: 'pos', label: 'POS', icon: 'Store', path: '/admin/pos-system' },
    { id: 'process-menu', label: 'Process Menu Orders', icon: 'Menu', path: '/admin/disposable-menu-orders' },
    { id: 'team', label: 'Team View', icon: 'Users', path: '/admin/team' },
  ],

  navSections: ['operations', 'delivery', 'people', 'settings'],

  automation: {
    enabled: true,
    rules: [
      'low_stock_alert',
      'auto_reorder_top_sellers',
      'customer_winback',
      'daily_summary',
      'delivery_eta_notifications',
      'loyalty_rewards',
    ],
  },

  limits: {
    locations: 2,
    users: 10,
    products: 1000,
    ordersPerMonth: 3000,
  },
};

/**
 * BLOCK TIER
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

  enabledFeatures: [
    'dashboard',
    'pos-system',
    'products',
    'basic-orders',
    'customers-advanced',
    'disposable-menus',
    'delivery-management',
    'inventory-dashboard',
    'inventory-transfers',
    'team-management',
    'compliance',
    'settings',
    'reports',
    'loyalty-program',
    'stock-alerts',
    'multi-location',
    'wholesale-portal',
    'financial-center',
    'route-optimization',
    'purchase-orders',
    'customer-insights',
  ],

  hiddenFeatures: [
    'wholesale-marketplace',
    'api-access',
    'white-label',
    'predictive-par',
    'custom-integrations',
    'advanced-fleet',
  ],

  dashboardWidgets: [
    'location-overview',
    'team-activity',
    'weekly-trends',
    'revenue-by-location',
    'location-comparison',
    'top-products-network',
    'pending-orders-all',
    'team-performance',
    'inventory-value',
    'delivery-efficiency',
    'wholesale-pipeline',
    'profit-margins',
  ],

  pulseMetrics: ['total_revenue', 'avg_margin', 'orders_network', 'issues_count'],

  quickActions: [
    { id: 'approve-orders', label: 'Approve Orders', icon: 'CheckCircle', path: '/admin/wholesale-orders' },
    { id: 'location-view', label: 'Locations', icon: 'MapPin', path: '/admin/locations' },
    { id: 'transfer', label: 'Transfer Stock', icon: 'ArrowRightLeft', path: '/admin/inventory/transfers' },
    { id: 'reports', label: 'Reports', icon: 'BarChart3', path: '/admin/reports' },
  ],

  navSections: ['operations', 'delivery', 'wholesale', 'people', 'compliance', 'settings'],

  automation: {
    enabled: true,
    rules: [
      'low_stock_alert',
      'auto_reorder_top_sellers',
      'customer_winback',
      'daily_summary',
      'weekly_reports',
      'delivery_eta_notifications',
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
 * HOOD TIER
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

  enabledFeatures: [
    'dashboard',
    'pos-system',
    'products',
    'basic-orders',
    'customers-advanced',
    'disposable-menus',
    'delivery-management',
    'inventory-dashboard',
    'inventory-transfers',
    'team-management',
    'compliance',
    'settings',
    'reports',
    'loyalty-program',
    'stock-alerts',
    'multi-location',
    'wholesale-portal',
    'financial-center',
    'route-optimization',
    'purchase-orders',
    'customer-insights',
    'advanced-analytics',
    'fleet-management',
    'marketing-automation',
    'api-access',
    'predictive-par',
    'audit-trail',
  ],

  hiddenFeatures: [
    'white-label',
    'custom-integrations',
    'developer-tools',
  ],

  dashboardWidgets: [
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
    { id: 'executive-actions', label: 'Pending Approvals', icon: 'ClipboardList', path: '/admin/approvals' },
    { id: 'pnl', label: 'P&L Summary', icon: 'DollarSign', path: '/admin/financial-center' },
    { id: 'wholesale', label: 'Wholesale Pipeline', icon: 'Building', path: '/admin/wholesale-orders' },
    { id: 'scorecard', label: 'Team Scorecard', icon: 'Users', path: '/admin/team-performance' },
  ],

  navSections: ['operations', 'delivery', 'wholesale', 'people', 'analytics', 'compliance', 'settings'],

  automation: {
    enabled: true,
    rules: [
      'predictive_inventory',
      'customer_lifecycle_campaigns',
      'loyalty_tier_upgrades',
      'delivery_route_optimization',
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
 * EMPIRE TIER
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

  enabledFeatures: [
    // Everything enabled
    'all',
  ],

  hiddenFeatures: [
    // Only debug/dev tools hidden
    'debug-console',
    'bug-scanner',
    'link-checker',
  ],

  dashboardWidgets: [
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
    { id: 'board-report', label: 'Board Report', icon: 'FileText', path: '/admin/board-report' },
    { id: 'strategic', label: 'Strategic Dashboard', icon: 'TrendingUp', path: '/admin/strategic-dashboard' },
    { id: 'compliance', label: 'Compliance Status', icon: 'Shield', path: '/admin/compliance' },
    { id: 'expansion', label: 'Expansion Analysis', icon: 'Globe', path: '/admin/expansion' },
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
 * Must meet revenue threshold OR (locations AND team together)
 */
export function qualifiesForTier(
  tier: BusinessTier,
  metrics: { revenue: number; locations: number; teamSize: number }
): boolean {
  const req = getTierRequirements(tier);
  // Revenue is the primary qualifier
  // OR both locations AND team size together (can't game with just employees)
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
    trap: 'bg-blue-500',
    block: 'bg-purple-500',
    hood: 'bg-orange-500',
    empire: 'bg-yellow-500',
  };
  return colors[tier];
}

/**
 * Get tier text color
 */
export function getTierTextColor(tier: BusinessTier): string {
  const colors: Record<BusinessTier, string> = {
    street: 'text-gray-600',
    trap: 'text-blue-600',
    block: 'text-purple-600',
    hood: 'text-orange-600',
    empire: 'text-yellow-600',
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

