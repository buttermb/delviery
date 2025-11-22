import { logger } from '@/lib/logger';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SendNotificationParams {
  orderId: string;
  event: 'order_placed' | 'order_processing' | 'order_completed' | 'order_cancelled';
  customMessage?: string;
}

export const useSendNotification = () => {
  return useMutation({
    mutationFn: async ({ orderId, event, customMessage }: SendNotificationParams) => {
      // Get notification settings
      const settingsStr = localStorage.getItem('notification_settings');
      if (!settingsStr) {
        throw new Error('Notification settings not configured');
      }

      const settings = JSON.parse(settingsStr);
      const template = settings.templates.find((t: any) => t.event === event);

      if (!template || !template.enabled) {
        return { success: false, message: 'Notification disabled for this event' };
      }

      // Get order details
      const { data: order, error: orderError } = await supabase
        .from('menu_orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) throw orderError;

      // Replace template variables with available order data
      let message = customMessage || template.message;
      message = message.replace(/\{\{order_id\}\}/g, order.id.slice(0, 8));
      message = message.replace(/\{\{total_amount\}\}/g, order.total_amount?.toString() || '0');
      message = message.replace(/\{\{customer_name\}\}/g, 'Customer');

      // Send notification (would call edge function in production)
      const notifications = [];

      // For now, just log what would be sent
      if (settings.channels.email && order.contact_phone) {
        notifications.push({
          type: 'email',
          to: 'customer@example.com',
          subject: template.subject,
          message
        });
      }

      if (settings.channels.sms && order.contact_phone) {
        notifications.push({
          type: 'sms',
          to: order.contact_phone,
          message
        });
      }

      // In production, this would call an edge function
      // await supabase.functions.invoke('send-notification', { body: notifications });

      logger.debug('Would send notifications:', { notifications });

      return { success: true, notifications };
    }
  });
};

export const useSendBulkNotification = () => {
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
      channel: 'email' | 'sms'
    }) => {
      // In production, this would call an edge function
      // await supabase.functions.invoke('send-bulk-notification', { 
      //   body: { recipients, message, subject, channel } 
      // });

      logger.debug('Would send bulk notifications:', {
        channel,
        count: recipients.length,
        message,
        subject
      });

      return { success: true, sent: recipients.length };
    }
  });
};
