/**
 * Activity Log Utility
 * Provides audit trail functionality for tracking user actions across modules
 *
 * Usage:
 *   import { logActivity, ActivityAction } from '@/lib/activityLog';
 *   await logActivity(tenantId, userId, ActivityAction.CREATED, 'order', orderId, { total: 100 });
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

/**
 * Action types for activity logging
 */
export const ActivityAction = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  VIEWED: 'viewed',
  EXPORTED: 'exported',
  SYNCED: 'synced',
} as const;

export type ActivityActionType = typeof ActivityAction[keyof typeof ActivityAction];

/**
 * Common entity types for activity logging
 */
export const EntityType = {
  ORDER: 'order',
  PRODUCT: 'product',
  CUSTOMER: 'customer',
  INVENTORY: 'inventory',
  MENU: 'menu',
  STOREFRONT: 'storefront',
  DELIVERY: 'delivery',
  PAYMENT: 'payment',
  INVOICE: 'invoice',
  USER: 'user',
  SETTINGS: 'settings',
  REPORT: 'report',
  SUPPLIER: 'supplier',
  PURCHASE_ORDER: 'purchase_order',
  RETURN: 'return',
  COUPON: 'coupon',
  LOYALTY: 'loyalty',
} as const;

export type EntityTypeValue = typeof EntityType[keyof typeof EntityType];

/**
 * Metadata type for additional context
 */
export type ActivityMetadata = Record<string, unknown>;

/**
 * Activity log entry interface
 */
export interface ActivityLogEntry {
  id: string;
  tenant_id: string;
  user_id: string;
  action: ActivityActionType;
  entity_type: string;
  entity_id: string | null;
  metadata: ActivityMetadata;
  created_at: string;
}

/**
 * Log an activity event to the activity_log table
 *
 * @param tenantId - The tenant ID for multi-tenant isolation
 * @param userId - The user ID performing the action
 * @param action - The type of action (created, updated, deleted, viewed, exported, synced)
 * @param entityType - The type of entity being acted upon
 * @param entityId - Optional ID of the specific entity
 * @param metadata - Optional additional context about the action
 *
 * @example
 * await logActivity(tenantId, userId, 'created', 'order', orderId, { total: 150.00 });
 */
export async function logActivity(
  tenantId: string,
  userId: string,
  action: ActivityActionType | string,
  entityType: string,
  entityId?: string | null,
  metadata: ActivityMetadata = {}
): Promise<void> {
  try {
    if (!tenantId || !userId) {
      logger.warn('logActivity called without tenantId or userId', {
        tenantId,
        userId,
        action,
        entityType
      });
      return;
    }

    const { error } = await supabase
      .from('activity_log')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        metadata,
      });

    if (error) {
      // Log the error but don't throw - activity logging failures shouldn't break the app
      logger.error('Failed to log activity', error, {
        component: 'activityLog',
        tenantId,
        action,
        entityType,
      });
      return;
    }

    logger.debug('Activity logged successfully', {
      action,
      entityType,
      entityId,
    });
  } catch (error) {
    // Catch any unexpected errors
    logger.error('Error in logActivity', error, {
      component: 'activityLog',
      tenantId,
      action,
      entityType,
    });
  }
}

/**
 * Batch log multiple activity events
 * Useful for bulk operations
 *
 * @param entries - Array of activity log entries to insert
 */
export async function logActivities(
  entries: Array<{
    tenantId: string;
    userId: string;
    action: ActivityActionType | string;
    entityType: string;
    entityId?: string | null;
    metadata?: ActivityMetadata;
  }>
): Promise<void> {
  if (entries.length === 0) return;

  try {
    const records = entries.map((entry) => ({
      tenant_id: entry.tenantId,
      user_id: entry.userId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      metadata: entry.metadata || {},
    }));

    const { error } = await supabase
      .from('activity_log')
      .insert(records);

    if (error) {
      logger.error('Failed to batch log activities', error, {
        component: 'activityLog',
        count: entries.length,
      });
      return;
    }

    logger.debug('Batch activities logged successfully', {
      count: entries.length,
    });
  } catch (error) {
    logger.error('Error in logActivities', error, {
      component: 'activityLog',
      count: entries.length,
    });
  }
}

/**
 * Helper to create activity metadata with common fields
 */
export function createActivityMetadata(
  changes?: Record<string, unknown>,
  previousValues?: Record<string, unknown>,
  additionalData?: Record<string, unknown>
): ActivityMetadata {
  return {
    ...(changes && { changes }),
    ...(previousValues && { previousValues }),
    ...additionalData,
    timestamp: new Date().toISOString(),
  };
}
