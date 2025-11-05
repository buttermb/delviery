/**
 * Unified Realtime Sync Hook
 * Subscribes to multiple tables and invalidates TanStack Query caches
 * Phase 3: Implement Real-Time Synchronization
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
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

// Track failed connection attempts per table
const connectionFailures = new Map<string, number>();
const MAX_FAILURES = 3; // Disable after 3 failures

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
  const [isConnecting, setIsConnecting] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || !tenantId) {
      // Cleanup if disabled
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      return;
    }

    setIsConnecting(true);

    // Cleanup function - silently handle WebSocket errors during cleanup
    const cleanup = () => {
      channelsRef.current.forEach(channel => {
        try {
          // Suppress WebSocket errors during cleanup (they're expected when channels close)
          supabase.removeChannel(channel).catch(() => {
            // Silently ignore cleanup errors - WebSocket disconnects are expected
          });
        } catch (error) {
          // Silently ignore cleanup errors - these are not critical
        }
      });
      channelsRef.current = [];
    };

    cleanupRef.current = cleanup;

    // Clear any existing channels first
    cleanup();

    // Subscribe to each table (skip if too many failures)
    tables.forEach(table => {
      const failureKey = `${table}-${tenantId}`;
      const failures = connectionFailures.get(failureKey) || 0;
      
      // Skip if too many failures (disable realtime for this table)
      if (failures >= MAX_FAILURES) {
        logger.debug(`Skipping realtime for ${table} (too many failures)`, { failures, component: 'useRealtimeSync' });
        return;
      }

      const channelKey = `realtime-sync-${table}-${tenantId}`;
      
      let channel: RealtimeChannel;
      
      try {
        channel = supabase
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
              // Don't filter by tenant_id if column doesn't exist - this causes 400 errors
              // The filter will be applied server-side by RLS policies if they exist
              filter: undefined, // Remove tenant_id filter to avoid 400 errors
            },
          (payload) => {
            try {
              logger.debug(`Realtime update: ${table}`, {
                event: payload.eventType,
                table,
                tenantId,
                component: 'useRealtimeSync',
              });

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
              logger.error(`Error processing realtime update for ${table}`, error, { component: 'useRealtimeSync' });
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Reset failure count on successful subscription
            connectionFailures.delete(failureKey);
            logger.debug(`Realtime subscription active: ${table}`, { tenantId }, 'useRealtimeSync');
          } else if (status === 'CHANNEL_ERROR') {
            // Increment failure count
            const currentFailures = connectionFailures.get(failureKey) || 0;
            connectionFailures.set(failureKey, currentFailures + 1);
            
            // Only log if not too many failures (to reduce noise)
            if (currentFailures < MAX_FAILURES) {
              logger.warn(
                `Realtime subscription error: ${table} (tenant: ${tenantId})`,
                { table, tenantId, failures: currentFailures + 1, component: 'useRealtimeSync' }
              );
            }
            
            // Invalidate queries to trigger refetch
            queryClient.invalidateQueries({ queryKey: [table] });
            queryClient.invalidateQueries({ queryKey: [table, tenantId] });
          } else if (status === 'TIMED_OUT') {
            // Increment failure count
            const currentFailures = connectionFailures.get(failureKey) || 0;
            connectionFailures.set(failureKey, currentFailures + 1);
            
            if (currentFailures < MAX_FAILURES) {
              logger.warn(
                `Realtime subscription timed out: ${table}`,
                { tenantId, table, failures: currentFailures + 1, component: 'useRealtimeSync' }
              );
            }
            
            // Invalidate queries to trigger refetch
            queryClient.invalidateQueries({ queryKey: [table] });
            queryClient.invalidateQueries({ queryKey: [table, tenantId] });
          }
        });

      channelsRef.current.push(channel);
      } catch (error) {
        // Catch any errors during channel creation
        const currentFailures = connectionFailures.get(failureKey) || 0;
        connectionFailures.set(failureKey, currentFailures + 1);
        
        if (currentFailures < MAX_FAILURES) {
          logger.warn(`Failed to create realtime channel for ${table}`, error, { component: 'useRealtimeSync' });
        }
      }
    });

    setIsConnecting(false);

    // Cleanup function
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setIsConnecting(false);
    };
  }, [tenantId, tables, enabled, queryClient, isConnecting]);

  return {
    isActive: channelsRef.current.length > 0,
    channelCount: channelsRef.current.length,
  };
}

