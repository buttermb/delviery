import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface DeduplicationParams {
  tenantId: string;
  userId: string;
  type: string;
  deduplicationKey: string;
  windowMinutes?: number;
}

/**
 * Check if a similar notification was recently sent to avoid duplicates
 * @param params Deduplication parameters
 * @returns true if notification should be sent, false if it's a duplicate
 */
export async function shouldSendNotification(
  params: DeduplicationParams
): Promise<boolean> {
  const { tenantId, userId, type, deduplicationKey, windowMinutes = 15 } = params;

  try {
    // Calculate time window
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

    // Check for existing notification with same deduplication key within window
    const { data, error } = await supabase
      .from('in_app_notifications')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('type', type)
      .gte('created_at', windowStart.toISOString())
      .contains('metadata', { deduplication_key: deduplicationKey })
      .limit(1);

    if (error) {
      logger.error('Failed to check notification deduplication:', error);
      // On error, allow notification to be sent
      return true;
    }

    // If we found a matching notification, it's a duplicate
    const isDuplicate = data && data.length > 0;

    if (isDuplicate) {
      logger.debug('[Notification Deduplication] Blocked duplicate notification:', {
        type,
        deduplicationKey,
        windowMinutes,
      });
    }

    return !isDuplicate;
  } catch (error) {
    logger.error('Error checking notification deduplication:', error);
    // On error, allow notification to be sent
    return true;
  }
}

/**
 * Create a deduplication key from parameters
 */
export function createDeduplicationKey(
  type: string,
  identifiers: Record<string, string | number>
): string {
  const sorted = Object.entries(identifiers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join('|');

  return `${type}:${sorted}`;
}

/**
 * Enhanced notification creation with deduplication
 */
export async function createNotificationWithDeduplication(
  params: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
    deduplicationKey?: string;
    deduplicationWindowMinutes?: number;
  }
): Promise<boolean> {
  const {
    tenantId,
    userId,
    type,
    title,
    message,
    actionUrl,
    metadata = {},
    deduplicationKey,
    deduplicationWindowMinutes = 15,
  } = params;

  // If deduplication key provided, check for duplicates
  if (deduplicationKey) {
    const shouldSend = await shouldSendNotification({
      tenantId,
      userId,
      type,
      deduplicationKey,
      windowMinutes: deduplicationWindowMinutes,
    });

    if (!shouldSend) {
      logger.debug('[Notification] Skipped duplicate notification');
      return false;
    }
  }

  // Create notification with deduplication key in metadata
  try {
    const { error } = await supabase.from('in_app_notifications').insert({
      tenant_id: tenantId,
      user_id: userId,
      type,
      title,
      message,
      action_url: actionUrl || null,
      metadata: deduplicationKey
        ? { ...metadata, deduplication_key: deduplicationKey }
        : metadata,
      read: false,
    });

    if (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }

    return true;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Batch send notifications with deduplication
 */
export async function batchSendNotifications(
  notifications: Array<{
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
    deduplicationKey?: string;
  }>
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  for (const notification of notifications) {
    try {
      const wasSent = await createNotificationWithDeduplication(notification);
      if (wasSent) {
        sent++;
      } else {
        skipped++;
      }
    } catch (error) {
      logger.error('Failed to send notification in batch:', error);
      skipped++;
    }
  }

  logger.debug('[Notification Batch] Sent:', sent, 'Skipped:', skipped);

  return { sent, skipped };
}
