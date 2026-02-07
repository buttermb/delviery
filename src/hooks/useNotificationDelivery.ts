import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

type NotificationType = 'email' | 'sms' | 'push';
type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';

interface NotificationLog {
  id: string;
  tenant_id: string;
  notification_type: NotificationType;
  recipient: string;
  subject: string | null;
  message_preview: string | null;
  status: NotificationStatus;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  created_at: string;
}

interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
}

export function useNotificationDelivery() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Fetch notification logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['notification-logs', tenant?.id],
    queryFn: async (): Promise<NotificationLog[]> => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('notification_delivery_log')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as NotificationLog[];
    },
    enabled: !!tenant?.id,
  });

  // Calculate stats
  const stats: NotificationStats = {
    total: logs?.length || 0,
    sent: logs?.filter(l => l.status === 'sent').length || 0,
    delivered: logs?.filter(l => l.status === 'delivered').length || 0,
    failed: logs?.filter(l => l.status === 'failed').length || 0,
    pending: logs?.filter(l => l.status === 'pending').length || 0,
    deliveryRate: logs?.length 
      ? Math.round((logs.filter(l => l.status === 'delivered').length / logs.length) * 100) 
      : 0,
  };

  // Log a new notification
  const logNotification = useMutation({
    mutationFn: async (params: {
      type: NotificationType;
      recipient: string;
      subject?: string;
      messagePreview?: string;
      metadata?: Record<string, unknown>;
    }): Promise<string> => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .rpc('log_notification', {
          p_tenant_id: tenant.id,
          p_notification_type: params.type,
          p_recipient: params.recipient,
          p_subject: params.subject || null,
          p_message_preview: params.messagePreview || null,
          p_metadata: (params.metadata || {}) as unknown as Record<string, never>,
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-logs', tenant?.id] });
    },
  });

  // Update notification status
  const updateStatus = useMutation({
    mutationFn: async (params: {
      logId: string;
      status: NotificationStatus;
      errorMessage?: string;
    }): Promise<void> => {
      const { error } = await supabase
        .rpc('update_notification_status', {
          p_log_id: params.logId,
          p_status: params.status,
          p_error_message: params.errorMessage || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-logs', tenant?.id] });
    },
  });

  // Retry failed notification
  const retryNotification = useMutation({
    mutationFn: async (logId: string): Promise<void> => {
      const { error } = await supabase
        .from('notification_delivery_log')
        .update({ 
          status: 'pending',
          next_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', logId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-logs', tenant?.id] });
    },
  });

  return {
    logs: logs || [],
    stats,
    isLoading: logsLoading,
    logNotification: logNotification.mutateAsync,
    updateStatus: updateStatus.mutateAsync,
    retryNotification: retryNotification.mutateAsync,
  };
}
