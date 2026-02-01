import { logger } from '@/lib/logger';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';

interface SendNotificationParams {
  orderId: string;
  event: 'order_placed' | 'order_processing' | 'order_completed' | 'order_cancelled';
  customMessage?: string;
}

interface NotificationResult {
  success: boolean;
  message?: string;
  notifications?: Array<{ type: string; status: string }>;
}

export const useSendNotification = () => {
  const { tenant } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async ({ orderId, event, customMessage }: SendNotificationParams): Promise<NotificationResult> => {
      // Get notification settings
      const settingsStr = localStorage.getItem('notification_settings');
      if (!settingsStr) {
        logger.warn('Notification settings not configured, using defaults');
      }

      const settings = settingsStr ? JSON.parse(settingsStr) : {
        channels: { sms: true, email: false },
        templates: []
      };
      
      const template = settings.templates?.find((t: any) => t.event === event);

      if (template && !template.enabled) {
        return { success: false, message: 'Notification disabled for this event' };
      }

      if (!tenant?.id) throw new Error('No tenant');

      // Get order details
      const { data: order, error: orderError } = await supabase
        .from('menu_orders')
        .select('*')
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (orderError) {
        logger.error('Failed to fetch order for notification', { orderId, error: orderError });
        throw orderError;
      }

      if (!order) {
        throw new Error('Order not found');
      }

      // Build message from template or use custom message
      let message = customMessage || template?.message || `Order ${event.replace('_', ' ')} - Order #${order.id.slice(0, 8)}`;
      message = message.replace(/\{\{order_id\}\}/g, order.id.slice(0, 8));
      message = message.replace(/\{\{total_amount\}\}/g, order.total_amount?.toString() || '0');
      message = message.replace(/\{\{customer_name\}\}/g, 'Customer');

      const notifications: Array<{ type: string; status: string }> = [];

      // Send SMS via edge function
      if (settings.channels?.sms && order.contact_phone) {
        try {
          const { data: smsResult, error: smsError } = await supabase.functions.invoke('send-sms', {
            body: {
              to: order.contact_phone,
              message,
              accountId: tenant?.id
            }
          });

          if (smsError) {
            logger.error('SMS send failed', { error: smsError, phone: order.contact_phone });
            notifications.push({ type: 'sms', status: 'failed' });
          } else {
            logger.info('SMS sent successfully', { phone: order.contact_phone, result: smsResult });
            notifications.push({ type: 'sms', status: 'sent' });
          }
        } catch (err) {
          logger.error('SMS edge function error', { error: err });
          notifications.push({ type: 'sms', status: 'error' });
        }
      }

      // Send database notification via edge function
      if (tenant?.id) {
        try {
          const { data: notifResult, error: notifError } = await supabase.functions.invoke('send-notification', {
            body: {
              tenant_id: tenant.id,
              type: 'order_status',
              title: template?.subject || `Order ${event.replace('_', ' ')}`,
              message,
              channels: ['database'],
              metadata: {
                order_id: orderId,
                event
              }
            }
          });

          if (notifError) {
            logger.error('Database notification failed', { error: notifError });
            notifications.push({ type: 'database', status: 'failed' });
          } else {
            logger.info('Database notification sent', { result: notifResult });
            notifications.push({ type: 'database', status: 'sent' });
          }
        } catch (err) {
          logger.error('Notification edge function error', { error: err });
          notifications.push({ type: 'database', status: 'error' });
        }
      }

      const successCount = notifications.filter(n => n.status === 'sent').length;
      return { 
        success: successCount > 0, 
        notifications,
        message: successCount > 0 ? `${successCount} notification(s) sent` : 'No notifications sent'
      };
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message || 'Notification sent');
      } else {
        toast.warning(result.message || 'Notification not sent');
      }
    },
    onError: (error: Error) => {
      logger.error('Notification mutation error', { error });
      toast.error('Failed to send notification');
    }
  });
};

export const useSendBulkNotification = () => {
  const { tenant } = useTenantAdminAuth();

  return useMutation({
    mutationFn: async ({
      recipients,
      message,
      subject,
      channel
    }: {
      recipients: string[];
      message: string;
      subject?: string;
      channel: 'email' | 'sms';
    }) => {
      if (!tenant?.id) {
        throw new Error('Tenant not found');
      }

      const results: Array<{ recipient: string; status: string }> = [];

      // Process in batches to avoid overwhelming the edge function
      const batchSize = 10;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (recipient) => {
          try {
            if (channel === 'sms') {
              const { error } = await supabase.functions.invoke('send-sms', {
                body: {
                  to: recipient,
                  message,
                  accountId: tenant.id
                }
              });
              return { recipient, status: error ? 'failed' : 'sent' };
            } else {
              // Email channel - use send-notification with email channel
              const { error } = await supabase.functions.invoke('send-notification', {
                body: {
                  tenant_id: tenant.id,
                  type: 'bulk_message',
                  title: subject || 'Notification',
                  message,
                  channels: ['email'],
                  metadata: { recipient_email: recipient }
                }
              });
              return { recipient, status: error ? 'failed' : 'sent' };
            }
          } catch (err) {
            logger.error('Bulk notification error', { recipient, error: err });
            return { recipient, status: 'error' };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const sentCount = results.filter(r => r.status === 'sent').length;
      logger.info('Bulk notifications completed', { 
        channel, 
        total: recipients.length, 
        sent: sentCount 
      });

      return { success: sentCount > 0, sent: sentCount, total: recipients.length, results };
    },
    onSuccess: (result) => {
      toast.success(`${result.sent}/${result.total} notifications sent`);
    },
    onError: (error: Error) => {
      logger.error('Bulk notification error', { error });
      toast.error('Failed to send bulk notifications');
    }
  });
};
