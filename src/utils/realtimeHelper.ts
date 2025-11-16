/**
 * Helper for Supabase Realtime subscriptions with automatic error tracking
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import bugFinder from './bugFinder';

export interface RealtimeSubscriptionOptions {
  channelName: string;
  onSubscribe?: (status: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Enhanced subscribe wrapper that tracks realtime errors
 */
export function subscribeWithErrorTracking(
  channel: RealtimeChannel,
  options?: RealtimeSubscriptionOptions
): RealtimeChannel {
  return channel.subscribe((status) => {
    const { channelName = 'unknown', onSubscribe, onError } = options || {};

    // Call original callback if provided
    if (onSubscribe) {
      onSubscribe(status);
    }

    // Track errors
    if (status === 'CHANNEL_ERROR') {
      const error = new Error(`Realtime channel error: ${channelName}`);
      bugFinder.reportRealtimeError(channelName, error, status);
      
      if (onError) {
        onError(error);
      }
    } else if (status === 'TIMED_OUT') {
      const error = new Error(`Realtime subscription timed out: ${channelName}`);
      bugFinder.reportRealtimeError(channelName, error, status);
      
      if (onError) {
        onError(error);
      }
    }
  });
}

