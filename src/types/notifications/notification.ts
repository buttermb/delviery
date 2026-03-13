import type { Database } from '@/integrations/supabase/types';

export type NotificationLog = Database['public']['Tables']['notifications_log']['Row'];
export type NotificationDeliveryLog = Database['public']['Tables']['notification_delivery_log']['Row'];
export type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row'];
export type NotificationTemplate = Database['public']['Tables']['notification_templates']['Row'];

export type NotificationType =
  | 'order_status_change'
  | 'low_stock_alert'
  | 'delivery_alert'
  | 'payment_received'
  | 'driver_status_change'
  | 'expiring_menu'
  | 'new_customer_signup'
  | 'system_maintenance'
  | 'invoice_overdue'
  | 'team_member_mention';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface NotificationWithActions extends NotificationDeliveryLog {
  actionType?: 'view_order' | 'assign_driver' | 'approve' | 'view_delivery' | 'view_invoice';
  actionData?: Record<string, unknown>;
}

export interface NotificationBadgeCounts {
  orders: number;
  deliveries: number;
  invoices: number;
  total: number;
}
