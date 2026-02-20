/**
 * useRouteOptimizer Hook
 *
 * Given multiple pending deliveries, suggests optimal route.
 * Considers:
 * - Delivery addresses
 * - Time windows
 * - Runner location
 * - Package sizes
 *
 * Features:
 * - Route optimization using nearest neighbor algorithm
 * - Mapbox Directions API integration for real route geometry
 * - Estimated time per stop
 * - Total route duration
 * - One-click assignment to runner
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

import type { GeoLocation } from '@/types/interconnected';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

/** Delivery stop with location and metadata */
export interface DeliveryStop {
  id: string;
  orderId: string;
  orderNumber?: string;
  address: string;
  lat: number;
  lng: number;
  customerName?: string;
  customerPhone?: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  packageSize?: 'small' | 'medium' | 'large';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
  estimatedMinutes?: number;
}

/** Optimized route result */
export interface OptimizedRoute {
  stops: DeliveryStop[];
  totalDistanceKm: number;
  totalDistanceMiles: number;
  totalDurationMinutes: number;
  geometry?: GeoJSON.LineString;
  legs?: RouteLeg[];
}

/** Individual leg between stops */
export interface RouteLeg {
  fromStopId: string;
  toStopId: string;
  distanceKm: number;
  durationMinutes: number;
}

/** Runner for assignment */
export interface RunnerForRoute {
  id: string;
  fullName: string;
  phone: string;
  vehicleType: string;
  currentLat: number | null;
  currentLng: number | null;
  activeDeliveries: number;
  rating: number;
}

/** Options for the hook */
export interface UseRouteOptimizerOptions {
  /** Enable/disable auto-fetch of pending deliveries */
  enabled?: boolean;
  /** Starting location (runner's current location or depot) */
  startLocation?: GeoLocation;
  /** Mapbox access token (falls back to env variable) */
  mapboxToken?: string;
}

/** Return type for the hook */
export interface UseRouteOptimizerResult {
  /** Pending deliveries that can be added to route */
  pendingDeliveries: DeliveryStop[];
  /** Loading state for pending deliveries */
  isLoadingDeliveries: boolean;
  /** Error fetching deliveries */
  deliveriesError: Error | null;
  /** Current stops in the route builder */
  stops: DeliveryStop[];
  /** Add a stop to the route */
  addStop: (stop: DeliveryStop) => void;
  /** Remove a stop from the route */
  removeStop: (stopId: string) => void;
  /** Reorder stops manually */
  reorderStops: (newOrder: DeliveryStop[]) => void;
  /** Clear all stops */
  clearStops: () => void;
  /** Optimized route result */
  optimizedRoute: OptimizedRoute | null;
  /** Loading state for optimization */
  isOptimizing: boolean;
  /** Run optimization on current stops */
  optimizeRoute: () => Promise<void>;
  /** Available runners for assignment */
  availableRunners: RunnerForRoute[];
  /** Loading runners */
  isLoadingRunners: boolean;
  /** Assign route to a runner */
  assignToRunner: (runnerId: string) => Promise<boolean>;
  /** Assigning state */
  isAssigning: boolean;
  /** Suggest best runner based on proximity */
  suggestedRunner: RunnerForRoute | null;
  /** Get estimated time for a specific stop */
  getStopEstimate: (stopIndex: number) => { arrivalMinutes: number; cumulativeDistance: number } | null;
}

// ============================================================================
// Constants
// ============================================================================

const METERS_TO_MILES = 0.000621371;
const METERS_TO_KM = 0.001;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Nearest Neighbor algorithm for route optimization
 */
function nearestNeighborOptimization(
  stops: DeliveryStop[],
  startLocation?: GeoLocation
): DeliveryStop[] {
  if (stops.length <= 1) return stops;

  const optimizedOrder: DeliveryStop[] = [];
  const unvisited = [...stops];

  // Start from the given location or the first stop
  let currentLat = startLocation?.lat ?? stops[0].lat;
  let currentLng = startLocation?.lng ?? stops[0].lng;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    // Find the nearest unvisited stop
    for (let i = 0; i < unvisited.length; i++) {
      const stop = unvisited[i];
      const distance = haversineDistance(currentLat, currentLng, stop.lat, stop.lng);

      // Weight by priority
      let weightedDistance = distance;
      if (stop.priority === 'urgent') {
        weightedDistance *= 0.5;
      } else if (stop.priority === 'high') {
        weightedDistance *= 0.7;
      }

      // Consider time windows
      if (stop.timeWindowEnd) {
        const windowEnd = new Date(stop.timeWindowEnd).getTime();
        const now = Date.now();
        const urgencyFactor = Math.max(0.5, 1 - (windowEnd - now) / (3600000 * 2)); // 2 hour window
        weightedDistance *= urgencyFactor;
      }

      if (weightedDistance < minDistance) {
        minDistance = weightedDistance;
        nearestIndex = i;
      }
    }

    const nextStop = unvisited[nearestIndex];
    optimizedOrder.push(nextStop);
    currentLat = nextStop.lat;
    currentLng = nextStop.lng;
    unvisited.splice(nearestIndex, 1);
  }

  return optimizedOrder;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useRouteOptimizer(
  options: UseRouteOptimizerOptions = {}
): UseRouteOptimizerResult {
  const { enabled = true, startLocation, mapboxToken: providedToken } = options;

  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // State
  const [stops, setStops] = useState<DeliveryStop[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const mapboxToken = providedToken || import.meta.env.VITE_MAPBOX_TOKEN;

  // ============================================================================
  // Fetch Pending Deliveries
  // ============================================================================

  const {
    data: pendingDeliveries = [],
    isLoading: isLoadingDeliveries,
    error: deliveriesError,
  } = useQuery({
    queryKey: queryKeys.deliveries.list(tenant?.id, { status: 'pending' }),
    queryFn: async (): Promise<DeliveryStop[]> => {
      if (!tenant?.id) return [];

      const { data, error } = await (supabase as any)
        .from('deliveries')
        .select(`
          id,
          order_id,
          delivery_address,
          delivery_lat,
          delivery_lng,
          customer_name,
          customer_phone,
          scheduled_start,
          scheduled_end,
          package_size,
          priority,
          notes,
          orders!inner (
            tracking_code
          )
        `)
        .eq('tenant_id', tenant.id)
        .in('status', ['pending', 'assigned'])
        .order('priority', { ascending: false })
        .order('scheduled_end', { ascending: true });

      if (error) {
        logger.error('[useRouteOptimizer] Failed to fetch pending deliveries', error);
        throw error;
      }

      return (data || []).map((d: any) => ({
        id: d.id,
        orderId: d.order_id,
        orderNumber: d.orders?.tracking_code,
        address: d.delivery_address || '',
        lat: d.delivery_lat || 0,
        lng: d.delivery_lng || 0,
        customerName: d.customer_name,
        customerPhone: d.customer_phone,
        timeWindowStart: d.scheduled_start,
        timeWindowEnd: d.scheduled_end,
        packageSize: d.package_size as DeliveryStop['packageSize'],
        priority: d.priority as DeliveryStop['priority'],
        notes: d.notes,
      }));
    },
    enabled: enabled && !!tenant?.id,
    staleTime: 1000 * 60, // 1 minute
  });

  // ============================================================================
  // Fetch Available Runners
  // ============================================================================

  const {
    data: availableRunners = [],
    isLoading: isLoadingRunners,
  } = useQuery({
    queryKey: queryKeys.runners.available(),
    queryFn: async (): Promise<RunnerForRoute[]> => {
      if (!tenant?.id) return [];

      // Fetch runners with their active delivery count
      const { data: runners, error } = await supabase
        .from('wholesale_runners')
        .select(`
          id,
          full_name,
          phone,
          vehicle_type,
          current_lat,
          current_lng,
          rating
        `)
        .eq('tenant_id', tenant.id)
        .eq('status', 'available');

      if (error) {
        logger.error('[useRouteOptimizer] Failed to fetch runners', error);
        throw error;
      }

      // Get active delivery counts
      const runnerIds = (runners || []).map((r) => r.id);
      const { data: deliveryCounts } = await (supabase as any)
        .from('deliveries')
        .select('runner_id')
        .eq('tenant_id', tenant.id)
        .in('runner_id', runnerIds)
        .in('status', ['assigned', 'picked_up', 'in_transit']);

      const countMap = new Map<string, number>();
      (deliveryCounts || []).forEach((d: any) => {
        const current = countMap.get(d.runner_id) || 0;
        countMap.set(d.runner_id, current + 1);
      });

      return (runners || []).map((r) => ({
        id: r.id,
        fullName: r.full_name,
        phone: r.phone || '',
        vehicleType: r.vehicle_type || 'car',
        currentLat: r.current_lat,
        currentLng: r.current_lng,
        activeDeliveries: countMap.get(r.id) || 0,
        rating: r.rating || 0,
      }));
    },
    enabled: enabled && !!tenant?.id,
    staleTime: 1000 * 30, // 30 seconds
  });

  // ============================================================================
  // Suggested Runner (based on proximity to first stop)
  // ============================================================================

  const suggestedRunner = useMemo(() => {
    if (stops.length === 0 || availableRunners.length === 0) return null;

    const firstStop = stops[0];
    let bestRunner: RunnerForRoute | null = null;
    let bestScore = Infinity;

    for (const runner of availableRunners) {
      if (!runner.currentLat || !runner.currentLng) continue;

      const distance = haversineDistance(
        firstStop.lat,
        firstStop.lng,
        runner.currentLat,
        runner.currentLng
      );

      // Score: lower is better
      // Factor in active deliveries (fewer is better) and rating (higher is better)
      const score = distance * (1 + runner.activeDeliveries * 0.2) / (1 + runner.rating * 0.1);

      if (score < bestScore) {
        bestScore = score;
        bestRunner = runner;
      }
    }

    return bestRunner;
  }, [stops, availableRunners]);

  // ============================================================================
  // Stop Management
  // ============================================================================

  const addStop = useCallback((stop: DeliveryStop) => {
    setStops((prev) => {
      // Avoid duplicates
      if (prev.some((s) => s.id === stop.id)) return prev;
      return [...prev, stop];
    });
    // Reset optimization when stops change
    setOptimizedRoute(null);
  }, []);

  const removeStop = useCallback((stopId: string) => {
    setStops((prev) => prev.filter((s) => s.id !== stopId));
    setOptimizedRoute(null);
  }, []);

  const reorderStops = useCallback((newOrder: DeliveryStop[]) => {
    setStops(newOrder);
    setOptimizedRoute(null);
  }, []);

  const clearStops = useCallback(() => {
    setStops([]);
    setOptimizedRoute(null);
  }, []);

  // ============================================================================
  // Route Optimization
  // ============================================================================

  const optimizeRoute = useCallback(async () => {
    if (stops.length < 2) {
      logger.warn('[useRouteOptimizer] Need at least 2 stops to optimize');
      return;
    }

    setIsOptimizing(true);

    try {
      // Step 1: Run nearest neighbor optimization
      const optimizedStops = nearestNeighborOptimization(stops, startLocation);

      // Step 2: Fetch actual route from Mapbox Directions API
      let geometry: GeoJSON.LineString | undefined;
      let legs: RouteLeg[] = [];
      let totalDistanceMeters = 0;
      let totalDurationSeconds = 0;

      if (mapboxToken && optimizedStops.length >= 2) {
        const coordinates = optimizedStops
          .map((s) => `${s.lng},${s.lat}`)
          .join(';');

        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&steps=false&access_token=${mapboxToken}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          geometry = route.geometry;
          totalDistanceMeters = route.distance;
          totalDurationSeconds = route.duration;

          // Parse legs
          if (route.legs) {
            legs = route.legs.map((leg: { distance: number; duration: number }, index: number) => ({
              fromStopId: optimizedStops[index].id,
              toStopId: optimizedStops[index + 1]?.id || optimizedStops[index].id,
              distanceKm: leg.distance * METERS_TO_KM,
              durationMinutes: Math.round(leg.duration / 60),
            }));
          }
        } else {
          logger.warn('[useRouteOptimizer] Mapbox did not return route', data);
        }
      }

      // Step 3: Calculate estimates for each stop
      let cumulativeMinutes = 0;
      const stopsWithEstimates = optimizedStops.map((stop, index) => {
        if (index > 0 && legs[index - 1]) {
          cumulativeMinutes += legs[index - 1].durationMinutes;
        }
        return {
          ...stop,
          estimatedMinutes: cumulativeMinutes,
        };
      });

      // Step 4: Update state
      setStops(stopsWithEstimates);
      setOptimizedRoute({
        stops: stopsWithEstimates,
        totalDistanceKm: totalDistanceMeters * METERS_TO_KM,
        totalDistanceMiles: totalDistanceMeters * METERS_TO_MILES,
        totalDurationMinutes: Math.round(totalDurationSeconds / 60),
        geometry,
        legs,
      });

      logger.debug('[useRouteOptimizer] Route optimized', {
        stopCount: stopsWithEstimates.length,
        totalDistanceKm: totalDistanceMeters * METERS_TO_KM,
        totalDurationMinutes: Math.round(totalDurationSeconds / 60),
      });
    } catch (error) {
      logger.error('[useRouteOptimizer] Optimization failed', error);
      throw error;
    } finally {
      setIsOptimizing(false);
    }
  }, [stops, startLocation, mapboxToken]);

  // ============================================================================
  // Assign to Runner
  // ============================================================================

  const assignMutation = useMutation({
    mutationFn: async (runnerId: string): Promise<boolean> => {
      if (!tenant?.id || stops.length === 0) {
        logger.warn('[useRouteOptimizer] Cannot assign - no tenant or stops');
        return false;
      }

      // Update all deliveries with the runner assignment
      const deliveryIds = stops.map((s) => s.id);
      const stopOrder = stops.map((s, index) => ({
        id: s.id,
        route_order: index + 1,
      }));

      const { error } = await (supabase as any)
        .from('deliveries')
        .update({
          runner_id: runnerId,
          status: 'assigned',
          assigned_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenant.id)
        .in('id', deliveryIds);

      if (error) {
        logger.error('[useRouteOptimizer] Failed to assign runner', error);
        throw error;
      }

      // Update route order for each delivery
      for (const item of stopOrder) {
        await (supabase as any)
          .from('deliveries')
          .update({ route_order: item.route_order })
          .eq('id', item.id)
          .eq('tenant_id', tenant.id);
      }

      // Invalidate related queries
      await queryClient.invalidateQueries({
        queryKey: queryKeys.deliveries.lists(),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.runners.available(),
      });

      logger.info('[useRouteOptimizer] Route assigned to runner', {
        runnerId,
        deliveryCount: deliveryIds.length,
      });

      return true;
    },
    onSuccess: () => {
      toast.success('Route assigned to runner successfully');
    },
    onError: (error) => {
      toast.error(humanizeError(error, 'Failed to assign route to runner'));
    },
  });

  const assignToRunner = useCallback(
    async (runnerId: string): Promise<boolean> => {
      try {
        return await assignMutation.mutateAsync(runnerId);
      } catch {
        return false;
      }
    },
    [assignMutation]
  );

  // ============================================================================
  // Get Stop Estimate
  // ============================================================================

  const getStopEstimate = useCallback(
    (stopIndex: number): { arrivalMinutes: number; cumulativeDistance: number } | null => {
      if (!optimizedRoute || stopIndex < 0 || stopIndex >= optimizedRoute.stops.length) {
        return null;
      }

      let cumulativeDistance = 0;
      let arrivalMinutes = 0;

      for (let i = 0; i < stopIndex; i++) {
        const leg = optimizedRoute.legs?.[i];
        if (leg) {
          cumulativeDistance += leg.distanceKm;
          arrivalMinutes += leg.durationMinutes;
        }
      }

      return { arrivalMinutes, cumulativeDistance };
    },
    [optimizedRoute]
  );

  // ============================================================================
  // Return
  // ============================================================================

  return {
    pendingDeliveries,
    isLoadingDeliveries,
    deliveriesError: deliveriesError as Error | null,
    stops,
    addStop,
    removeStop,
    reorderStops,
    clearStops,
    optimizedRoute,
    isOptimizing,
    optimizeRoute,
    availableRunners,
    isLoadingRunners,
    assignToRunner,
    isAssigning: assignMutation.isPending,
    suggestedRunner,
    getStopEstimate,
  };
}

export default useRouteOptimizer;
