/**
 * useRealtimeSubscription Hook
 *
 * Generic hook that subscribes to Supabase Realtime postgres_changes
 * and auto-invalidates TanStack Query cache on table changes.
 *
 * Usage:
 *   import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
 *   import { queryKeys } from '@/lib/queryKeys';
 *
 *   // Basic: invalidate all products queries on any change
 *   useRealtimeSubscription({
 *     table: 'products',
 *     queryKeys: [queryKeys.products.all],
 *   });
 *
 *   // With filter: only listen to changes for this tenant
 *   useRealtimeSubscription({
 *     table: 'orders',
 *     filter: `tenant_id=eq.${tenantId}`,
 *     queryKeys: [queryKeys.orders.all, queryKeys.analytics.all],
 *     enabled: !!tenantId,
 *   });
 *
 *   // With event-specific callbacks
 *   useRealtimeSubscription({
 *     table: 'products',
 *     queryKeys: [queryKeys.products.all],
 *     onInsert: (record) => logger.debug('New product', { record }),
 *     onUpdate: (record) => logger.debug('Updated product', { record }),
 *   });
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

interface RealtimeRecord {
  id?: string;
  [key: string]: unknown;
}

interface UseRealtimeSubscriptionOptions {
  /** The database table to subscribe to */
  table: string;
  /** Database schema (defaults to 'public') */
  schema?: string;
  /** Supabase realtime filter (e.g., 'tenant_id=eq.abc123') */
  filter?: string;
  /** Event types to listen for (defaults to all: INSERT, UPDATE, DELETE) */
  events?: PostgresChangeEvent[];
  /** Query keys to invalidate when changes occur */
  queryKeys: readonly QueryKey[];
  /** Whether the subscription is active (defaults to true) */
  enabled?: boolean;
  /** Callback fired on INSERT events */
  onInsert?: (record: RealtimeRecord) => void;
  /** Callback fired on UPDATE events */
  onUpdate?: (newRecord: RealtimeRecord, oldRecord: RealtimeRecord) => void;
  /** Callback fired on DELETE events */
  onDelete?: (record: RealtimeRecord) => void;
  /** Callback fired on any change event */
  onChange?: (event: PostgresChangeEvent, payload: RealtimePostgresChangesPayload<RealtimeRecord>) => void;
  /** Debounce invalidation in milliseconds (useful for high-frequency tables) */
  debounceMs?: number;
  /** Custom channel name (auto-generated if not provided) */
  channelName?: string;
}

interface UseRealtimeSubscriptionResult {
  /** Whether the subscription channel is currently active */
  isSubscribed: boolean;
  /** The current subscription status */
  status: 'connecting' | 'subscribed' | 'error' | 'closed' | 'idle';
}

/**
 * Hook that subscribes to Supabase Realtime table changes and
 * auto-invalidates the specified TanStack Query cache keys.
 */
export function useRealtimeSubscription(
  options: UseRealtimeSubscriptionOptions
): UseRealtimeSubscriptionResult {
  const {
    table,
    schema = 'public',
    filter,
    events,
    queryKeys: keysToInvalidate,
    enabled = true,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
    debounceMs,
    channelName,
  } = options;

  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<UseRealtimeSubscriptionResult['status']>('idle');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable ref for callbacks to avoid re-subscribing on callback changes
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete, onChange });
  callbacksRef.current = { onInsert, onUpdate, onDelete, onChange };

  // Stable ref for queryKeys to avoid unnecessary re-subscriptions
  const queryKeysRef = useRef(keysToInvalidate);
  queryKeysRef.current = keysToInvalidate;

  const invalidateQueries = useCallback(() => {
    const keys = queryKeysRef.current;
    for (const key of keys) {
      queryClient.invalidateQueries({ queryKey: key as QueryKey });
    }
  }, [queryClient]);

  const debouncedInvalidate = useCallback(() => {
    if (debounceMs && debounceMs > 0) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        invalidateQueries();
        debounceTimerRef.current = null;
      }, debounceMs);
    } else {
      invalidateQueries();
    }
  }, [invalidateQueries, debounceMs]);

  useEffect(() => {
    if (!enabled) {
      statusRef.current = 'idle';
      return;
    }

    // Generate a unique channel name
    const resolvedChannelName = channelName
      ?? `realtime-sub-${table}${filter ? `-${filter.replace(/[^a-zA-Z0-9]/g, '_')}` : ''}`;

    statusRef.current = 'connecting';

    // Determine the event to listen for
    const eventFilter = events && events.length === 1 ? events[0] : '*';

    const channel = supabase
      .channel(resolvedChannelName)
      .on(
        'postgres_changes',
        {
          event: eventFilter,
          schema,
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<RealtimeRecord>) => {
          const eventType = payload.eventType as PostgresChangeEvent;

          // If events filter is specified and this event isn't in it, skip
          if (events && events.length > 1 && !events.includes(eventType)) {
            return;
          }

          logger.debug(`[useRealtimeSubscription] ${table} ${eventType}`, {
            table,
            event: eventType,
            filter,
          });

          // Fire event-specific callbacks
          const callbacks = callbacksRef.current;
          switch (eventType) {
            case 'INSERT':
              callbacks.onInsert?.(payload.new as RealtimeRecord);
              break;
            case 'UPDATE':
              callbacks.onUpdate?.(
                payload.new as RealtimeRecord,
                payload.old as RealtimeRecord
              );
              break;
            case 'DELETE':
              callbacks.onDelete?.(payload.old as RealtimeRecord);
              break;
          }

          // Fire generic onChange callback
          callbacks.onChange?.(eventType, payload);

          // Invalidate TanStack Query cache
          debouncedInvalidate();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          statusRef.current = 'subscribed';
          logger.debug('[useRealtimeSubscription] Subscribed', {
            table,
            filter,
            channel: resolvedChannelName,
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          statusRef.current = 'error';
          logger.warn('[useRealtimeSubscription] Subscription error', {
            table,
            filter,
            status,
            channel: resolvedChannelName,
          });
        } else if (status === 'CLOSED') {
          statusRef.current = 'closed';
        }
      });

    channelRef.current = channel;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      statusRef.current = 'idle';
    };
  }, [table, schema, filter, enabled, channelName, events, debouncedInvalidate]);

  return {
    isSubscribed: statusRef.current === 'subscribed',
    status: statusRef.current,
  };
}
