/**
 * Real-time subscription hook for Supabase with tenant isolation
 *
 * Wraps Supabase realtime subscriptions with:
 * - Tenant isolation (filters by tenant_id)
 * - Channel deduplication (shared channels for same table+tenant+event)
 * - Automatic cleanup on unmount
 * - EventBus integration for cross-module communication
 * - Exponential backoff reconnection
 * - Lifecycle logging
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';
import { publish } from '@/lib/eventBus';
import type { EventName, EventPayloads } from '@/lib/eventBus';
import { logger } from '@/lib/logger';

/**
 * Supported database event types
 */
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Connection status for the realtime subscription
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Payload received from realtime subscription
 */
export interface RealtimePayload<T = Record<string, unknown>> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
  table: string;
  schema: string;
}

/**
 * Callback function type for realtime changes
 */
export type RealtimeCallback<T = Record<string, unknown>> = (payload: RealtimePayload<T>) => void;

/**
 * Internal handler type for the channel registry.
 * Each subscriber registers a handler that receives the raw Supabase payload.
 */
type RegistryHandler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

/**
 * Options for the realtime subscription hook
 */
export interface UseRealTimeSubscriptionOptions<T = Record<string, unknown>> {
  /** The database table to subscribe to */
  table: string;
  /** Tenant ID for filtering (required for tenant isolation) */
  tenantId: string | null;
  /** Callback function when changes arrive */
  callback?: RealtimeCallback<T>;
  /** Event types to listen for (default: '*' for all) */
  event?: RealtimeEventType;
  /** Whether the subscription is enabled (default: true) */
  enabled?: boolean;
  /** Optional event name to publish to eventBus */
  publishToEvent?: EventName;
  /** Custom filter column (default: 'tenant_id') */
  filterColumn?: string;
  /** Database schema (default: 'public') */
  schema?: string;
}

/**
 * Return value from the hook
 */
export interface UseRealTimeSubscriptionResult {
  /** Current connection status */
  status: ConnectionStatus;
  /** Manual reconnect function */
  reconnect: () => void;
  /** Manual disconnect function */
  disconnect: () => void;
}

/**
 * Exponential backoff configuration
 */
const BACKOFF_CONFIG = {
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  maxRetries: 10,
};

// ---------------------------------------------------------------------------
// Channel Deduplication Registry
// ---------------------------------------------------------------------------

/**
 * Registry entry for a shared Supabase channel.
 * Multiple hook instances subscribing to the same table+tenant+event
 * share a single channel and fan out events via the handlers Set.
 */
interface ChannelEntry {
  channel: RealtimeChannel;
  refCount: number;
  handlers: Set<RegistryHandler>;
  status: ConnectionStatus;
  /** Per-subscriber status callbacks so each hook can track status independently */
  statusCallbacks: Set<(status: ConnectionStatus) => void>;
}

/**
 * Module-level singleton registry.
 * Key: dedup key from getChannelKey()
 * Value: shared channel entry
 */
const channelRegistry = new Map<string, ChannelEntry>();

/**
 * Generate a deterministic dedup key from subscription parameters
 */
function getChannelKey(
  schema: string,
  table: string,
  tenantId: string,
  event: RealtimeEventType,
  filterColumn: string
): string {
  return `${schema}:${table}:${tenantId}:${event}:${filterColumn}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number): number {
  const delay = Math.min(
    BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, attempt),
    BACKOFF_CONFIG.maxDelay
  );
  // Add jitter (+/-20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.floor(delay + jitter);
}

/**
 * Build event payload for eventBus based on event type
 */
function buildEventPayload(
  eventName: EventName,
  tenantId: string,
  record: Record<string, unknown> | null,
  eventType: string
): EventPayloads[EventName] | null {
  if (!record) return null;

  const basePayload = { tenantId };

  switch (eventName) {
    case 'order_created':
    case 'order_updated':
      return {
        ...basePayload,
        orderId: String(record.id || ''),
        customerId: record.customer_id ? String(record.customer_id) : undefined,
        status: record.status ? String(record.status) : undefined,
        changes: eventType === 'UPDATE' ? record : undefined,
      } as EventPayloads['order_updated'];

    case 'inventory_changed':
      return {
        ...basePayload,
        productId: String(record.product_id || record.id || ''),
        locationId: record.location_id ? String(record.location_id) : undefined,
        quantityChange: Number(record.quantity_change || 0),
        newQuantity: Number(record.quantity || record.stock_quantity || 0),
      } as EventPayloads['inventory_changed'];

    case 'customer_updated':
      return {
        ...basePayload,
        customerId: String(record.id || ''),
        changes: record,
      } as EventPayloads['customer_updated'];

    case 'product_updated':
      return {
        ...basePayload,
        productId: String(record.id || ''),
        changes: record,
      } as EventPayloads['product_updated'];

    case 'storefront_synced':
      return {
        ...basePayload,
        storefrontId: String(record.id || ''),
        syncedAt: new Date().toISOString(),
      } as EventPayloads['storefront_synced'];

    case 'menu_published':
      return {
        ...basePayload,
        menuId: String(record.id || ''),
        publishedAt: new Date().toISOString(),
      } as EventPayloads['menu_published'];

    case 'notification_sent':
      return {
        ...basePayload,
        notificationId: String(record.id || ''),
        userId: record.user_id ? String(record.user_id) : undefined,
        type: String(record.type || 'unknown'),
      } as EventPayloads['notification_sent'];

    default:
      logger.warn(`[useRealTimeSubscription] Unknown event type: ${eventName}`);
      return null;
  }
}

/**
 * Notify all status callbacks in a registry entry
 */
function notifyStatusCallbacks(entry: ChannelEntry, newStatus: ConnectionStatus): void {
  const updatedEntry: ChannelEntry = { ...entry, status: newStatus };
  // Update the entry in-place (registry is mutable at module level)
  entry.status = newStatus;
  for (const cb of updatedEntry.statusCallbacks) {
    try {
      cb(newStatus);
    } catch (error) {
      logger.error('[useRealTimeSubscription] Error in status callback', error);
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook for subscribing to Supabase realtime changes with tenant isolation.
 *
 * Multiple components subscribing to the same table+tenant+event combination
 * share a single Supabase channel via the deduplication registry.
 *
 * @example
 * ```tsx
 * const { status, reconnect } = useRealTimeSubscription({
 *   table: 'orders',
 *   tenantId,
 *   callback: (payload) => {
 *     logger.debug('Order changed:', payload);
 *   },
 *   publishToEvent: 'order_updated',
 * });
 * ```
 */
export function useRealTimeSubscription<T = Record<string, unknown>>(
  options: UseRealTimeSubscriptionOptions<T>
): UseRealTimeSubscriptionResult {
  const {
    table,
    tenantId,
    callback,
    event = '*',
    enabled = true,
    publishToEvent,
    filterColumn = 'tenant_id',
    schema = 'public',
  } = options;

  // State for connection status
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  // Refs for stable values and cleanup
  const channelKeyRef = useRef<string | null>(null);
  const callbackRef = useRef(callback);
  const handlerRef = useRef<RegistryHandler | null>(null);
  const statusCallbackRef = useRef<((s: ConnectionStatus) => void) | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Create the handler function for this hook instance.
   * This wraps the user callback + eventBus publishing so the shared channel
   * can fan out to each subscriber independently.
   */
  const createHandler = useCallback((): RegistryHandler => {
    return (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const realtimePayload: RealtimePayload<T> = {
        eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        new: (payload.new as T) || null,
        old: (payload.old as T) || null,
        table: payload.table,
        schema: payload.schema,
      };

      logger.debug(`[useRealTimeSubscription] Received ${payload.eventType} on ${table}`, {
        table,
        eventType: payload.eventType,
      });

      // Call the user callback
      if (callbackRef.current) {
        try {
          callbackRef.current(realtimePayload);
        } catch (error) {
          logger.error(`[useRealTimeSubscription] Error in callback for ${table}`, error);
        }
      }

      // Publish to eventBus if configured
      if (publishToEvent && tenantId) {
        try {
          const newRecord = payload.new as Record<string, unknown> | null;
          const eventPayload = buildEventPayload(publishToEvent, tenantId, newRecord, payload.eventType);
          if (eventPayload) {
            publish(publishToEvent, eventPayload as EventPayloads[typeof publishToEvent]);
          }
        } catch (error) {
          logger.error(`[useRealTimeSubscription] Error publishing to eventBus`, error);
        }
      }
    };
  }, [table, tenantId, publishToEvent]);

  /**
   * Clean up this subscriber from the shared channel.
   * Only removes the Supabase channel when refCount reaches 0.
   */
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const key = channelKeyRef.current;
    if (key) {
      const entry = channelRegistry.get(key);
      if (entry) {
        // Remove this subscriber's handler and status callback
        if (handlerRef.current) {
          entry.handlers.delete(handlerRef.current);
        }
        if (statusCallbackRef.current) {
          entry.statusCallbacks.delete(statusCallbackRef.current);
        }
        entry.refCount -= 1;

        logger.debug(`[useRealTimeSubscription] Unregistered subscriber for ${table}`, {
          key,
          remainingRefs: entry.refCount,
        });

        if (entry.refCount <= 0) {
          // Last subscriber -- tear down the channel
          logger.debug(`[useRealTimeSubscription] Removing shared channel for ${table}`, { key });
          supabase.removeChannel(entry.channel);
          channelRegistry.delete(key);
        }
      }
      channelKeyRef.current = null;
    }

    handlerRef.current = null;
    statusCallbackRef.current = null;

    if (mountedRef.current) {
      setStatus('disconnected');
    }
  }, [table]);

  /**
   * Handle reconnection with exponential backoff.
   * Only the first subscriber that detects an error will trigger reconnect
   * for the shared channel.
   */
  const handleReconnect = useCallback(() => {
    if (!mountedRef.current) return;

    if (retryCountRef.current >= BACKOFF_CONFIG.maxRetries) {
      logger.error(`[useRealTimeSubscription] Max retries reached for ${table}`, undefined, {
        retries: retryCountRef.current,
      });
      setStatus('error');
      return;
    }

    const delay = calculateBackoffDelay(retryCountRef.current);
    retryCountRef.current += 1;

    logger.debug(`[useRealTimeSubscription] Scheduling reconnect`, {
      table,
      attempt: retryCountRef.current,
      delay,
    });

    retryTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setupSubscriptionInternal();
      }
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setupSubscriptionInternal is defined below; circular dep would cause infinite retries
  }, [table]);

  /**
   * Internal setup function.
   * Checks the dedup registry before creating a new channel.
   */
  const setupSubscriptionInternal = useCallback(() => {
    if (!tenantId || !enabled || !mountedRef.current) {
      logger.debug(`[useRealTimeSubscription] Subscription disabled or missing tenantId`, {
        table,
        tenantId,
        enabled,
      });
      return;
    }

    // Clear any pending retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // If this hook already registered on a channel, clean up first
    if (channelKeyRef.current) {
      const prevEntry = channelRegistry.get(channelKeyRef.current);
      if (prevEntry) {
        if (handlerRef.current) {
          prevEntry.handlers.delete(handlerRef.current);
        }
        if (statusCallbackRef.current) {
          prevEntry.statusCallbacks.delete(statusCallbackRef.current);
        }
        prevEntry.refCount -= 1;
        if (prevEntry.refCount <= 0) {
          supabase.removeChannel(prevEntry.channel);
          channelRegistry.delete(channelKeyRef.current);
        }
      }
      channelKeyRef.current = null;
      handlerRef.current = null;
      statusCallbackRef.current = null;
    }

    const key = getChannelKey(schema, table, tenantId, event, filterColumn);
    const handler = createHandler();
    handlerRef.current = handler;

    // Create a stable status callback for this hook instance
    const onStatusChange = (newStatus: ConnectionStatus): void => {
      if (mountedRef.current) {
        setStatus(newStatus);
        if (newStatus === 'connected') {
          retryCountRef.current = 0;
        }
      }
    };
    statusCallbackRef.current = onStatusChange;

    const existingEntry = channelRegistry.get(key);

    if (existingEntry) {
      // Shared channel already exists -- attach to it
      existingEntry.refCount += 1;
      existingEntry.handlers.add(handler);
      existingEntry.statusCallbacks.add(onStatusChange);
      channelKeyRef.current = key;

      logger.debug(`[useRealTimeSubscription] Reusing shared channel for ${table}`, {
        key,
        refCount: existingEntry.refCount,
      });

      // Sync local status with the shared channel's current status
      if (mountedRef.current) {
        setStatus(existingEntry.status);
      }

      return;
    }

    // No existing channel -- create a new one
    setStatus('connecting');

    logger.debug(`[useRealTimeSubscription] Creating shared channel`, {
      table,
      tenantId,
      event,
      schema,
      key,
    });

    const channelName = `realtime:${schema}:${table}:${tenantId}:${event}:${filterColumn}`;

    // Build the new registry entry before subscribing so the handler
    // closure can reference it for fan-out.
    const newEntry: ChannelEntry = {
      channel: null as unknown as RealtimeChannel, // assigned below
      refCount: 1,
      handlers: new Set([handler]),
      status: 'connecting' as ConnectionStatus,
      statusCallbacks: new Set([onStatusChange]),
    };

    channelRegistry.set(key, newEntry);
    channelKeyRef.current = key;

    const channel = supabase
      .channel(channelName)
      .on(
        // Supabase SDK overload expects a narrow literal; cast to satisfy .on() signature
        'postgres_changes' as unknown as 'postgres_changes',
        {
          event,
          schema,
          table,
          filter: `${filterColumn}=eq.${tenantId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Fan out to all registered handlers
          const entry = channelRegistry.get(key);
          if (!entry) return;

          for (const registeredHandler of entry.handlers) {
            try {
              registeredHandler(payload);
            } catch (error) {
              logger.error(`[useRealTimeSubscription] Error in registered handler for ${table}`, error);
            }
          }
        }
      )
      .subscribe((subscriptionStatus) => {
        const entry = channelRegistry.get(key);
        if (!entry) return;

        logger.debug(`[useRealTimeSubscription] Channel status: ${subscriptionStatus}`, { table, channelName });

        if (subscriptionStatus === 'SUBSCRIBED') {
          notifyStatusCallbacks(entry, 'connected');
          logger.info(`[useRealTimeSubscription] Successfully subscribed to ${table}`);
        } else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          notifyStatusCallbacks(entry, 'error');
          handleReconnect();
        } else if (subscriptionStatus === 'CLOSED') {
          notifyStatusCallbacks(entry, 'disconnected');
        }
      });

    newEntry.channel = channel;
  }, [tenantId, enabled, table, event, schema, filterColumn, createHandler, handleReconnect]);

  /**
   * Manual reconnect function (per-component)
   */
  const reconnect = useCallback(() => {
    logger.debug(`[useRealTimeSubscription] Manual reconnect requested for ${table}`);
    retryCountRef.current = 0;

    // Clean up this subscriber's registration and re-setup.
    // If other subscribers exist on the shared channel, this will
    // detach and reattach (or create a fresh channel if it was the last one).
    cleanup();
    setupSubscriptionInternal();
  }, [table, cleanup, setupSubscriptionInternal]);

  /**
   * Manual disconnect function (per-component)
   */
  const disconnect = useCallback(() => {
    logger.debug(`[useRealTimeSubscription] Manual disconnect requested for ${table}`);
    cleanup();
  }, [table, cleanup]);

  // Setup subscription on mount and when dependencies change
  useEffect(() => {
    setupSubscriptionInternal();

    return () => {
      cleanup();
    };
  }, [setupSubscriptionInternal, cleanup]);

  return {
    status,
    reconnect,
    disconnect,
  };
}

export default useRealTimeSubscription;
