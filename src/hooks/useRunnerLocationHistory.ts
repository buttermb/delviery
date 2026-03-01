import { logger } from '@/lib/logger';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { queryKeys } from '@/lib/queryKeys';

export interface LocationPoint {
  id: string;
  runner_id: string;
  delivery_id: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  altitude: number | null;
  recorded_at: string;
  battery_level: number | null;
  is_moving: boolean;
}

export interface RouteStatistics {
  total_distance: number;
  total_duration: string;
  average_speed: number;
  max_speed: number;
  points_count: number;
}

interface UseRunnerLocationHistoryProps {
  runnerId?: string;
  deliveryId?: string;
  startTime?: string;
  endTime?: string;
  enableRealtime?: boolean;
}

export function useRunnerLocationHistory({
  runnerId,
  deliveryId,
  startTime,
  endTime,
  enableRealtime = false
}: UseRunnerLocationHistoryProps) {
  const [realtimeLocations, setRealtimeLocations] = useState<LocationPoint[]>([]);

  // Fetch location history
  const { data: locations = [], refetch, isLoading } = useQuery({
    queryKey: queryKeys.runnerLocationHistory.track(runnerId, deliveryId, startTime, endTime),
    queryFn: async () => {
      if (!runnerId) return [];

      let query = supabase
        .from('runner_location_history')
        .select('id, runner_id, delivery_id, latitude, longitude, accuracy, speed, heading, altitude, recorded_at, battery_level, is_moving')
        .eq('runner_id', runnerId)
        .order('recorded_at', { ascending: true });

      if (deliveryId) {
        query = query.eq('delivery_id', deliveryId);
      }

      if (startTime) {
        query = query.gte('recorded_at', startTime);
      }

      if (endTime) {
        query = query.lte('recorded_at', endTime);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching location history:', error);
        throw error;
      }

      return data as LocationPoint[];
    },
    enabled: !!runnerId,
    refetchInterval: enableRealtime ? false : 30000, // Refetch every 30 seconds if not using realtime
  });

  // Fetch route statistics
  const { data: statistics } = useQuery({
    queryKey: queryKeys.runnerLocationHistory.routeStats(runnerId, deliveryId, startTime, endTime),
    queryFn: async () => {
      if (!runnerId) return null;

      const { data, error } = await supabase
        .rpc('get_route_statistics', {
          p_runner_id: runnerId,
          p_delivery_id: deliveryId || null,
          p_start_time: startTime || null,
          p_end_time: endTime || null,
        });

      if (error) {
        logger.error('Error fetching route statistics:', error);
        return null;
      }

      return data?.[0] as RouteStatistics | null;
    },
    enabled: !!runnerId && locations.length > 0,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!enableRealtime || !runnerId) return;

    logger.debug('Setting up realtime subscription for runner:', runnerId);

    const channel = supabase
      .channel(`runner-location-${runnerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'runner_location_history',
          filter: `runner_id=eq.${runnerId}`,
        },
        (payload) => {
          logger.debug('New location received:', payload);
          const newLocation = payload.new as LocationPoint;
          setRealtimeLocations((prev) => [...prev, newLocation]);
          refetch(); // Also refetch to ensure consistency
        }
      )
      .subscribe((status) => {
        logger.debug('Realtime subscription status:', status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('Location tracking subscription error', { status, runnerId });
        }
      });

    return () => {
      logger.debug('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [runnerId, enableRealtime, refetch]);

  // Combine historical and realtime data
  const allLocations = [...locations, ...realtimeLocations];

  return {
    locations: allLocations,
    statistics,
    isLoading,
    refetch,
  };
}
