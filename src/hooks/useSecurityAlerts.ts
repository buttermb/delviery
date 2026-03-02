import { logger } from '@/lib/logger';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useVerification } from '@/contexts/VerificationContext';

export interface SecurityAlert {
  id: string;
  menu_id: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  menu_name?: string;
}

export const useSecurityAlerts = () => {
  const { tenant, loading } = useTenantAdminAuth();
  const { isVerified, isVerifying } = useVerification();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Guard 1: Don't subscribe if auth is still loading or tenant not available
    if (loading || !tenant?.id) {
      logger.debug('[useSecurityAlerts] Waiting for authentication...', { loading, hasTenant: !!tenant?.id });
      return;
    }

    // Guard 2: Don't subscribe until verification is complete
    if (!isVerified || isVerifying) {
      logger.debug('[useSecurityAlerts] Waiting for verification to complete...', { isVerified, isVerifying });
      return;
    }

    logger.debug('[useSecurityAlerts] Authentication verified, establishing realtime subscription');
    // Fetch recent alerts filtered by tenant
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('menu_security_events')
        .select(`
          *,
          disposable_menus!inner(name, tenant_id)
        `)
        .eq('disposable_menus.tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        const formattedAlerts = data.map(event => ({
          id: event.id,
          menu_id: event.menu_id,
          event_type: event.event_type,
          severity: event.severity,
          description: `${event.event_type.replace(/_/g, ' ')} detected`,
          metadata: event.event_data || {},
          created_at: event.created_at,
          menu_name: event.disposable_menus?.name
        }));
        setAlerts(formattedAlerts);
        setUnreadCount(formattedAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length);
      }
    };

    fetchAlerts();

    // Subscribe to real-time security events
    const channel = supabase
      .channel(`security-alerts-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'menu_security_events'
        },
        async (payload) => {
          // Validate payload
          if (!payload.new || typeof payload.new !== 'object') {
            logger.error('Invalid realtime payload received');
            return;
          }

          const newEvent = payload.new as Record<string, unknown>;

          // Validate required fields
          const eventId = newEvent.id as string | undefined;
          const menuId = newEvent.menu_id as string | undefined;
          const eventType = newEvent.event_type as string | undefined;
          if (!eventId || !menuId || !eventType) {
            logger.error('Missing required fields in security event');
            return;
          }

          // Fetch menu name and verify tenant ownership
          const { data: menu } = await supabase
            .from('disposable_menus')
            .select('name, tenant_id')
            .eq('id', menuId)
            .maybeSingle();

          // Only show alerts for menus owned by this tenant
          if (!menu || menu.tenant_id !== tenant.id) {
            logger.debug('Ignoring security event from different tenant');
            return;
          }

          const alert: SecurityAlert = {
            id: eventId,
            menu_id: menuId,
            event_type: eventType,
            severity: (newEvent.severity as SecurityAlert['severity']) || 'low',
            description: `${eventType.replace(/_/g, ' ')} detected`,
            metadata: (newEvent.event_data as Record<string, unknown>) || {},
            created_at: newEvent.created_at as string,
            menu_name: menu?.name
          };

          setAlerts(prev => [alert, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);

          // Show toast for high/critical alerts
          if (alert.severity === 'high' || alert.severity === 'critical') {
            toast.error(`🚨 Security Alert: ${alert.menu_name}`, {
              description: alert.description,
              duration: 10000,
              action: {
                label: 'View',
                onClick: () => {
                  window.location.hash = 'security-alerts';
                }
              }
            });
          } else if (alert.severity === 'medium') {
            toast.warning(`⚠️ Security Notice: ${alert.menu_name}`, {
              description: alert.description,
              duration: 5000
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Successfully subscribed to security alerts channel');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Failed to subscribe to security alerts channel');
          toast.error('Security alerts subscription failed', {
            description: 'Real-time security alerts may not work properly'
          });
        } else if (status === 'TIMED_OUT') {
          logger.error('Security alerts subscription timed out');
          toast.warning('Security alerts connection timed out', {
            description: 'Attempting to reconnect...'
          });
        } else if (status === 'CLOSED') {
          logger.debug('Security alerts channel closed');
        }
      });

    return () => {
      logger.debug('[useSecurityAlerts] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [loading, tenant?.id, isVerified, isVerifying]);

  const markAsRead = () => {
    setUnreadCount(0);
  };

  return {
    alerts,
    unreadCount,
    markAsRead
  };
};
