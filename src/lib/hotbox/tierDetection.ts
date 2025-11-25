/**
 * Tier Detection with Multi-Factor Scoring
 * 
 * Scoring System:
 * - Revenue: 0-50 points (>=$500K: 50, >=$200K: 40, >=$50K: 25, >=$10K: 10)
 * - Locations: 0-25 points (>=5: 25, >=3: 18, >=2: 10)
 * - Employees: 0-25 points (>=30: 25, >=15: 18, >=5: 10, >=2: 5)
 * 
 * Tier Thresholds:
 * - Empire: 80+ points
 * - Hood: 55+ points
 * - Block: 35+ points
 * - Trap: 15+ points
 * - Street: <15 points
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  BusinessTier, 
  TenantMetrics, 
  TierScoring, 
  TierDetectionResult,
  TIER_SCORE_THRESHOLDS,
} from '@/types/hotbox';

// ============================================================
// SCORING FUNCTIONS
// ============================================================

/**
 * Calculate revenue score (0-50 points)
 */
export function calculateRevenueScore(monthlyRevenue: number): number {
  if (monthlyRevenue >= 500000) return 50;
  if (monthlyRevenue >= 200000) return 40;
  if (monthlyRevenue >= 50000) return 25;
  if (monthlyRevenue >= 10000) return 10;
  return 0;
}

/**
 * Calculate locations score (0-25 points)
 */
export function calculateLocationsScore(locationCount: number): number {
  if (locationCount >= 5) return 25;
  if (locationCount >= 3) return 18;
  if (locationCount >= 2) return 10;
  return 0;
}

/**
 * Calculate employees score (0-25 points)
 */
export function calculateEmployeesScore(employeeCount: number): number {
  if (employeeCount >= 30) return 25;
  if (employeeCount >= 15) return 18;
  if (employeeCount >= 5) return 10;
  if (employeeCount >= 2) return 5;
  return 0;
}

/**
 * Calculate complete tier scoring
 */
export function calculateTierScoring(metrics: TenantMetrics): TierScoring {
  const revenue = calculateRevenueScore(metrics.monthlyRevenue);
  const locations = calculateLocationsScore(metrics.locationCount);
  const employees = calculateEmployeesScore(metrics.employeeCount);
  
  return {
    revenue,
    locations,
    employees,
    total: revenue + locations + employees,
  };
}

/**
 * Determine tier from total score
 */
export function getTierFromScore(score: number): BusinessTier {
  if (score >= TIER_SCORE_THRESHOLDS.empire) return 'empire';
  if (score >= TIER_SCORE_THRESHOLDS.hood) return 'hood';
  if (score >= TIER_SCORE_THRESHOLDS.block) return 'block';
  if (score >= TIER_SCORE_THRESHOLDS.trap) return 'trap';
  return 'street';
}

/**
 * Get the next tier above the current one
 */
export function getNextTier(currentTier: BusinessTier): BusinessTier | null {
  const tiers: BusinessTier[] = ['street', 'trap', 'block', 'hood', 'empire'];
  const currentIndex = tiers.indexOf(currentTier);
  if (currentIndex < tiers.length - 1) {
    return tiers[currentIndex + 1];
  }
  return null;
}

/**
 * Calculate confidence based on how close to tier boundaries
 */
export function calculateConfidence(
  score: number, 
  tier: BusinessTier
): 'high' | 'medium' | 'low' {
  const thresholds = {
    street: { min: 0, max: 14 },
    trap: { min: 15, max: 34 },
    block: { min: 35, max: 54 },
    hood: { min: 55, max: 79 },
    empire: { min: 80, max: 100 },
  };
  
  const range = thresholds[tier];
  const midpoint = (range.min + range.max) / 2;
  const distanceFromEdge = Math.min(
    Math.abs(score - range.min),
    Math.abs(score - range.max)
  );
  
  // High confidence: far from boundaries (>5 points)
  // Medium confidence: near boundaries (2-5 points)
  // Low confidence: very close to boundaries (<2 points)
  if (distanceFromEdge > 5) return 'high';
  if (distanceFromEdge > 2) return 'medium';
  return 'low';
}

// ============================================================
// DATA FETCHING
// ============================================================

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
    monthlyRevenue,
    averageOrderValue,
    totalOrders,
    activeCustomers: customersResult.count || 0,
    locationCount: Math.max(1, locationsResult.count || 0), // Minimum 1 location
    employeeCount: Math.max(1, employeesResult.count || 0), // Minimum 1 employee
    inventoryValue,
    wholesaleRevenue,
    deliveryCount: deliveriesResult.count || 0,
    posTransactions: posResult.data?.length || 0,
  };
}

// ============================================================
// MAIN DETECTION FUNCTION
// ============================================================

/**
 * Detect business tier using multi-factor scoring
 */
export async function detectBusinessTier(tenantId: string): Promise<TierDetectionResult> {
  const metrics = await fetchTenantMetrics(tenantId);
  const scoring = calculateTierScoring(metrics);
  const tier = getTierFromScore(scoring.total);
  const confidence = calculateConfidence(scoring.total, tier);
  
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
  
  return {
    tier,
    metrics,
    scoring,
    confidence,
    suggestedUpgrade,
  };
}

/**
 * Detect tier from pre-fetched metrics (no database call)
 */
export function detectTierFromMetrics(metrics: TenantMetrics): TierDetectionResult {
  const scoring = calculateTierScoring(metrics);
  const tier = getTierFromScore(scoring.total);
  const confidence = calculateConfidence(scoring.total, tier);
  
  const nextTier = getNextTier(tier);
  let suggestedUpgrade: BusinessTier | undefined;
  
  if (nextTier) {
    const nextThreshold = TIER_SCORE_THRESHOLDS[nextTier];
    const pointsToUpgrade = nextThreshold - scoring.total;
    if (pointsToUpgrade <= 10) {
      suggestedUpgrade = nextTier;
    }
  }
  
  return {
    tier,
    metrics,
    scoring,
    confidence,
    suggestedUpgrade,
  };
}

// ============================================================
// UTILITY EXPORTS
// ============================================================

export {
  TIER_SCORE_THRESHOLDS,
};

