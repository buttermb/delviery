/**
 * Real-time subscription hook for Supabase with tenant isolation
 *
 * Wraps Supabase realtime subscriptions with:
 * - Tenant isolation (filters by tenant_id)
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

/**
 * Calculate backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number): number {
  const delay = Math.min(
    BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, attempt),
    BACKOFF_CONFIG.maxDelay
  );
  // Add jitter (±20%)
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
 * Hook for subscribing to Supabase realtime changes with tenant isolation
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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(callback);
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
   * Clean up subscription and retry timeout
   */
  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (channelRef.current) {
      logger.debug(`[useRealTimeSubscription] Cleaning up subscription for table: ${table}`);
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (mountedRef.current) {
      setStatus('disconnected');
    }
  }, [table]);

  /**
   * Handle incoming realtime changes
   */
  const handleChange = useCallback(
    (payload: RealtimePostgresChangesPayload<T & { tenant_id?: string }>) => {
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
    },
    [table, tenantId, publishToEvent]
  );

  /**
   * Handle reconnection with exponential backoff
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
   * Internal setup function (no dependencies on itself)
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

    // Clean up existing subscription
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setStatus('connecting');

    logger.debug(`[useRealTimeSubscription] Setting up subscription`, {
      table,
      tenantId,
      event,
      schema,
    });

    const channelName = `realtime:${schema}:${table}:${tenantId}`;

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
        handleChange
      )
      .subscribe((subscriptionStatus) => {
        if (!mountedRef.current) return;

        logger.debug(`[useRealTimeSubscription] Channel status: ${subscriptionStatus}`, { table, channelName });

        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus('connected');
          retryCountRef.current = 0; // Reset retry count on successful connection
          logger.info(`[useRealTimeSubscription] Successfully subscribed to ${table}`);
        } else if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          setStatus('error');
          handleReconnect();
        } else if (subscriptionStatus === 'CLOSED') {
          setStatus('disconnected');
        }
      });

    channelRef.current = channel;
  }, [tenantId, enabled, table, event, schema, filterColumn, handleChange, handleReconnect]);

  /**
   * Manual reconnect function
   */
  const reconnect = useCallback(() => {
    logger.debug(`[useRealTimeSubscription] Manual reconnect requested for ${table}`);
    retryCountRef.current = 0;
    setupSubscriptionInternal();
  }, [table, setupSubscriptionInternal]);

  /**
   * Manual disconnect function
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
