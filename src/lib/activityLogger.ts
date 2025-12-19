/**
 * Activity Logger Utility
 * Centralized activity logging for user actions
 * Phase 4: Create Missing Tables & Logging
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityLogParams {
  userId: string;
  tenantId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an activity event
 * Calls the log_activity() SQL function to record user actions
 */
export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    const { data, error } = await (supabase as any).rpc('log_activity', {
      p_user_id: params.userId,
      p_tenant_id: params.tenantId,
      p_action: params.action,
      p_resource: params.resource || null,
      p_resource_id: params.resourceId || null,
      p_metadata: params.metadata || {},
    });

    if (error) {
      logger.error('Failed to log activity', error, { component: 'activityLogger' });
      // Don't throw - activity logging failures shouldn't break the app
    } else {
      logger.debug('Activity logged', { action: params.action, resource: params.resource, component: 'activityLogger' });
    }
  } catch (error) {
    logger.error('Error in logActivity', error, { component: 'activityLogger' });
  }
}

/**
 * Helper to get current user ID from Supabase auth
 */
async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    logger.error('Error getting current user', error, { component: 'activityLogger' });
    return null;
  }
}

/**
 * Log activity with automatic user ID detection
 * Convenience wrapper that gets userId from auth context
 */
export async function logActivityAuto(
  tenantId: string,
  action: string,
  resource?: string,
  resourceId?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    logger.warn('Cannot log activity: No authenticated user', { action, component: 'activityLogger' });
    return;
  }

  return logActivity({
    userId,
    tenantId,
    action,
    resource,
    resourceId,
    metadata,
  });
}

/**
 * Common activity actions for easy reference
 */
export const ActivityActions = {
  // Order actions
  CREATE_ORDER: 'create_order',
  UPDATE_ORDER: 'update_order',
  CANCEL_ORDER: 'cancel_order',
  COMPLETE_ORDER: 'complete_order',
  
  // Inventory actions
  UPDATE_INVENTORY: 'update_inventory',
  ADJUST_INVENTORY: 'adjust_inventory',
  ADD_INVENTORY: 'add_inventory',
  REMOVE_INVENTORY: 'remove_inventory',
  
  // Payment actions
  PROCESS_PAYMENT: 'process_payment',
  RECORD_PAYMENT: 'record_payment',
  REFUND_PAYMENT: 'refund_payment',
  
  // Delivery actions
  ASSIGN_DELIVERY: 'assign_delivery',
  UPDATE_DELIVERY_STATUS: 'update_delivery_status',
  COMPLETE_DELIVERY: 'complete_delivery',
  
  // User actions
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  DELETE_USER: 'delete_user',
  
  // Settings actions
  UPDATE_SETTINGS: 'update_settings',
  UPDATE_BILLING: 'update_billing',
  
  // System actions
  LOGIN: 'login',
  LOGOUT: 'logout',
  EXPORT_DATA: 'export_data',
  IMPORT_DATA: 'import_data',
} as const;

