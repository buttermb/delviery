import { logger } from '@/lib/logger';
/**
 * Unified Realtime Sync Hook
 * Subscribes to multiple tables and uses the invalidation system
 * for consistent cross-panel data synchronization.
 *
 * Phase 3: Implement Real-Time Synchronization
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { InvalidationEvent } from '@/lib/invalidation';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSyncOptions {
  tenantId?: string;
  tables?: string[];
  enabled?: boolean;
}

const DEFAULT_TABLES = [
  'orders',           // Critical: Live orders
  'wholesale_orders', // Critical: B2B orders
  'products',         // Critical: Stock changes
  'menu_orders',      // Critical: Menu-based orders
  // Removed for performance: deliveries, customers, payments,
  // inventory_transfers, courier_earnings, invoices, storefront_orders
  // These can be subscribed individually on pages that need them
];

// Track failed connection attempts per table
const connectionFailures = new Map<string, number>();
const MAX_FAILURES = 3; // Disable after 3 failures

// Type guards for payload inspection
function hasId(obj: unknown): obj is { id: string } {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}

function hasCustomerId(obj: unknown): obj is { customer_id: string } {
  return typeof obj === 'object' && obj !== null && 'customer_id' in obj;
}

function hasProductId(obj: unknown): obj is { product_id: string } {
  return typeof obj === 'object' && obj !== null && 'product_id' in obj;
}

function hasCourierId(obj: unknown): obj is { courier_id: string } {
  return typeof obj === 'object' && obj !== null && 'courier_id' in obj;
}

function hasStatus(obj: unknown): obj is { status: string } {
  return typeof obj === 'object' && obj !== null && 'status' in obj;
}

// Map table changes to invalidation events
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getInvalidationEvent(
  table: string,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  oldRecord: unknown,
  newRecord: unknown
): { event: InvalidationEvent; metadata?: Record<string, string> } | null {
  switch (table) {
    // ============================================================================
    // ORDERS
    // ============================================================================
    case 'orders':
    case 'menu_orders':
      if (eventType === 'INSERT') {
        return {
          event: 'ORDER_CREATED',
          metadata: hasCustomerId(newRecord) ? { customerId: newRecord.customer_id } : undefined,
        };
      }
      if (eventType === 'UPDATE') {
        // Check if status changed
        if (hasStatus(oldRecord) && hasStatus(newRecord) && oldRecord.status !== newRecord.status) {
          return {
            event: 'ORDER_STATUS_CHANGED',
            metadata: {
              ...(hasId(newRecord) ? { orderId: newRecord.id } : {}),
              ...(hasCustomerId(newRecord) ? { customerId: newRecord.customer_id } : {}),
            },
          };
        }
        return {
          event: 'ORDER_UPDATED',
          metadata: hasId(newRecord) ? { orderId: newRecord.id } : undefined,
        };
      }
      if (eventType === 'DELETE') {
        return { event: 'ORDER_DELETED' };
      }
      break;

    // ============================================================================
    // PRODUCTS & INVENTORY
    // ============================================================================
    case 'products':
      if (eventType === 'INSERT') {
        return { event: 'PRODUCT_CREATED' };
      }
      if (eventType === 'UPDATE') {
        return {
          event: 'PRODUCT_UPDATED',
          metadata: hasId(newRecord) ? { productId: newRecord.id } : undefined,
        };
      }
      if (eventType === 'DELETE') {
        return { event: 'PRODUCT_DELETED' };
      }
      break;

    case 'inventory':
    case 'inventory_adjustments':
      return {
        event: 'INVENTORY_ADJUSTED',
        metadata: hasProductId(newRecord) ? { productId: newRecord.product_id } : undefined,
      };

    case 'inventory_transfers':
      if (hasStatus(newRecord) && newRecord.status === 'completed') {
        return { event: 'INVENTORY_TRANSFER_COMPLETED' };
      }
      return { event: 'INVENTORY_ADJUSTED' };

    // ============================================================================
    // CUSTOMERS
    // ============================================================================
    case 'customers':
    case 'b2b_clients':
      if (eventType === 'INSERT') {
        return { event: 'CUSTOMER_CREATED' };
      }
      if (eventType === 'UPDATE') {
        return {
          event: 'CUSTOMER_UPDATED',
          metadata: hasId(newRecord) ? { customerId: newRecord.id } : undefined,
        };
      }
      if (eventType === 'DELETE') {
        return { event: 'CUSTOMER_DELETED' };
      }
      break;

    // ============================================================================
    // PAYMENTS & FINANCE
    // ============================================================================
    case 'refunds':
      if (eventType === 'INSERT') {
        return { event: 'REFUND_PROCESSED' };
      }
      break;

    // ============================================================================
    // DELIVERIES & FULFILLMENT
    // ============================================================================
    case 'couriers':
      if (eventType === 'UPDATE') {
        return {
          event: 'COURIER_STATUS_CHANGED',
          metadata: hasId(newRecord) ? { courierId: newRecord.id } : undefined,
        };
      }
      break;

    // ============================================================================
    // WHOLESALE / B2B
    // ============================================================================
    case 'wholesale_orders':
      if (eventType === 'INSERT') {
        return { event: 'WHOLESALE_ORDER_CREATED' };
      }
      if (eventType === 'UPDATE') {
        return { event: 'WHOLESALE_ORDER_UPDATED' };
      }
      break;

    // ============================================================================
    // MENUS & STOREFRONT
    // ============================================================================
    case 'disposable_menus':
      if (hasStatus(newRecord) && newRecord.status === 'published') {
        return { event: 'MENU_PUBLISHED' };
      }
      return {
        event: 'MENU_UPDATED',
        metadata: hasId(newRecord) ? { menuId: newRecord.id } : undefined,
      };

    // ============================================================================
    // POS SHIFTS
    // ============================================================================
    case 'pos_shifts':
      if (eventType === 'INSERT') {
        return {
          event: 'SHIFT_STARTED',
          metadata: hasId(newRecord) ? { shiftId: newRecord.id } : undefined,
        };
      }
      if (eventType === 'UPDATE' && hasStatus(newRecord) && newRecord.status === 'closed') {
        return {
          event: 'SHIFT_ENDED',
          metadata: hasId(newRecord) ? { shiftId: newRecord.id } : undefined,
        };
      }
      break;
  }

  return null;
}

/**
 * Unified hook for real-time synchronization across multiple tables
 * Uses the centralized invalidation system for consistent cache updates
 */
export function useRealtimeSync({
  tenantId,
  tables = DEFAULT_TABLES,
  enabled = true,
}: UseRealtimeSyncOptions = {}) {
  const queryClient = useQueryClient();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const isConnectingRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden);
  const isTabVisibleRef = useRef(isTabVisible);

  // Keep ref in sync with state
  useEffect(() => {
    isTabVisibleRef.current = isTabVisible;
  }, [isTabVisible]);

  // Setup visibility change listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      const wasVisible = isTabVisible;
      setIsTabVisible(isVisible);

      if (!enabled || !tenantId) {
        return;
      }

      if (isVisible && !wasVisible) {
        // Tab became visible - refresh data and resume subscriptions
        logger.debug('Tab became visible, refreshing data', {
          component: 'useRealtimeSync',
          tenantId,
        });

        // Invalidate all subscribed tables to fetch fresh data
        tables.forEach((table) => {
          queryClient.invalidateQueries({ queryKey: [table] });
          queryClient.invalidateQueries({ queryKey: [table, tenantId] });
        });
      } else if (!isVisible && wasVisible) {
        // Tab became hidden - pause subscriptions (they'll naturally pause)
        logger.debug('Tab became hidden, subscriptions will pause', {
          component: 'useRealtimeSync',
          tenantId,
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, tenantId, tables, queryClient, isTabVisible]);

  useEffect(() => {
    if (!enabled || !tenantId) {
      // Cleanup if disabled
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      return;
    }

    // Don't connect if tab is hidden
    if (!isTabVisible) {
      logger.debug('Skipping realtime connection while tab is hidden', {
        component: 'useRealtimeSync',
        tenantId,
      });
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;

    // Cleanup function
    const cleanup = () => {
      channelsRef.current.forEach((channel) => {
        try {
          supabase.removeChannel(channel).catch(() => {
            // Silently ignore cleanup errors
          });
        } catch {
          // Silently ignore cleanup errors
        }
      });
      channelsRef.current = [];
    };

    cleanupRef.current = cleanup;

    // Clear any existing channels first
    cleanup();

    // Subscribe to each table
    tables.forEach((table) => {
      const failureKey = `${table}-${tenantId}`;
      const failures = connectionFailures.get(failureKey) || 0;

      // Skip if too many failures
      if (failures >= MAX_FAILURES) {
        logger.debug(`Skipping realtime for ${table} (too many failures)`, {
          failures,
          component: 'useRealtimeSync',
        });
        return;
      }

      const channelKey = `realtime-sync-${table}-${tenantId}`;

      try {
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
              // Don't filter by tenant_id to avoid 400 errors
              // RLS policies handle tenant isolation
              filter: undefined,
            },
            (payload) => {
              try {
                // Skip processing updates if tab is hidden
                if (!isTabVisibleRef.current) {
                  logger.debug(`Skipping realtime update while tab hidden: ${table}`, {
                    event: payload.eventType,
                    table,
                    tenantId,
                    component: 'useRealtimeSync',
                  });
                  return;
                }

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
                    // Invalidate finance queries for real-time revenue updates
                    queryClient.invalidateQueries({ queryKey: ['finance'] });
                    queryClient.invalidateQueries({ queryKey: ['revenue-reports'] });
                    // Also invalidate related queries
                    if (payload.new && hasId(payload.new)) {
                      queryClient.invalidateQueries({ queryKey: ['order', payload.new.id] });
                    }
                    break;

                  case 'products':
                    queryClient.invalidateQueries({ queryKey: ['inventory'] });
                    queryClient.invalidateQueries({ queryKey: ['products'] });
                    queryClient.invalidateQueries({ queryKey: ['products-inventory'] });
                    queryClient.invalidateQueries({ queryKey: ['products-for-wholesale'] });
                    queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
                    queryClient.invalidateQueries({ queryKey: ['inventory-forecast'] });
                    queryClient.invalidateQueries({ queryKey: ['low-stock'] });
                    // Invalidate product-specific queries
                    if (payload.new && hasId(payload.new)) {
                      queryClient.invalidateQueries({ queryKey: ['product', payload.new.id] });
                    }
                    break;

                  case 'courier_earnings':
                    queryClient.invalidateQueries({ queryKey: ['courier-earnings'] });
                    queryClient.invalidateQueries({ queryKey: ['courier-stats'] });
                    queryClient.invalidateQueries({ queryKey: ['financial-center'] });
                    queryClient.invalidateQueries({ queryKey: ['revenue-reports'] });
                    // Invalidate courier-specific queries
                    if (payload.new && hasCourierId(payload.new)) {
                      queryClient.invalidateQueries({ queryKey: ['courier', payload.new.courier_id] });
                    }
                    break;

                  case 'storefront_orders':
                    queryClient.invalidateQueries({ queryKey: ['storefront-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['realtime-sales'] });
                    queryClient.invalidateQueries({ queryKey: ['multi-channel-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['storefront-performance'] });
                    queryClient.invalidateQueries({ queryKey: ['order-tracking'] });
                    break;

                  case 'marketplace_stores':
                    queryClient.invalidateQueries({ queryKey: ['marketplace-store'] });
                    queryClient.invalidateQueries({ queryKey: ['storefront-performance'] });
                    break;

                  case 'orders':
                    queryClient.invalidateQueries({ queryKey: ['orders'] });
                    queryClient.invalidateQueries({ queryKey: ['live-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['dashboard-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
                    // Invalidate finance queries for real-time revenue updates
                    queryClient.invalidateQueries({ queryKey: ['finance'] });
                    queryClient.invalidateQueries({ queryKey: ['revenue-reports'] });
                    if (payload.new && hasId(payload.new)) {
                      queryClient.invalidateQueries({ queryKey: ['order', payload.new.id] });
                    }
                    break;

                  case 'menu_orders':
                    queryClient.invalidateQueries({ queryKey: ['menu-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['live-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
                    queryClient.invalidateQueries({ queryKey: ['orders'] });
                    if (payload.new && hasId(payload.new)) {
                      queryClient.invalidateQueries({ queryKey: ['menu-order', payload.new.id] });
                    }
                    break;

                  default:
                    // Generic invalidation for unknown tables
                    queryClient.invalidateQueries({ queryKey: [table] });
                    queryClient.invalidateQueries({ queryKey: [table, tenantId] });
                }
              } catch (error) {
                logger.error(`Error processing realtime update for ${table}`, error, {
                  component: 'useRealtimeSync',
                });
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              connectionFailures.delete(failureKey);
              logger.debug(`Realtime subscription active: ${table}`, {
                tenantId,
                component: 'useRealtimeSync',
              });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              const currentFailures = connectionFailures.get(failureKey) || 0;
              connectionFailures.set(failureKey, currentFailures + 1);

              if (currentFailures < MAX_FAILURES) {
                logger.warn(`Realtime subscription ${status.toLowerCase()}: ${table}`, {
                  table,
                  tenantId,
                  failures: currentFailures + 1,
                  component: 'useRealtimeSync',
                });
              }
            }
          });

        channelsRef.current.push(channel);
      } catch (error) {
        const currentFailures = connectionFailures.get(failureKey) || 0;
        connectionFailures.set(failureKey, currentFailures + 1);

        if (currentFailures < MAX_FAILURES) {
          logger.warn(`Failed to create realtime channel for ${table}`, error, {
            component: 'useRealtimeSync',
          });
        }
      }
    });

    isConnectingRef.current = false;

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      isConnectingRef.current = false;
    };
    // Note: isTabVisible is intentionally not in the dependency array
    // We don't want to recreate subscriptions when visibility changes
    // Instead, we skip processing updates when hidden and refresh data when visible
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, tables, enabled, queryClient]);

  return {
    isActive: channelsRef.current.length > 0,
    channelCount: channelsRef.current.length,
    isTabVisible,
  };
}
