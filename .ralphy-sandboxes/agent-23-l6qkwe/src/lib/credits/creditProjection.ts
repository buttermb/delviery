/**
 * Credit Projection Service
 * 
 * Calculates projected credit depletion based on usage patterns.
 * Provides estimated days remaining and depletion date.
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { FREE_TIER_MONTHLY_CREDITS } from './creditCosts';

// ============================================================================
// Types
// ============================================================================

export interface CreditProjection {
  /** Estimated days until credits run out */
  daysRemaining: number | null;
  /** Estimated date when credits will be depleted */
  depletionDate: Date | null;
  /** Average daily credit burn rate */
  avgDailyBurn: number;
  /** Average weekly credit burn rate */
  avgWeeklyBurn: number;
  /** Confidence level based on data availability */
  confidence: 'high' | 'medium' | 'low' | 'none';
  /** Number of days of data used for projection */
  dataPointDays: number;
  /** Total credits used in the analysis period */
  totalUsed: number;
  /** Burn rate trend (increasing, stable, decreasing) */
  trend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  /** Human-readable message */
  message: string;
}

export interface UsageStats {
  today: number;
  yesterday: number;
  lastWeek: number;
  lastMonth: number;
  avgDaily: number;
}

// ============================================================================
// Main Projection Function
// ============================================================================

/**
 * Calculate projected credit depletion based on historical usage
 */
export async function projectDepletion(
  tenantId: string,
  currentBalance: number
): Promise<CreditProjection> {
  try {
    // Fetch usage data from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: transactions, error } = await supabase
      .from('credit_transactions')
      .select('amount, created_at')
      .eq('tenant_id', tenantId)
      .eq('transaction_type', 'usage')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch transactions for projection', { error });
      return getDefaultProjection(currentBalance, 'Failed to load usage data');
    }

    if (!transactions || transactions.length === 0) {
      return getDefaultProjection(currentBalance, 'No usage data yet. Start using credits to see projections.');
    }

    // Calculate daily usage
    const dailyUsage = calculateDailyUsage(transactions);
    const dataPointDays = Object.keys(dailyUsage).length;

    // Need at least 3 days of data for reasonable projection
    if (dataPointDays < 3) {
      const totalUsed = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return {
        daysRemaining: null,
        depletionDate: null,
        avgDailyBurn: totalUsed / dataPointDays,
        avgWeeklyBurn: (totalUsed / dataPointDays) * 7,
        confidence: 'low',
        dataPointDays,
        totalUsed,
        trend: 'unknown',
        message: 'Need more usage data for accurate projections (at least 3 days)',
      };
    }

    // Calculate averages
    const dailyValues = Object.values(dailyUsage);
    const totalUsed = dailyValues.reduce((sum, val) => sum + val, 0);
    const avgDailyBurn = totalUsed / dataPointDays;
    const avgWeeklyBurn = avgDailyBurn * 7;

    // Calculate trend (compare first half to second half)
    const trend = calculateTrend(dailyValues);

    // Calculate confidence based on data quality
    const confidence = calculateConfidence(dataPointDays, dailyValues);

    // Project depletion
    let daysRemaining: number | null = null;
    let depletionDate: Date | null = null;

    if (avgDailyBurn > 0 && currentBalance > 0) {
      daysRemaining = Math.floor(currentBalance / avgDailyBurn);
      depletionDate = new Date();
      depletionDate.setDate(depletionDate.getDate() + daysRemaining);
    }

    // Generate message
    const message = generateProjectionMessage(daysRemaining, avgDailyBurn, confidence, trend);

    return {
      daysRemaining,
      depletionDate,
      avgDailyBurn: Math.round(avgDailyBurn),
      avgWeeklyBurn: Math.round(avgWeeklyBurn),
      confidence,
      dataPointDays,
      totalUsed,
      trend,
      message,
    };
  } catch (error) {
    logger.error('Error calculating credit projection', { error });
    return getDefaultProjection(currentBalance, 'Unable to calculate projection');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate daily usage from transactions
 */
function calculateDailyUsage(
  transactions: Array<{ amount: number; created_at: string }>
): Record<string, number> {
  const daily: Record<string, number> = {};

  transactions.forEach((t) => {
    const date = new Date(t.created_at).toDateString();
    if (!daily[date]) {
      daily[date] = 0;
    }
    daily[date] += Math.abs(t.amount);
  });

  return daily;
}

/**
 * Calculate usage trend
 */
function calculateTrend(
  dailyValues: number[]
): 'increasing' | 'stable' | 'decreasing' | 'unknown' {
  if (dailyValues.length < 6) {
    return 'unknown';
  }

  const midpoint = Math.floor(dailyValues.length / 2);
  const firstHalf = dailyValues.slice(0, midpoint);
  const secondHalf = dailyValues.slice(midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (percentChange > 20) return 'increasing';
  if (percentChange < -20) return 'decreasing';
  return 'stable';
}

/**
 * Calculate confidence level
 */
function calculateConfidence(
  dataPointDays: number,
  dailyValues: number[]
): 'high' | 'medium' | 'low' | 'none' {
  if (dataPointDays < 3) return 'none';
  if (dataPointDays < 7) return 'low';

  // Check for consistency (coefficient of variation)
  const mean = dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
  const variance =
    dailyValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyValues.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  // Lower CV = more consistent = higher confidence
  if (dataPointDays >= 14 && cv < 0.5) return 'high';
  if (dataPointDays >= 7 && cv < 0.8) return 'medium';
  return 'low';
}

/**
 * Generate human-readable projection message
 */
function generateProjectionMessage(
  daysRemaining: number | null,
  avgDailyBurn: number,
  confidence: string,
  trend: string
): string {
  if (daysRemaining === null || avgDailyBurn === 0) {
    return 'Not enough data to project depletion';
  }

  let message = '';

  if (daysRemaining <= 0) {
    message = 'You may run out of credits today!';
  } else if (daysRemaining <= 3) {
    message = `Credits may run out in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
  } else if (daysRemaining <= 7) {
    message = `About ${daysRemaining} days of credits remaining`;
  } else if (daysRemaining <= 14) {
    message = `Approximately ${daysRemaining} days until refresh/depletion`;
  } else {
    message = `Credits should last ${daysRemaining}+ days at current pace`;
  }

  // Add trend context
  if (trend === 'increasing') {
    message += ' (usage increasing)';
  } else if (trend === 'decreasing') {
    message += ' (usage decreasing)';
  }

  // Add confidence qualifier
  if (confidence === 'low') {
    message += ' - estimate may vary';
  }

  return message;
}

/**
 * Get default projection when data is unavailable
 */
function getDefaultProjection(_currentBalance: number, message: string): CreditProjection {
  return {
    daysRemaining: null,
    depletionDate: null,
    avgDailyBurn: 0,
    avgWeeklyBurn: 0,
    confidence: 'none',
    dataPointDays: 0,
    totalUsed: 0,
    trend: 'unknown',
    message,
  };
}

// ============================================================================
// Usage Stats Function
// ============================================================================

/**
 * Get usage statistics for different time periods
 */
export async function getUsageStats(tenantId: string): Promise<UsageStats> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);

  try {
    const { data: transactions, error } = await supabase
      .from('credit_transactions')
      .select('amount, created_at')
      .eq('tenant_id', tenantId)
      .eq('transaction_type', 'usage')
      .gte('created_at', monthAgo.toISOString());

    if (error || !transactions) {
      return { today: 0, yesterday: 0, lastWeek: 0, lastMonth: 0, avgDaily: 0 };
    }

    const today = transactions
      .filter((t) => new Date(t.created_at) >= todayStart)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const yesterday = transactions
      .filter(
        (t) =>
          new Date(t.created_at) >= yesterdayStart && new Date(t.created_at) < todayStart
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const lastWeek = transactions
      .filter((t) => new Date(t.created_at) >= weekAgo)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const lastMonth = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const avgDaily = lastMonth / 30;

    return {
      today,
      yesterday,
      lastWeek,
      lastMonth,
      avgDaily: Math.round(avgDaily),
    };
  } catch (error) {
    logger.error('Error getting usage stats', { error });
    return { today: 0, yesterday: 0, lastWeek: 0, lastMonth: 0, avgDaily: 0 };
  }
}

// ============================================================================
// Pace Comparison
// ============================================================================

/**
 * Compare current pace to sustainable pace (credits lasting full month)
 */
export function getPaceComparison(
  avgDailyBurn: number,
  daysInMonth: number = 30
): {
  sustainableDailyBurn: number;
  percentOverPace: number;
  isSustainable: boolean;
  message: string;
} {
  const sustainableDailyBurn = Math.floor(FREE_TIER_MONTHLY_CREDITS / daysInMonth);
  const percentOverPace =
    sustainableDailyBurn > 0
      ? Math.round(((avgDailyBurn - sustainableDailyBurn) / sustainableDailyBurn) * 100)
      : 0;
  const isSustainable = avgDailyBurn <= sustainableDailyBurn;

  let message = '';
  if (isSustainable) {
    message = 'Your usage is sustainable for the free tier';
  } else if (percentOverPace > 100) {
    message = `Using credits ${percentOverPace}% faster than sustainable - consider upgrading`;
  } else if (percentOverPace > 50) {
    message = `Usage is ${percentOverPace}% over sustainable pace`;
  } else {
    message = `Slightly over sustainable pace (${percentOverPace}%)`;
  }

  return {
    sustainableDailyBurn,
    percentOverPace,
    isSustainable,
    message,
  };
}







