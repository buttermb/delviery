/**
 * Unified Realtime Sync Hook
 * Subscribes to multiple tables and invalidates TanStack Query caches
 * Phase 3: Implement Real-Time Synchronization
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSyncOptions {
  tenantId?: string;
  tables?: string[];
  enabled?: boolean;
}

const DEFAULT_TABLES = [
  'wholesale_orders',
  'wholesale_inventory',
  'deliveries',
  'courier_earnings',
];

/**
 * Unified hook for real-time synchronization across multiple tables
 * Handles INSERT, UPDATE, DELETE events and invalidates relevant query caches
 */
export function useRealtimeSync({
  tenantId,
  tables = DEFAULT_TABLES,
  enabled = true,
}: UseRealtimeSyncOptions = {}) {
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    if (!enabled || !tenantId) {
      return;
    }

    // Clear any existing channels
    channelsRef.current.forEach(channel => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        logger.warn('Error removing channel', error, 'useRealtimeSync');
      }
    });
    channelsRef.current = [];

    // Subscribe to each table
    tables.forEach(table => {
      const channelKey = `realtime-sync-${table}-${tenantId}`;
      
      const channel = supabase
        .channel(channelKey, {
          config: {
            broadcast: { self: false },
            presence: { key: '' },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
            filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
          },
          (payload) => {
            try {
              logger.debug(`Realtime update: ${table}`, {
                event: payload.eventType,
                table,
                tenantId,
              }, 'useRealtimeSync');

              // Invalidate relevant query caches based on table
              switch (table) {
                case 'wholesale_orders':
                  queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });
                  queryClient.invalidateQueries({ queryKey: ['orders'] });
                  queryClient.invalidateQueries({ queryKey: ['dashboard-orders'] });
                  // Also invalidate related queries
                  if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
                    const orderId = (payload.new as any).id;
                    queryClient.invalidateQueries({ queryKey: ['order', orderId] });
                  }
                  break;

                case 'wholesale_inventory':
                  queryClient.invalidateQueries({ queryKey: ['inventory'] });
                  queryClient.invalidateQueries({ queryKey: ['wholesale-inventory'] });
                  queryClient.invalidateQueries({ queryKey: ['products'] });
                  queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
                  // Invalidate product-specific queries
                  if (payload.new && typeof payload.new === 'object' && 'product_id' in payload.new) {
                    const productId = (payload.new as any).product_id;
                    queryClient.invalidateQueries({ queryKey: ['product', productId] });
                  }
                  break;

                case 'deliveries':
                  queryClient.invalidateQueries({ queryKey: ['deliveries'] });
                  queryClient.invalidateQueries({ queryKey: ['active-deliveries'] });
                  queryClient.invalidateQueries({ queryKey: ['delivery-map'] });
                  queryClient.invalidateQueries({ queryKey: ['fleet-management'] });
                  // Invalidate delivery-specific queries
                  if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
                    const deliveryId = (payload.new as any).id;
                    queryClient.invalidateQueries({ queryKey: ['delivery', deliveryId] });
                  }
                  break;

                case 'courier_earnings':
                  queryClient.invalidateQueries({ queryKey: ['courier-earnings'] });
                  queryClient.invalidateQueries({ queryKey: ['courier-stats'] });
                  queryClient.invalidateQueries({ queryKey: ['financial-center'] });
                  queryClient.invalidateQueries({ queryKey: ['revenue-reports'] });
                  // Invalidate courier-specific queries
                  if (payload.new && typeof payload.new === 'object' && 'courier_id' in payload.new) {
                    const courierId = (payload.new as any).courier_id;
                    queryClient.invalidateQueries({ queryKey: ['courier', courierId] });
                  }
                  break;

                default:
                  // Generic invalidation for unknown tables
                  queryClient.invalidateQueries({ queryKey: [table] });
                  queryClient.invalidateQueries({ queryKey: [table, tenantId] });
              }

              // Also invalidate dashboard and summary queries
              queryClient.invalidateQueries({ queryKey: ['dashboard'] });
              queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
              queryClient.invalidateQueries({ queryKey: ['summary'] });
            } catch (error) {
              logger.error(`Error processing realtime update for ${table}`, error, 'useRealtimeSync');
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            logger.debug(`Realtime subscription active: ${table}`, { tenantId }, 'useRealtimeSync');
          } else if (status === 'CHANNEL_ERROR') {
            logger.error(`Realtime subscription error: ${table}`, undefined, {
              tenantId,
              table,
            }, 'useRealtimeSync');
            // Invalidate queries to trigger refetch
            queryClient.invalidateQueries({ queryKey: [table] });
            queryClient.invalidateQueries({ queryKey: [table, tenantId] });
          } else if (status === 'TIMED_OUT') {
            logger.warn(`Realtime subscription timed out: ${table}`, {
              tenantId,
              table,
            }, 'useRealtimeSync');
            // Invalidate queries to trigger refetch
            queryClient.invalidateQueries({ queryKey: [table] });
            queryClient.invalidateQueries({ queryKey: [table, tenantId] });
          }
        });

      channelsRef.current.push(channel);
    });

    // Cleanup function
    return () => {
      channelsRef.current.forEach(channel => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          logger.warn('Error removing channel on cleanup', error, 'useRealtimeSync');
        }
      });
      channelsRef.current = [];
    };
  }, [tenantId, tables, enabled, queryClient]);

  return {
    isActive: channelsRef.current.length > 0,
    channelCount: channelsRef.current.length,
  };
}

