/**
 * Typed publish/subscribe event bus for cross-module communication
 * Enables loose coupling between modules while maintaining type safety
 */

import { logger } from '@/lib/logger';

// Event payload types for type-safe event handling
export interface EventPayloads {
  order_created: { orderId: string; tenantId: string; customerId?: string };
  order_updated: { orderId: string; tenantId: string; status?: string; changes?: Record<string, unknown> };
  inventory_changed: { productId: string; tenantId: string; locationId?: string; quantityChange: number; newQuantity: number };
  customer_updated: { customerId: string; tenantId: string; changes?: Record<string, unknown> };
  product_updated: { productId: string; tenantId: string; changes?: Record<string, unknown> };
  storefront_synced: { tenantId: string; storefrontId: string; syncedAt: string };
  menu_published: { menuId: string; tenantId: string; publishedAt: string };
  notification_sent: { notificationId: string; tenantId: string; userId?: string; type: string };
}

// Event names derived from payload types
export type EventName = keyof EventPayloads;

// Callback type for event handlers
export type EventCallback<T extends EventName> = (payload: EventPayloads[T]) => void;

// Internal storage for subscriptions
type SubscriptionMap = Map<string, Set<EventCallback<EventName>>>;

const subscriptions: SubscriptionMap = new Map();

/**
 * Subscribe to an event
 * @param eventName - Name of the event to subscribe to
 * @param callback - Function to call when event is published
 * @returns Unsubscribe function
 */
export function subscribe<T extends EventName>(
  eventName: T,
  callback: EventCallback<T>
): () => void {
  if (!subscriptions.has(eventName)) {
    subscriptions.set(eventName, new Set());
  }

  const callbacks = subscriptions.get(eventName)!;
  callbacks.add(callback as EventCallback<EventName>);

  logger.debug(`[EventBus] Subscribed to event: ${eventName}`, {
    subscriberCount: callbacks.size
  });

  // Return unsubscribe function
  return () => unsubscribe(eventName, callback);
}

/**
 * Unsubscribe from an event
 * @param eventName - Name of the event to unsubscribe from
 * @param callback - The callback function to remove
 */
export function unsubscribe<T extends EventName>(
  eventName: T,
  callback: EventCallback<T>
): void {
  const callbacks = subscriptions.get(eventName);
  if (callbacks) {
    callbacks.delete(callback as EventCallback<EventName>);
    logger.debug(`[EventBus] Unsubscribed from event: ${eventName}`, {
      remainingSubscribers: callbacks.size
    });

    // Clean up empty sets
    if (callbacks.size === 0) {
      subscriptions.delete(eventName);
    }
  }
}

/**
 * Publish an event to all subscribers
 * @param eventName - Name of the event to publish
 * @param payload - Event payload data
 */
export function publish<T extends EventName>(
  eventName: T,
  payload: EventPayloads[T]
): void {
  const callbacks = subscriptions.get(eventName);

  logger.debug(`[EventBus] Publishing event: ${eventName}`, {
    payload,
    subscriberCount: callbacks?.size ?? 0
  });

  if (callbacks && callbacks.size > 0) {
    callbacks.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        logger.error(`[EventBus] Error in event handler for ${eventName}`, error, {
          payload
        });
      }
    });
  }
}

/**
 * Get the count of subscribers for an event
 * @param eventName - Name of the event
 * @returns Number of subscribers
 */
export function getSubscriberCount<T extends EventName>(eventName: T): number {
  return subscriptions.get(eventName)?.size ?? 0;
}

/**
 * Clear all subscriptions (useful for testing)
 */
export function clearAllSubscriptions(): void {
  subscriptions.clear();
  logger.debug('[EventBus] All subscriptions cleared');
}

// Default export for convenient importing
export const eventBus = {
  subscribe,
  unsubscribe,
  publish,
  getSubscriberCount,
  clearAllSubscriptions,
};
