/**
 * Safe Realtime Subscription Utility
 * Handles Supabase Realtime subscriptions with proper status handling, retries, and error recovery
 * 
 * Usage:
 *   const { unsubscribe } = subscribePostgresChanges({
 *     supabase,
 *     channelKey: `tenant:${tenantId}:orders`,
 *     schema: 'public',
 *     table: 'orders',
 *     filter: `tenant_id=eq.${tenantId}`,
 *     onChange: handleOrderChange,
 *     toastOnFail: true
 *   });
 */

import { logger } from '@/lib/logger';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';

export type RealtimeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED';
export type PostgresEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RetryOptions {
  max: number;
  baseMs: number;
}

const DEFAULT_RETRY: RetryOptions = { max: 3, baseMs: 500 };

interface SubscribeOptions<T = unknown> {
  supabase: SupabaseClient;
  channelKey: string;
  schema: string;
  table: string;
  event?: PostgresEvent;
  filter?: string;
  onChange: (payload: T) => void | Promise<void>;
  onStatus?: (status: RealtimeStatus) => void;
  retry?: RetryOptions;
  toastOnFail?: boolean;
}

/**
 * Validate payload structure based on event type
 */
function validatePayloadByEvent(event: PostgresEvent, payload: unknown): void {
  if (event === 'INSERT' || event === 'UPDATE' || event === '*') {
    if (!payload || typeof payload !== 'object' || !('new' in payload)) {
      throw new Error(`Missing payload.new for ${event} event`);
    }
  }
  
  if (event === 'DELETE' || event === '*') {
    if (!payload || typeof payload !== 'object' || !('old' in payload)) {
      throw new Error(`Missing payload.old for DELETE event`);
    }
  }
}

/**
 * Create a safe change handler that validates payloads and catches errors
 */
export function makeSafeChangeHandler<T>(
  event: PostgresEvent,
  handler: (payload: T) => void | Promise<void>,
  context?: Record<string, unknown>
) {
  return async (payload: unknown) => {
    try {
      validatePayloadByEvent(event, payload);
      
      // Warn if tenant_id is missing (multi-tenant safety)
      if (event !== 'DELETE' && payload && typeof payload === 'object') {
        const p = payload as Record<string, unknown>;
        if (p.new && typeof p.new === 'object') {
          const newData = p.new as Record<string, unknown>;
          if (typeof newData.tenant_id === 'undefined') {
            logger.warn('Realtime payload missing tenant_id', { event, context });
          }
        }
      }
      
      await handler(payload as T);
    } catch (error) {
      logger.error('Realtime handler failed', error, { event, context });
      // Don't throw - prevents subscription from breaking
    }
  };
}

/**
 * Subscribe to Postgres changes with automatic status handling and retries
 */
export function subscribePostgresChanges<T = unknown>({
  supabase,
  channelKey,
  schema,
  table,
  event = '*',
  filter,
  onChange,
  onStatus,
  retry = DEFAULT_RETRY,
  toastOnFail = false,
}: SubscribeOptions<T>) {
  let channel: RealtimeChannel | null = null;
  let attempt = 0;
  let isUnsubscribed = false;

  const safeHandler = makeSafeChangeHandler(event, onChange, { channelKey, table });

  const createSubscription = () => {
    if (isUnsubscribed) return;

    channel = supabase.channel(channelKey);
    
    // Subscribe to postgres changes with proper type signature
    if (filter) {
      channel.on('postgres_changes' as any, { event, schema, table, filter } as any, safeHandler);
    } else {
      channel.on('postgres_changes' as any, { event, schema, table } as any, safeHandler);
    }

    channel.subscribe((status) => {
      onStatus?.(status);

      if (status === 'SUBSCRIBED') {
        logger.debug('Realtime subscribed', { channelKey, table, filter });
        attempt = 0; // Reset attempt counter on success
        return;
      }

      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        logger.warn('Realtime subscription error', { 
          channelKey, 
          table, 
          status, 
          attempt: attempt + 1 
        });

        if (attempt < retry.max) {
          attempt += 1;
          const delay = retry.baseMs * Math.pow(2, attempt - 1);
          
          logger.info('Retrying realtime subscription', { 
            channelKey, 
            attempt, 
            delayMs: delay 
          });

          setTimeout(() => {
            if (!isUnsubscribed && channel) {
              try {
                supabase.removeChannel(channel);
              } catch (error) {
                logger.warn('Error removing channel before retry', error);
              }
              createSubscription();
            }
          }, delay);
        } else {
          const message = `Realtime subscription failed permanently (${status})`;
          logger.error(message, undefined, { 
            channelKey, 
            schema, 
            table, 
            filter,
            attempts: attempt 
          });
          
          if (toastOnFail) {
            toast.error('Connection issue. Please refresh if updates stop appearing.');
          }
        }
      }

      if (status === 'CLOSED') {
        logger.info('Realtime channel closed', { channelKey });
      }
    });
  };

  createSubscription();

  const unsubscribe = () => {
    isUnsubscribed = true;
    if (channel) {
      try {
        supabase.removeChannel(channel);
        logger.debug('Realtime unsubscribed', { channelKey });
      } catch (error) {
        logger.warn('Failed to remove channel', { channelKey, error });
      }
    }
  };

  return { unsubscribe };
}

/**
 * Helper for broadcast subscriptions
 */
export function subscribeBroadcast<T = unknown>({
  supabase,
  channelKey,
  event,
  onMessage,
  onStatus,
  retry = DEFAULT_RETRY,
  toastOnFail = false,
}: {
  supabase: SupabaseClient;
  channelKey: string;
  event: string;
  onMessage: (payload: T) => void | Promise<void>;
  onStatus?: (status: RealtimeStatus) => void;
  retry?: RetryOptions;
  toastOnFail?: boolean;
}) {
  let channel: RealtimeChannel | null = null;
  let attempt = 0;
  let isUnsubscribed = false;

  const safeHandler = async (payload: unknown) => {
    try {
      await onMessage(payload as T);
    } catch (error) {
      logger.error('Broadcast handler failed', error, { channelKey, event });
    }
  };

  const createSubscription = () => {
    if (isUnsubscribed) return;

    channel = supabase.channel(channelKey);
    channel.on('broadcast', { event }, safeHandler);

    channel.subscribe((status) => {
      onStatus?.(status);

      if (status === 'SUBSCRIBED') {
        logger.debug('Broadcast subscribed', { channelKey, event });
        attempt = 0;
        return;
      }

      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        logger.warn('Broadcast subscription error', { channelKey, event, status, attempt: attempt + 1 });

        if (attempt < retry.max) {
          attempt += 1;
          const delay = retry.baseMs * Math.pow(2, attempt - 1);
          
          setTimeout(() => {
            if (!isUnsubscribed && channel) {
              try {
                supabase.removeChannel(channel);
              } catch (error) {
                logger.warn('Error removing channel before retry', error);
              }
              createSubscription();
            }
          }, delay);
        } else {
          logger.error('Broadcast subscription failed permanently', undefined, { 
            channelKey, 
            event, 
            status,
            attempts: attempt 
          });
          
          if (toastOnFail) {
            toast.error('Connection issue. Please refresh.');
          }
        }
      }
    });
  };

  createSubscription();

  const unsubscribe = () => {
    isUnsubscribed = true;
    if (channel) {
      try {
        supabase.removeChannel(channel);
        logger.debug('Broadcast unsubscribed', { channelKey });
      } catch (error) {
        logger.warn('Failed to remove channel', { channelKey, error });
      }
    }
  };

  return { unsubscribe };
}
