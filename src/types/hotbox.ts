/**
 * Hotbox Type Definitions
 * 
 * Complete type system for the Hotbox Command Center
 * including attention queue, tier detection, and metrics.
 */

// ============================================================
// BUSINESS TIER TYPES
// ============================================================

export type BusinessTier = 'street' | 'trap' | 'block' | 'hood' | 'empire';

export interface TierThresholds {
  minRevenue: number;
  maxRevenue: number;
  minLocations: number;
  maxLocations: number;
  minEmployees: number;
  maxEmployees: number;
}

export interface TierScoring {
  revenue: number;      // 0-50 points
  locations: number;    // 0-25 points
  employees: number;    // 0-25 points
  total: number;        // 0-100 points
}

export interface TierDetectionResult {
  tier: BusinessTier;
  metrics: TenantMetrics;
  scoring: TierScoring;
  confidence: 'high' | 'medium' | 'low';
  suggestedUpgrade?: BusinessTier;
}

// ============================================================
// TENANT METRICS
// ============================================================

export interface TenantMetrics {
  tenantId: string;
  revenue: number;
  monthlyRevenue: number;
  averageOrderValue: number;
  totalOrders: number;
  activeCustomers: number;
  locationCount: number;
  employeeCount: number;
  locations: number;
  teamSize: number;
  inventoryValue: number;
  wholesaleRevenue: number;
  deliveryCount: number;
  posTransactions: number;
}

export interface LocationMetrics {
  id: string;
  name: string;
  revenue: number;
  margin: number;
  orders: number;
  status: 'healthy' | 'warning' | 'critical';
  issues: number;
}

export interface TeamMemberStatus {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'break' | 'offline';
  avatar?: string;
  currentTask?: string;
  metrics?: {
    sales?: number;
    deliveries?: number;
    orders?: number;
  };
}

// ============================================================
// ATTENTION QUEUE TYPES
// ============================================================

export type AlertPriority = 'critical' | 'important' | 'info';

export type AlertCategory = 
  | 'orders' 
  | 'inventory' 
  | 'delivery' 
  | 'customers' 
  | 'compliance' 
  | 'team' 
  | 'financial'
  | 'system';

export interface AttentionItem {
  id: string;
  priority: AlertPriority;
  category: AlertCategory;
  title: string;
  description?: string;
  value?: number;          // Dollar amount for scoring
  valueDisplay?: string;   // Formatted display value
  actionLabel: string;
  actionRoute: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  // Computed by scoring algorithm
  score?: number;
}

export interface AttentionQueue {
  critical: AttentionItem[];
  important: AttentionItem[];
  info: AttentionItem[];
  all: AttentionItem[];    // All items sorted by score
  totalCount: number;
  lastUpdated: Date;
}

// ============================================================
// PULSE METRICS
// ============================================================

export type MetricFormat = 'currency' | 'number' | 'percent' | 'text';

export interface MetricTrend {
  direction: 'up' | 'down' | 'flat';
  value: number;
  label: string;
}

export interface PulseMetric {
  id: string;
  label: string;
  value: number | string;
  format: MetricFormat;
  trend?: MetricTrend;
  alert?: boolean;
  subtext?: string;
}

export interface DailyPulse {
  revenue: PulseMetric;
  profit: PulseMetric;
  orders: PulseMetric;
  pendingActions: PulseMetric;
}

// ============================================================
// QUICK ACTIONS
// ============================================================

export interface QuickAction {
  id: string;
  label: string;
  icon: string | any;
  path: string;
  route?: string;
  shortcut?: string;
  priority?: number;
  isPersonalized?: boolean;
}

// ============================================================
// NAVIGATION
// ============================================================

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  badge?: number;
  children?: NavItem[];
  requiredTier?: BusinessTier;
}

export interface NavSection {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
  collapsed?: boolean;
}

// ============================================================
// GREETING SYSTEM
// ============================================================

export interface TierGreetings {
  tier: BusinessTier;
  messages: string[];
}

export interface Greeting {
  timeGreeting: string;
  tierMessage: string;
  full: string;
}

// ============================================================
// HOTBOX STATE
// ============================================================

export interface HotboxState {
  tier: BusinessTier;
  pulse: DailyPulse | null;
  attention: AttentionQueue | null;
  locations?: LocationMetrics[];
  team?: TeamMemberStatus[];
  quickActions: QuickAction[];
  greeting: Greeting;
  lastRefresh: Date;
  isLoading: boolean;
  error?: string;
}

// ============================================================
// SCORING CONSTANTS
// ============================================================

export const PRIORITY_WEIGHTS: Record<AlertPriority, number> = {
  critical: 1000,
  important: 100,
  info: 10,
};

export const CATEGORY_URGENCY: Record<AlertCategory, number> = {
  orders: 50,      // Orders = money waiting
  delivery: 45,    // Active operations
  compliance: 40,  // Legal/regulatory
  system: 35,      // Technical issues
  inventory: 30,   // Stock issues
  customers: 25,   // Relationship management
  financial: 20,   // Money tracking
  team: 15,        // People management
};

export const AGE_DECAY_HOURS = 24;

export const TIER_SCORE_THRESHOLDS = {
  empire: 80,
  hood: 55,
  block: 35,
  trap: 15,
  street: 0,
} as const;

