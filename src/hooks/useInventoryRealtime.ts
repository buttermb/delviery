import { logger } from '@/lib/logger';
/**
 * Inventory Real-time Hooks
 * Real-time subscriptions for inventory-related tables
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseInventoryRealtimeOptions {
  tenantId?: string;
  enabled?: boolean;
  productIds?: string[];
}

/**
 * Subscribe to real-time inventory updates
 * Monitors changes to products, inventory, inventory_adjustments, and inventory_transfers tables
 */
export function useInventoryRealtime({
  tenantId,
  enabled = true,
  productIds,
}: UseInventoryRealtimeOptions = {}) {
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const [channelCount, setChannelCount] = useState(0);

  useEffect(() => {
    if (!enabled || !tenantId) {
      // Clear channels if disabled
      channelsRef.current = [];
      return;
    }

    const channels: RealtimeChannel[] = [];

    // Subscribe to products table (for stock_quantity changes)
    const productsChannel = supabase
      .channel('inventory-products-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          logger.debug('Product changed', {
            event: payload.eventType,
            component: 'useInventoryRealtime'
          });

          // Invalidate relevant inventory queries
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.alerts() });

          // Invalidate low stock alerts for this tenant
          if (tenantId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.inventory.lowStockAlerts(tenantId)
            });
          }

          // If specific product changed, invalidate product-specific queries
          if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
            const productId = (payload.new as { id: string }).id;
            queryClient.invalidateQueries({
              queryKey: queryKeys.products.details()
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.inventory.all
            });
          } else if (payload.old && typeof payload.old === 'object' && 'id' in payload.old) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.products.details()
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.inventory.all
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to products realtime', undefined, {
            component: 'useInventoryRealtime'
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Products realtime subscription error', undefined, {
            component: 'useInventoryRealtime',
            status
          });
        }
      });

    channels.push(productsChannel);

    // Subscribe to inventory_adjustments table
    const adjustmentsChannel = supabase
      .channel('inventory-adjustments-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_adjustments',
        },
        (payload) => {
          logger.debug('Inventory adjustment changed', {
            event: payload.eventType,
            component: 'useInventoryRealtime'
          });

          // Invalidate inventory queries
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.history() });
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

          // If product_id is present, invalidate product-specific queries
          if (payload.new && typeof payload.new === 'object' && 'product_id' in payload.new) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.inventory.all
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.products.all
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to inventory adjustments realtime', undefined, {
            component: 'useInventoryRealtime'
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Inventory adjustments realtime subscription error', undefined, {
            component: 'useInventoryRealtime',
            status
          });
        }
      });

    channels.push(adjustmentsChannel);

    // Subscribe to inventory_transfers table
    const transfersChannel = supabase
      .channel('inventory-transfers-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_transfers',
        },
        (payload) => {
          logger.debug('Inventory transfer changed', {
            event: payload.eventType,
            component: 'useInventoryRealtime'
          });

          // Invalidate inventory queries
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all });

          // If product_id is present, invalidate product-specific queries
          if (payload.new && typeof payload.new === 'object' && 'product_id' in payload.new) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.inventory.all
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.products.all
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to inventory transfers realtime', undefined, {
            component: 'useInventoryRealtime'
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Inventory transfers realtime subscription error', undefined, {
            component: 'useInventoryRealtime',
            status
          });
        }
      });

    channels.push(transfersChannel);

    // Optional: Subscribe to inventory table if needed
    const inventoryChannel = supabase
      .channel('inventory-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
        },
        (payload) => {
          logger.debug('Inventory record changed', {
            event: payload.eventType,
            component: 'useInventoryRealtime'
          });

          // Invalidate inventory queries
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });

          // Invalidate location-specific queries if location_id is present
          if (payload.new && typeof payload.new === 'object' && 'location_id' in payload.new) {
            const locationId = (payload.new as { location_id: string }).location_id;
            queryClient.invalidateQueries({
              queryKey: queryKeys.inventory.byLocation(locationId)
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Subscribed to inventory realtime', undefined, {
            component: 'useInventoryRealtime'
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Inventory realtime subscription error', undefined, {
            component: 'useInventoryRealtime',
            status
          });
        }
      });

    channels.push(inventoryChannel);

    channelsRef.current = channels;
    setChannelCount(channels.length);

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
      setChannelCount(0);
    };
  }, [tenantId, enabled, productIds, queryClient]);

  return {
    isActive: channelCount > 0,
    channelCount,
  };
}
