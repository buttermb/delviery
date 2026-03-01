import { logger } from '@/lib/logger';
/**
 * Unified Realtime Sync Hook
 * Subscribes to multiple tables and uses the invalidation system
 * for consistent cross-panel data synchronization.
 *
 * Phase 3: Implement Real-Time Synchronization
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invalidateOnEvent, type InvalidationEvent } from '@/lib/invalidation';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSyncOptions {
  tenantId?: string;
  tables?: string[];
  enabled?: boolean;
}

const DEFAULT_TABLES = [
  'orders',
  'order_items',
  'menu_orders',
  'products',
  'inventory',
  'deliveries',
  'delivery_assignments',
  'customers',
  'payments',
  'inventory_transfers',
  'wholesale_orders',
  'courier_earnings',
  'storefront_orders',
  'invoices',
  'disposable_menus',
  'pos_shifts',
];

// Track failed connection attempts per table
const connectionFailures = new Map<string, number>();
const MAX_FAILURES = 3; // Disable after 3 failures
const INVALIDATION_DEDUPE_MS = 300;

const TENANT_FILTER_TABLES = new Set([
  'orders',
  'order_items',
  'products',
  'inventory',
  'deliveries',
  'customers',
  'payments',
  'inventory_transfers',
  'wholesale_orders',
  'courier_earnings',
  'storefront_orders',
  'invoices',
  'disposable_menus',
  'pos_shifts',
]);

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
    case 'payments':
      if (eventType === 'INSERT') {
        return {
          event: 'PAYMENT_RECEIVED',
          metadata: hasCustomerId(newRecord) ? { customerId: newRecord.customer_id } : undefined,
        };
      }
      break;

    case 'refunds':
      if (eventType === 'INSERT') {
        return { event: 'REFUND_PROCESSED' };
      }
      break;

    case 'invoices':
      if (eventType === 'INSERT') {
        return {
          event: 'INVOICE_CREATED',
          metadata: {
            ...(hasId(newRecord) ? { invoiceId: newRecord.id } : {}),
            ...(hasCustomerId(newRecord) ? { customerId: newRecord.customer_id } : {}),
          },
        };
      }
      if (eventType === 'UPDATE' && hasStatus(newRecord) && newRecord.status === 'paid') {
        return {
          event: 'INVOICE_PAID',
          metadata: hasId(newRecord) ? { invoiceId: newRecord.id } : undefined,
        };
      }
      break;

    // ============================================================================
    // DELIVERIES & FULFILLMENT
    // ============================================================================
    case 'deliveries':
      if (eventType === 'UPDATE') {
        if (hasCourierId(newRecord) && (!hasCourierId(oldRecord) || oldRecord.courier_id !== newRecord.courier_id)) {
          return {
            event: 'DRIVER_ASSIGNED',
            metadata: { courierId: newRecord.courier_id },
          };
        }
        if (hasStatus(oldRecord) && hasStatus(newRecord) && oldRecord.status !== newRecord.status) {
          return { event: 'DELIVERY_STATUS_CHANGED' };
        }
      }
      return { event: 'DELIVERY_STATUS_CHANGED' };

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
      if (hasStatus(newRecord) && newRecord.status === 'burned') {
        return { event: 'MENU_BURNED' };
      }
      return {
        event: 'MENU_UPDATED',
        metadata: hasId(newRecord) ? { menuId: newRecord.id } : undefined,
      };

    case 'storefront_orders':
      if (eventType === 'INSERT') {
        return { event: 'STOREFRONT_ORDER' };
      }
      if (eventType === 'UPDATE') {
        if (hasStatus(oldRecord) && hasStatus(newRecord) && oldRecord.status !== newRecord.status) {
          return {
            event: 'ORDER_STATUS_CHANGED',
            metadata: hasId(newRecord) ? { orderId: newRecord.id } : undefined,
          };
        }
        return { event: 'ORDER_UPDATED' };
      }
      break;

    // ============================================================================
    // DELIVERY ASSIGNMENTS
    // ============================================================================
    case 'delivery_assignments':
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        return {
          event: 'DRIVER_ASSIGNED',
          metadata: hasCourierId(newRecord) ? { courierId: newRecord.courier_id } : undefined,
        };
      }
      break;

    // ============================================================================
    // ORDER ITEMS (triggers inventory/order refresh)
    // ============================================================================
    case 'order_items':
      return {
        event: 'ORDER_UPDATED',
        metadata: hasId(newRecord) ? { orderId: (newRecord as Record<string, string>).order_id } : undefined,
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
  const lastInvalidationRef = useRef<Map<string, number>>(new Map());

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
    if (isConnectingRef.current) {
      return;
    }

    isConnectingRef.current = true;

    // Cleanup function
    const cleanup = () => {
      channelsRef.current.forEach((channel) => {
        try {
          supabase.removeChannel(channel).catch((err) => {
            logger.warn('Error removing realtime channel', { error: err, component: 'useRealtimeSync' });
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

    // Batch tables into a few channels instead of one per table.
    // Supabase supports multiple .on() listeners per channel.
    // This reduces connection count from N to ceil(N/BATCH_SIZE).
    const BATCH_SIZE = 8;
    const eligibleTables = tables.filter((table) => {
      const failureKey = `${table}-${tenantId}`;
      const failures = connectionFailures.get(failureKey) || 0;
      if (failures >= MAX_FAILURES) {
        logger.debug(`Skipping realtime for ${table} (too many failures)`, {
          failures,
          component: 'useRealtimeSync',
        });
        return false;
      }
      return true;
    });

    // Split eligible tables into batches
    for (let batchIdx = 0; batchIdx < eligibleTables.length; batchIdx += BATCH_SIZE) {
      const batch = eligibleTables.slice(batchIdx, batchIdx + BATCH_SIZE);
      const channelKey = `realtime-sync-batch-${batchIdx}-${tenantId}`;

      try {
        let channel = supabase.channel(channelKey, {
          config: {
            broadcast: { self: false },
            presence: { key: '' },
          },
        });

        // Attach a listener for each table in this batch
        batch.forEach((table) => {
          channel = channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table,
              // Apply tenant filter only for known tenant-scoped tables.
              filter: TENANT_FILTER_TABLES.has(table) ? `tenant_id=eq.${tenantId}` : undefined,
            },
            (payload) => {
              try {
                const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';

                logger.debug(`Realtime update: ${table}`, {
                  event: eventType,
                  table,
                  tenantId,
                  component: 'useRealtimeSync',
                });

                // Map table change to business event via centralized mapping
                const result = getInvalidationEvent(
                  table,
                  eventType,
                  payload.old,
                  payload.new
                );

                if (result) {
                  // Deduplicate bursty realtime events to avoid invalidation storms.
                  const invalidationKey = `${tenantId}:${result.event}:${JSON.stringify(result.metadata ?? {})}`;
                  const now = Date.now();
                  const lastAt = lastInvalidationRef.current.get(invalidationKey) ?? 0;
                  if (now - lastAt < INVALIDATION_DEDUPE_MS) {
                    return;
                  }
                  lastInvalidationRef.current.set(invalidationKey, now);

                  // Use centralized invalidation system for consistent cross-panel sync
                  invalidateOnEvent(queryClient, result.event, tenantId, result.metadata);
                } else {
                  // Fallback: generic invalidation for unmapped table changes
                  queryClient.invalidateQueries({ queryKey: [table] });
                  queryClient.invalidateQueries({ queryKey: [table, tenantId] });
                }
              } catch (error) {
                logger.error(`Error processing realtime update for ${table}`, error, {
                  component: 'useRealtimeSync',
                });
              }
            }
          );
        });

        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            batch.forEach((table) => {
              connectionFailures.delete(`${table}-${tenantId}`);
            });
            logger.debug(`Realtime batch subscription active: [${batch.join(', ')}]`, {
              tenantId,
              component: 'useRealtimeSync',
            });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            batch.forEach((table) => {
              const failureKey = `${table}-${tenantId}`;
              const currentFailures = connectionFailures.get(failureKey) || 0;
              connectionFailures.set(failureKey, currentFailures + 1);
            });
            logger.warn(`Realtime batch subscription ${status.toLowerCase()}: [${batch.join(', ')}]`, {
              tenantId,
              component: 'useRealtimeSync',
            });
          }
        });

        channelsRef.current.push(channel);
      } catch (error) {
        batch.forEach((table) => {
          const failureKey = `${table}-${tenantId}`;
          const currentFailures = connectionFailures.get(failureKey) || 0;
          connectionFailures.set(failureKey, currentFailures + 1);
        });
        logger.warn(`Failed to create realtime batch channel for [${batch.join(', ')}]`, error, {
          component: 'useRealtimeSync',
        });
      }
    }

    isConnectingRef.current = false;

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, [tenantId, tables, enabled, queryClient]);

  return {
    isActive: channelsRef.current.length > 0,
    channelCount: channelsRef.current.length,
  };
}
