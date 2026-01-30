/**
 * useSendOrderSMS Hook
 * Sends order status updates via Twilio SMS through the send-sms edge function
 */

import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface SendSMSParams {
  to: string;
  message: string;
  customerId?: string;
  accountId?: string;
}

interface SendSMSResponse {
  success: boolean;
  sid?: string;
  message?: string;
  error?: string;
}

export interface OrderForSMS {
  id: string;
  order_number?: string;
  status: string;
  total_amount?: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  user?: {
    full_name?: string | null;
    phone?: string | null;
  };
  contact_name?: string | null;
  contact_phone?: string | null;
}

/**
 * Get display name for an order
 */
export function getOrderCustomerName(order: OrderForSMS): string {
  return (
    order.customer_name ||
    order.contact_name ||
    order.user?.full_name ||
    'Customer'
  );
}

/**
 * Get phone number for an order
 */
export function getOrderPhoneNumber(order: OrderForSMS): string | null {
  return (
    order.customer_phone ||
    order.contact_phone ||
    order.user?.phone ||
    null
  );
}

/**
 * Order status display labels
 */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Being Prepared',
  ready: 'Ready for Pickup',
  in_transit: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/**
 * SMS Templates for order status updates
 */
export const ORDER_SMS_TEMPLATES = {
  status_update: (customerName: string, orderNumber: string, status: string) =>
    `Hi ${customerName}, your order #${orderNumber} is now ${ORDER_STATUS_LABELS[status] || status}. Thank you for your business!`,

  confirmed: (customerName: string, orderNumber: string) =>
    `Hi ${customerName}, great news! Your order #${orderNumber} has been confirmed and is being processed.`,

  preparing: (customerName: string, orderNumber: string) =>
    `Hi ${customerName}, your order #${orderNumber} is now being prepared. We'll let you know when it's ready!`,

  ready: (customerName: string, orderNumber: string) =>
    `Hi ${customerName}, your order #${orderNumber} is ready for pickup! Please come by at your earliest convenience.`,

  in_transit: (customerName: string, orderNumber: string) =>
    `Hi ${customerName}, your order #${orderNumber} is on its way! Your delivery driver is en route.`,

  delivered: (customerName: string, orderNumber: string) =>
    `Hi ${customerName}, your order #${orderNumber} has been delivered. Thank you for your business!`,

  cancelled: (customerName: string, orderNumber: string) =>
    `Hi ${customerName}, your order #${orderNumber} has been cancelled. If you have questions, please contact us.`,

  custom: (_customerName: string, _orderNumber: string) => '',
};

export type SMSTemplateKey = keyof typeof ORDER_SMS_TEMPLATES;

/**
 * Generate SMS message for order status
 */
export function generateOrderSMSMessage(
  order: OrderForSMS,
  templateKey: SMSTemplateKey = 'status_update'
): string {
  const customerName = getOrderCustomerName(order);
  const orderNumber = order.order_number || order.id.slice(0, 8);

  if (templateKey === 'status_update') {
    return ORDER_SMS_TEMPLATES.status_update(customerName, orderNumber, order.status);
  }

  const template = ORDER_SMS_TEMPLATES[templateKey];
  return template(customerName, orderNumber);
}

/**
 * Hook for sending SMS via the send-sms edge function
 */
export function useSendOrderSMS(options?: {
  onSuccess?: (data: SendSMSResponse) => void;
  onError?: (error: Error) => void;
}) {
  return useMutation({
    mutationFn: async (params: SendSMSParams): Promise<SendSMSResponse> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke<SendSMSResponse>('send-sms', {
        body: params,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) {
        logger.error('SMS send failed', error, { component: 'useSendOrderSMS' });
        throw new Error(error.message || 'Failed to send SMS');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to send SMS');
      }

      return data;
    },
    onSuccess: options?.onSuccess,
    onError: (error) => {
      logger.error('SMS mutation error', error instanceof Error ? error : new Error(String(error)), {
        component: 'useSendOrderSMS',
      });
      options?.onError?.(error instanceof Error ? error : new Error(String(error)));
    },
  });
}
