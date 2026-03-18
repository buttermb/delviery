/**
 * React hook wrapper around the eventBus utility
 * Provides auto-cleanup on unmount and type-safe event handling
 */

import { useEffect, useCallback, useRef } from 'react';

import type { EventName, EventPayloads, EventCallback } from '@/lib/eventBus';
import { subscribe, publish } from '@/lib/eventBus';
import { logger } from '@/lib/logger';

/**
 * Hook for subscribing to eventBus events with automatic cleanup
 * @param eventName - The event to subscribe to
 * @param callback - Handler function called when event is published
 * @returns Object with publish function for the subscribed event type
 */
export function useEventBus<T extends EventName>(
  eventName: T,
  callback: EventCallback<T>
): {
  publish: (payload: EventPayloads[T]) => void;
} {
  // Use ref to keep callback stable and avoid re-subscribing on every render
  const callbackRef = useRef(callback);

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Subscribe to event and cleanup on unmount
  useEffect(() => {
    logger.debug(`[useEventBus] Setting up subscription for: ${eventName}`);

    // Wrapper that calls the current callback ref
    const handler: EventCallback<T> = (payload) => {
      callbackRef.current(payload);
    };

    const unsubscribe = subscribe(eventName, handler);

    return () => {
      logger.debug(`[useEventBus] Cleaning up subscription for: ${eventName}`);
      unsubscribe();
    };
  }, [eventName]);

  // Memoized publish function for this event type
  const publishEvent = useCallback(
    (payload: EventPayloads[T]) => {
      logger.debug(`[useEventBus] Publishing event via hook: ${eventName}`);
      publish(eventName, payload);
    },
    [eventName]
  );

  return {
    publish: publishEvent,
  };
}

/**
 * Hook for only publishing events (no subscription)
 * Useful when a component only needs to emit events
 * @param eventName - The event type to publish
 * @returns Publish function for the specified event type
 */
export function useEventPublisher<T extends EventName>(
  eventName: T
): (payload: EventPayloads[T]) => void {
  const publishEvent = useCallback(
    (payload: EventPayloads[T]) => {
      logger.debug(`[useEventPublisher] Publishing event: ${eventName}`);
      publish(eventName, payload);
    },
    [eventName]
  );

  return publishEvent;
}

/**
 * Hook for subscribing to multiple events at once
 * @param subscriptions - Map of event names to callbacks
 */
export function useMultiEventBus<T extends EventName>(
  subscriptions: Partial<{ [K in T]: EventCallback<K> }>
): void {
  // Use ref to keep subscriptions stable
  const subscriptionsRef = useRef(subscriptions);

  useEffect(() => {
    subscriptionsRef.current = subscriptions;
  }, [subscriptions]);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    const eventNames = Object.keys(subscriptionsRef.current) as T[];

    logger.debug(`[useMultiEventBus] Setting up subscriptions for: ${eventNames.join(', ')}`);

    eventNames.forEach((eventName) => {
      const callback = subscriptionsRef.current[eventName];
      if (callback) {
        const unsubscribe = subscribe(eventName, callback as EventCallback<typeof eventName>);
        unsubscribers.push(unsubscribe);
      }
    });

    return () => {
      logger.debug(`[useMultiEventBus] Cleaning up ${unsubscribers.length} subscriptions`);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);
}

export default useEventBus;
