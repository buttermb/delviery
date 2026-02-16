/**
 * useRunnerMetrics Hook
 *
 * Track runner performance metrics including:
 * - Deliveries completed
 * - Average delivery time
 * - On-time rate
 * - Customer ratings
 * - Exceptions count
 * - Distance covered
 *
 * Also provides:
 * - Weekly performance reports
 * - Runner leaderboard data
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, subWeeks, differenceInMinutes, parseISO, format } from 'date-fns';

import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/hooks/useTenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export interface RunnerMetrics {
  runnerId: string;
  runnerName: string;
  deliveriesCompleted: number;
  avgDeliveryTimeMinutes: number;
  onTimeRate: number;
  customerRating: number | null;
  exceptionsCount: number;
  distanceCoveredKm: number;
  deliveriesThisWeek: number;
  deliveriesLastWeek: number;
  weekOverWeekChange: number;
  status: string;
}

export interface WeeklyPerformanceReport {
  weekStart: string;
  weekEnd: string;
  totalDeliveries: number;
  avgDeliveryTime: number;
  onTimeRate: number;
  exceptionsCount: number;
  topPerformer: {
    runnerId: string;
    runnerName: string;
    deliveries: number;
  } | null;
  runnerBreakdown: Array<{
    runnerId: string;
    runnerName: string;
    deliveries: number;
    avgTime: number;
    onTimeRate: number;
    exceptions: number;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  runnerId: string;
  runnerName: string;
  deliveriesCompleted: number;
  avgDeliveryTimeMinutes: number;
  onTimeRate: number;
  rating: number | null;
  score: number;
}

interface UseRunnerMetricsOptions {
  runnerId?: string;
  enabled?: boolean;
}

interface UseRunnerLeaderboardOptions {
  limit?: number;
  period?: 'week' | 'month' | 'all';
  enabled?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

// Expected delivery time in minutes for on-time calculation
const EXPECTED_DELIVERY_TIME_MINUTES = 60;

// Scoring weights for leaderboard
const SCORE_WEIGHTS = {
  deliveries: 0.3,
  onTimeRate: 0.3,
  avgTime: 0.2,
  rating: 0.2,
};

// =============================================================================
// Hook: useRunnerMetrics
// =============================================================================

export function useRunnerMetrics(options: UseRunnerMetricsOptions = {}) {
  const { runnerId, enabled = true } = options;
  const { tenantId, isReady } = useTenantContext();

  return useQuery({
    queryKey: [...queryKeys.runners.detail(runnerId || ''), 'metrics', tenantId],
    queryFn: async (): Promise<RunnerMetrics | null> => {
      if (!runnerId || !tenantId) return null;

      logger.debug('[useRunnerMetrics] Fetching metrics', { runnerId, tenantId });

      // Fetch runner info
      const { data: runner, error: runnerError } = await supabase
        .from('wholesale_runners')
        .select('id, full_name, rating, total_deliveries, status, tenant_id')
        .eq('id', runnerId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (runnerError) {
        logger.error('[useRunnerMetrics] Failed to fetch runner', runnerError);
        throw runnerError;
      }

      if (!runner) {
        logger.debug('[useRunnerMetrics] Runner not found', { runnerId });
        return null;
      }

      // Get week boundaries
      const now = new Date();
      const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
      const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = subWeeks(thisWeekStart, 1);
      const lastWeekEnd = subWeeks(thisWeekEnd, 1);

      // Fetch completed deliveries with timing info
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('wholesale_deliveries')
        .select('id, created_at, assigned_at, picked_up_at, delivered_at, status')
        .eq('runner_id', runnerId)
        .eq('tenant_id', tenantId)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: false });

      if (deliveriesError) {
        logger.error('[useRunnerMetrics] Failed to fetch deliveries', deliveriesError);
        throw deliveriesError;
      }

      // Fetch exceptions count
      const { count: exceptionsCount, error: exceptionsError } = await (supabase as any)
        .from('delivery_exceptions')
        .select('id', { count: 'exact', head: true })
        .eq('courier_id', runnerId)
        .eq('tenant_id', tenantId);

      if (exceptionsError && exceptionsError.code !== '42P01') {
        // Ignore if table doesn't exist
        logger.error('[useRunnerMetrics] Failed to fetch exceptions', exceptionsError);
      }

      // Fetch location history for distance calculation
      const { data: locationHistory, error: locationError } = await supabase
        .from('runner_location_history')
        .select('latitude, longitude, recorded_at')
        .eq('runner_id', runnerId)
        .gte('recorded_at', thisWeekStart.toISOString())
        .order('recorded_at', { ascending: true });

      if (locationError && locationError.code !== '42P01') {
        logger.debug('[useRunnerMetrics] Location history not available', { error: locationError });
      }

      // Calculate metrics
      const allDeliveries = deliveries || [];
      const deliveriesCompleted = allDeliveries.length;

      // Calculate average delivery time
      let totalDeliveryTime = 0;
      let validTimeCount = 0;
      let onTimeCount = 0;

      allDeliveries.forEach((delivery) => {
        if (delivery.picked_up_at && delivery.delivered_at) {
          const pickupTime = parseISO(delivery.picked_up_at);
          const deliveredTime = parseISO(delivery.delivered_at);
          const minutes = differenceInMinutes(deliveredTime, pickupTime);

          if (minutes > 0 && minutes < 480) { // Exclude outliers (> 8 hours)
            totalDeliveryTime += minutes;
            validTimeCount++;

            if (minutes <= EXPECTED_DELIVERY_TIME_MINUTES) {
              onTimeCount++;
            }
          }
        }
      });

      const avgDeliveryTimeMinutes = validTimeCount > 0
        ? Math.round(totalDeliveryTime / validTimeCount)
        : 0;

      const onTimeRate = validTimeCount > 0
        ? Math.round((onTimeCount / validTimeCount) * 100)
        : 100;

      // Calculate this week and last week deliveries
      const deliveriesThisWeek = allDeliveries.filter((d) => {
        const deliveredAt = d.delivered_at ? parseISO(d.delivered_at) : null;
        return deliveredAt && deliveredAt >= thisWeekStart && deliveredAt <= thisWeekEnd;
      }).length;

      const deliveriesLastWeek = allDeliveries.filter((d) => {
        const deliveredAt = d.delivered_at ? parseISO(d.delivered_at) : null;
        return deliveredAt && deliveredAt >= lastWeekStart && deliveredAt <= lastWeekEnd;
      }).length;

      const weekOverWeekChange = deliveriesLastWeek > 0
        ? Math.round(((deliveriesThisWeek - deliveriesLastWeek) / deliveriesLastWeek) * 100)
        : deliveriesThisWeek > 0 ? 100 : 0;

      // Calculate distance covered from location history
      let distanceCoveredKm = 0;
      const locations = locationHistory || [];

      for (let i = 1; i < locations.length; i++) {
        const prev = locations[i - 1];
        const curr = locations[i];
        if (prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
          distanceCoveredKm += haversineDistance(
            prev.latitude,
            prev.longitude,
            curr.latitude,
            curr.longitude
          );
        }
      }

      const metrics: RunnerMetrics = {
        runnerId: runner.id,
        runnerName: runner.full_name,
        deliveriesCompleted,
        avgDeliveryTimeMinutes,
        onTimeRate,
        customerRating: runner.rating,
        exceptionsCount: exceptionsCount || 0,
        distanceCoveredKm: Math.round(distanceCoveredKm * 10) / 10,
        deliveriesThisWeek,
        deliveriesLastWeek,
        weekOverWeekChange,
        status: runner.status,
      };

      logger.debug('[useRunnerMetrics] Metrics calculated', { runnerId, metrics });
      return metrics;
    },
    enabled: enabled && isReady && !!runnerId && !!tenantId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

// =============================================================================
// Hook: useWeeklyPerformanceReport
// =============================================================================

export function useWeeklyPerformanceReport(weekOffset = 0) {
  const { tenantId, isReady } = useTenantContext();

  const weekBounds = useMemo(() => {
    const targetDate = subWeeks(new Date(), weekOffset);
    return {
      start: startOfWeek(targetDate, { weekStartsOn: 1 }),
      end: endOfWeek(targetDate, { weekStartsOn: 1 }),
    };
  }, [weekOffset]);

  return useQuery({
    queryKey: [...queryKeys.runners.all, 'weekly-report', tenantId, weekOffset],
    queryFn: async (): Promise<WeeklyPerformanceReport> => {
      if (!tenantId) {
        throw new Error('Tenant ID required');
      }

      logger.debug('[useWeeklyPerformanceReport] Fetching report', {
        tenantId,
        weekStart: weekBounds.start.toISOString(),
        weekEnd: weekBounds.end.toISOString(),
      });

      // Fetch all runners
      const { data: runners, error: runnersError } = await supabase
        .from('wholesale_runners')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (runnersError) {
        logger.error('[useWeeklyPerformanceReport] Failed to fetch runners', runnersError);
        throw runnersError;
      }

      // Fetch deliveries for the week
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('wholesale_deliveries')
        .select('id, runner_id, created_at, picked_up_at, delivered_at, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'delivered')
        .gte('delivered_at', weekBounds.start.toISOString())
        .lte('delivered_at', weekBounds.end.toISOString());

      if (deliveriesError) {
        logger.error('[useWeeklyPerformanceReport] Failed to fetch deliveries', deliveriesError);
        throw deliveriesError;
      }

      // Fetch exceptions for the week
      const { data: exceptions, error: exceptionsError } = await (supabase as any)
        .from('delivery_exceptions')
        .select('id, courier_id')
        .eq('tenant_id', tenantId)
        .gte('created_at', weekBounds.start.toISOString())
        .lte('created_at', weekBounds.end.toISOString());

      if (exceptionsError && exceptionsError.code !== '42P01') {
        logger.debug('[useWeeklyPerformanceReport] Exceptions table not available');
      }

      const allDeliveries = deliveries || [];
      const allExceptions = exceptions || [];
      const allRunners = runners || [];

      // Calculate per-runner metrics
      const runnerMap = new Map<string, {
        name: string;
        deliveries: number;
        totalTime: number;
        validTimeCount: number;
        onTimeCount: number;
        exceptions: number;
      }>();

      allRunners.forEach((runner) => {
        runnerMap.set(runner.id, {
          name: runner.full_name,
          deliveries: 0,
          totalTime: 0,
          validTimeCount: 0,
          onTimeCount: 0,
          exceptions: 0,
        });
      });

      allDeliveries.forEach((delivery) => {
        const runnerData = runnerMap.get(delivery.runner_id);
        if (runnerData) {
          runnerData.deliveries++;

          if (delivery.picked_up_at && delivery.delivered_at) {
            const minutes = differenceInMinutes(
              parseISO(delivery.delivered_at),
              parseISO(delivery.picked_up_at)
            );

            if (minutes > 0 && minutes < 480) {
              runnerData.totalTime += minutes;
              runnerData.validTimeCount++;

              if (minutes <= EXPECTED_DELIVERY_TIME_MINUTES) {
                runnerData.onTimeCount++;
              }
            }
          }
        }
      });

      allExceptions.forEach((exception: any) => {
        if (exception.courier_id) {
          const runnerData = runnerMap.get(exception.courier_id);
          if (runnerData) {
            runnerData.exceptions++;
          }
        }
      });

      // Build breakdown
      const runnerBreakdown = Array.from(runnerMap.entries())
        .map(([runnerId, data]) => ({
          runnerId,
          runnerName: data.name,
          deliveries: data.deliveries,
          avgTime: data.validTimeCount > 0
            ? Math.round(data.totalTime / data.validTimeCount)
            : 0,
          onTimeRate: data.validTimeCount > 0
            ? Math.round((data.onTimeCount / data.validTimeCount) * 100)
            : 100,
          exceptions: data.exceptions,
        }))
        .filter((r) => r.deliveries > 0)
        .sort((a, b) => b.deliveries - a.deliveries);

      // Calculate totals
      const totalDeliveries = allDeliveries.length;
      const totalTime = runnerBreakdown.reduce((sum, r) => sum + (r.avgTime * r.deliveries), 0);
      const totalOnTimeDeliveries = runnerBreakdown.reduce(
        (sum, r) => sum + Math.round((r.onTimeRate / 100) * r.deliveries),
        0
      );

      const topPerformer = runnerBreakdown.length > 0
        ? {
            runnerId: runnerBreakdown[0].runnerId,
            runnerName: runnerBreakdown[0].runnerName,
            deliveries: runnerBreakdown[0].deliveries,
          }
        : null;

      const report: WeeklyPerformanceReport = {
        weekStart: format(weekBounds.start, 'yyyy-MM-dd'),
        weekEnd: format(weekBounds.end, 'yyyy-MM-dd'),
        totalDeliveries,
        avgDeliveryTime: totalDeliveries > 0
          ? Math.round(totalTime / totalDeliveries)
          : 0,
        onTimeRate: totalDeliveries > 0
          ? Math.round((totalOnTimeDeliveries / totalDeliveries) * 100)
          : 100,
        exceptionsCount: allExceptions.length,
        topPerformer,
        runnerBreakdown,
      };

      logger.debug('[useWeeklyPerformanceReport] Report generated', { report });
      return report;
    },
    enabled: isReady && !!tenantId,
    staleTime: 60000, // 1 minute
  });
}

// =============================================================================
// Hook: useRunnerLeaderboard
// =============================================================================

export function useRunnerLeaderboard(options: UseRunnerLeaderboardOptions = {}) {
  const { limit = 10, period = 'week', enabled = true } = options;
  const { tenantId, isReady } = useTenantContext();

  const dateBounds = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'week':
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case 'month':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        };
      case 'all':
      default:
        return { start: null, end: null };
    }
  }, [period]);

  return useQuery({
    queryKey: [...queryKeys.runners.all, 'leaderboard', tenantId, period, limit],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      if (!tenantId) {
        throw new Error('Tenant ID required');
      }

      logger.debug('[useRunnerLeaderboard] Fetching leaderboard', { tenantId, period, limit });

      // Fetch all active runners
      const { data: runners, error: runnersError } = await supabase
        .from('wholesale_runners')
        .select('id, full_name, rating, total_deliveries')
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (runnersError) {
        logger.error('[useRunnerLeaderboard] Failed to fetch runners', runnersError);
        throw runnersError;
      }

      // Build query for deliveries
      let deliveriesQuery = supabase
        .from('wholesale_deliveries')
        .select('id, runner_id, picked_up_at, delivered_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'delivered');

      if (dateBounds.start && dateBounds.end) {
        deliveriesQuery = deliveriesQuery
          .gte('delivered_at', dateBounds.start.toISOString())
          .lte('delivered_at', dateBounds.end.toISOString());
      }

      const { data: deliveries, error: deliveriesError } = await deliveriesQuery;

      if (deliveriesError) {
        logger.error('[useRunnerLeaderboard] Failed to fetch deliveries', deliveriesError);
        throw deliveriesError;
      }

      const allRunners = runners || [];
      const allDeliveries = deliveries || [];

      // Calculate metrics per runner
      const runnerMetrics = new Map<string, {
        name: string;
        deliveries: number;
        totalTime: number;
        validTimeCount: number;
        onTimeCount: number;
        rating: number | null;
      }>();

      allRunners.forEach((runner) => {
        runnerMetrics.set(runner.id, {
          name: runner.full_name,
          deliveries: 0,
          totalTime: 0,
          validTimeCount: 0,
          onTimeCount: 0,
          rating: runner.rating,
        });
      });

      allDeliveries.forEach((delivery) => {
        const metrics = runnerMetrics.get(delivery.runner_id);
        if (metrics) {
          metrics.deliveries++;

          if (delivery.picked_up_at && delivery.delivered_at) {
            const minutes = differenceInMinutes(
              parseISO(delivery.delivered_at),
              parseISO(delivery.picked_up_at)
            );

            if (minutes > 0 && minutes < 480) {
              metrics.totalTime += minutes;
              metrics.validTimeCount++;

              if (minutes <= EXPECTED_DELIVERY_TIME_MINUTES) {
                metrics.onTimeCount++;
              }
            }
          }
        }
      });

      // Calculate scores and build leaderboard
      const maxDeliveries = Math.max(...Array.from(runnerMetrics.values()).map((m) => m.deliveries), 1);

      const leaderboard: LeaderboardEntry[] = Array.from(runnerMetrics.entries())
        .map(([runnerId, metrics]) => {
          const avgTime = metrics.validTimeCount > 0
            ? Math.round(metrics.totalTime / metrics.validTimeCount)
            : 0;
          const onTimeRate = metrics.validTimeCount > 0
            ? Math.round((metrics.onTimeCount / metrics.validTimeCount) * 100)
            : 100;

          // Calculate composite score (0-100)
          const deliveryScore = (metrics.deliveries / maxDeliveries) * 100;
          const onTimeScore = onTimeRate;
          const avgTimeScore = avgTime > 0
            ? Math.max(0, 100 - ((avgTime - 20) * 2)) // Penalty for times > 20 min
            : 100;
          const ratingScore = metrics.rating !== null
            ? (metrics.rating / 5) * 100
            : 80; // Default for no rating

          const score = Math.round(
            deliveryScore * SCORE_WEIGHTS.deliveries +
            onTimeScore * SCORE_WEIGHTS.onTimeRate +
            avgTimeScore * SCORE_WEIGHTS.avgTime +
            ratingScore * SCORE_WEIGHTS.rating
          );

          return {
            rank: 0, // Will be set after sorting
            runnerId,
            runnerName: metrics.name,
            deliveriesCompleted: metrics.deliveries,
            avgDeliveryTimeMinutes: avgTime,
            onTimeRate,
            rating: metrics.rating,
            score,
          };
        })
        .filter((entry) => entry.deliveriesCompleted > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

      logger.debug('[useRunnerLeaderboard] Leaderboard generated', { count: leaderboard.length });
      return leaderboard;
    },
    enabled: enabled && isReady && !!tenantId,
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
  });
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export default useRunnerMetrics;
