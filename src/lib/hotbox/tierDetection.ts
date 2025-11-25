/**
 * Tier Detection Logic
 * Implements multi-factor scoring system for business tiers
 */

import { TenantMetrics, TierScore, TierThresholds } from '@/types/hotbox';
import { BusinessTier } from '@/lib/presets/businessTiers';

// Scoring Configuration
const SCORING_CONFIG = {
  revenue: {
    maxPoints: 50,
    thresholds: [
      { value: 500000, points: 50 },
      { value: 200000, points: 40 },
      { value: 50000, points: 25 },
      { value: 10000, points: 10 },
    ]
  },
  locations: {
    maxPoints: 25,
    thresholds: [
      { value: 5, points: 25 },
      { value: 3, points: 18 },
      { value: 2, points: 10 },
    ]
  },
  team: {
    maxPoints: 25,
    thresholds: [
      { value: 30, points: 25 },
      { value: 15, points: 18 },
      { value: 5, points: 10 },
      { value: 2, points: 5 },
    ]
  }
};

export const TIER_SCORE_THRESHOLDS = {
  empire: 80,
  hood: 55,
  block: 35,
  trap: 15,
  street: 0
};

/**
 * Calculate the tier score based on metrics
 */
export function calculateTierScore(metrics: TenantMetrics): TierScore {
  let revenuePoints = 0;
  let locationPoints = 0;
  let teamPoints = 0;

  // Revenue Scoring
  for (const t of SCORING_CONFIG.revenue.thresholds) {
    if (metrics.monthlyRevenue >= t.value) {
      revenuePoints = t.points;
      break;
    }
  }

  // Location Scoring
  for (const t of SCORING_CONFIG.locations.thresholds) {
    if (metrics.locations >= t.value) {
      locationPoints = t.points;
      break;
    }
  }

  // Team Scoring
  for (const t of SCORING_CONFIG.team.thresholds) {
    if (metrics.teamSize >= t.value) {
      teamPoints = t.points;
      break;
    }
  }

  return {
    total: revenuePoints + locationPoints + teamPoints,
    breakdown: {
      revenue: revenuePoints,
      locations: locationPoints,
      team: teamPoints
    }
  };
}

/**
 * Determine the best tier based on score
 */
export function determineTierFromScore(score: number): BusinessTier {
  if (score >= TIER_SCORE_THRESHOLDS.empire) return 'empire';
  if (score >= TIER_SCORE_THRESHOLDS.hood) return 'hood';
  if (score >= TIER_SCORE_THRESHOLDS.block) return 'block';
  if (score >= TIER_SCORE_THRESHOLDS.trap) return 'trap';
  return 'street';
}

/**
 * Get the next tier and points needed
 */
export function getNextTierProgress(currentScore: number): {
  nextTier: BusinessTier | null;
  pointsNeeded: number;
  progress: number;
} {
  if (currentScore >= TIER_SCORE_THRESHOLDS.empire) {
    return { nextTier: null, pointsNeeded: 0, progress: 100 };
  }

  let nextTier: BusinessTier = 'street';
  let threshold = 0;
  let prevThreshold = 0;

  if (currentScore >= TIER_SCORE_THRESHOLDS.hood) {
    nextTier = 'empire';
    threshold = TIER_SCORE_THRESHOLDS.empire;
    prevThreshold = TIER_SCORE_THRESHOLDS.hood;
  } else if (currentScore >= TIER_SCORE_THRESHOLDS.block) {
    nextTier = 'hood';
    threshold = TIER_SCORE_THRESHOLDS.hood;
    prevThreshold = TIER_SCORE_THRESHOLDS.block;
  } else if (currentScore >= TIER_SCORE_THRESHOLDS.trap) {
    nextTier = 'block';
    threshold = TIER_SCORE_THRESHOLDS.block;
    prevThreshold = TIER_SCORE_THRESHOLDS.trap;
  } else {
    nextTier = 'trap';
    threshold = TIER_SCORE_THRESHOLDS.trap;
    prevThreshold = 0;
  }

  const pointsNeeded = threshold - currentScore;
  const range = threshold - prevThreshold;
  const currentInTier = currentScore - prevThreshold;
  const progress = Math.round((currentInTier / range) * 100);

  return { nextTier, pointsNeeded, progress };
}

// ============================================================
// DATA FETCHING
// ============================================================

import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch tenant metrics from the database
 */
export async function fetchTenantMetrics(tenantId: string): Promise<TenantMetrics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  // Parallel fetch all metrics
  const [
    ordersResult,
    posResult,
    wholesaleResult,
    customersResult,
    locationsResult,
    employeesResult,
    inventoryResult,
    deliveriesResult,
  ] = await Promise.all([
    // Monthly orders revenue
    supabase
      .from('orders')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .not('status', 'in', '("cancelled","rejected","refunded")'),

    // POS transactions revenue
    supabase
      .from('pos_transactions')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .eq('payment_status', 'paid'),

    // Wholesale orders revenue
    supabase
      .from('wholesale_orders')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)
      .in('status', ['completed', 'paid']),

    // Active customers count
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),

    // @ts-expect-error - Deep type instantiation from Supabase query
    // Locations count
    supabase
      .from('locations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),

    // Employees count (tenant_users)
    supabase
      .from('tenant_users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),

    // Inventory value
    supabase
      .from('products')
      .select('price, stock_quantity')
      .eq('tenant_id', tenantId)
      .gt('stock_quantity', 0),

    // @ts-expect-error - Deep type instantiation from Supabase query
    // Deliveries count this month
    supabase
      .from('deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd),
  ]);

  // Calculate totals
  const ordersRevenue = ordersResult.data?.reduce(
    (sum, o) => sum + Number(o.total_amount || 0), 0
  ) || 0;

  const posRevenue = posResult.data?.reduce(
    (sum, t) => sum + Number(t.total_amount || 0), 0
  ) || 0;

  const wholesaleRevenue = wholesaleResult.data?.reduce(
    (sum, o) => sum + Number(o.total_amount || 0), 0
  ) || 0;

  const inventoryValue = inventoryResult.data?.reduce(
    (sum, p) => sum + (Number(p.price || 0) * Number(p.stock_quantity || 0)), 0
  ) || 0;

  const monthlyRevenue = ordersRevenue + posRevenue + wholesaleRevenue;
  const totalOrders = (ordersResult.data?.length || 0) + (posResult.data?.length || 0);
  const averageOrderValue = totalOrders > 0 ? monthlyRevenue / totalOrders : 0;

  return {
    tenantId,
    revenue: monthlyRevenue,
    monthlyRevenue,
    locations: Math.max(1, locationsResult.count || 0),
    teamSize: Math.max(1, employeesResult.count || 0),
    averageOrderValue,
    avgOrderValue: averageOrderValue,
    totalOrders,
    activeCustomers: customersResult.count || 0,
    customerCount: customersResult.count || 0,
    locationCount: Math.max(1, locationsResult.count || 0), // Minimum 1 location
    employeeCount: Math.max(1, employeesResult.count || 0), // Minimum 1 employee
    inventoryValue,
    wholesaleRevenue,
    deliveryCount: deliveriesResult.count || 0,
    posTransactions: posResult.data?.length || 0,
    // Default values for fields not yet fetched
    activeOrders: 0,
    pendingOrders: 0,
    lowStockItems: 0,
  };
}

// ============================================================
// MAIN DETECTION FUNCTION
// ============================================================

import { getNextTier } from '@/lib/presets/businessTiers';

export interface TierDetectionResult {
  nextTier: BusinessTier | null;
  pointsNeeded: number;
  progress: number;
  suggestedUpgrade?: BusinessTier;
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidence(score: number, tier: BusinessTier): number {
  const threshold = TIER_SCORE_THRESHOLDS[tier];
  const nextTier = getNextTier(tier);
  const nextThreshold = nextTier ? TIER_SCORE_THRESHOLDS[nextTier] : 100;

  const range = nextThreshold - threshold;
  const position = score - threshold;

  // Higher confidence if we are well into the tier, lower if on the edge
  return Math.min(100, Math.round((position / range) * 100));
}

/**
 * Detect business tier using multi-factor scoring
 */
export async function detectBusinessTier(tenantId: string): Promise<TierDetectionResult> {
  const metrics = await fetchTenantMetrics(tenantId);
  const scoring = calculateTierScore(metrics);
  const tier = determineTierFromScore(scoring.total);
  // const confidence = calculateConfidence(scoring.total, tier); // Unused for now

  // Check if close to upgrading
  const nextTier = getNextTier(tier);
  let suggestedUpgrade: BusinessTier | undefined;

  if (nextTier) {
    const nextThreshold = TIER_SCORE_THRESHOLDS[nextTier];
    const pointsToUpgrade = nextThreshold - scoring.total;

    // Suggest upgrade if within 10 points of next tier
    if (pointsToUpgrade <= 10) {
      suggestedUpgrade = nextTier;
    }
  }

  const { pointsNeeded, progress } = getNextTierProgress(scoring.total);

  return {
    nextTier: nextTier || null,
    pointsNeeded,
    progress,
    suggestedUpgrade
  };
}
