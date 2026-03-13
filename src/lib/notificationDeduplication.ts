import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface DeduplicationCheckParams {
  tenantId: string;
  notificationType: string;
  recipient: string;
  messagePreview: string;
  deduplicationWindowMinutes?: number;
}

/**
 * Check if a similar notification was sent recently to avoid duplicates.
 * Returns true if a duplicate was found, false otherwise.
 */
export async function isDuplicateNotification(params: DeduplicationCheckParams): Promise<boolean> {
  const { tenantId, notificationType, recipient, messagePreview, deduplicationWindowMinutes = 15 } = params;

  try {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - deduplicationWindowMinutes);

    const { data, error } = await supabase
      .from('notification_delivery_log')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('notification_type', notificationType)
      .eq('recipient', recipient)
      .eq('message_preview', messagePreview)
      .gte('created_at', windowStart.toISOString())
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('[NotificationDeduplication] Error checking for duplicates', { error });
      return false; // On error, allow the notification to be sent
    }

    const isDuplicate = !!data;

    if (isDuplicate) {
      logger.warn('[NotificationDeduplication] Duplicate notification detected', {
        tenantId,
        notificationType,
        recipient,
        windowMinutes: deduplicationWindowMinutes,
      });
    }

    return isDuplicate;
  } catch (error) {
    logger.error('[NotificationDeduplication] Unexpected error checking for duplicates', { error });
    return false; // On error, allow the notification to be sent
  }
}

interface CreateNotificationParams {
  tenantId: string;
  notificationType: string;
  recipient: string;
  subject?: string;
  messagePreview?: string;
  metadata?: Record<string, unknown>;
  skipDeduplication?: boolean;
}

/**
 * Create a notification with automatic deduplication.
 * Returns the notification ID if created, or null if it was a duplicate.
 */
export async function createNotificationWithDeduplication(
  params: CreateNotificationParams
): Promise<string | null> {
  const { tenantId, notificationType, recipient, subject, messagePreview, metadata, skipDeduplication = false } = params;

  // Check for duplicates unless explicitly skipped
  if (!skipDeduplication && messagePreview) {
    const isDuplicate = await isDuplicateNotification({
      tenantId,
      notificationType,
      recipient,
      messagePreview,
    });

    if (isDuplicate) {
      logger.info('[NotificationDeduplication] Skipping duplicate notification');
      return null;
    }
  }

  // Create the notification
  try {
    const { data, error } = await supabase
      .from('notification_delivery_log')
      .insert({
        tenant_id: tenantId,
        notification_type: notificationType,
        recipient,
        subject: subject ?? null,
        message_preview: messagePreview ?? null,
        metadata: metadata ?? null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      logger.error('[NotificationDeduplication] Failed to create notification', { error });
      throw error;
    }

    logger.info('[NotificationDeduplication] Notification created', { id: data.id });
    return data.id;
  } catch (error) {
    logger.error('[NotificationDeduplication] Error creating notification', { error });
    throw error;
  }
}
