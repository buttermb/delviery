import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SecurityAlert {
  id: string;
  menu_id: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata: any;
  created_at: string;
  menu_name?: string;
}

export const useSecurityAlerts = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch recent alerts
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('menu_security_events')
        .select(`
          *,
          disposable_menus(name)
        `)
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
      .channel('security-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'menu_security_events'
        },
        async (payload) => {
          const newEvent = payload.new as any;
          
          // Fetch menu name
          const { data: menu } = await supabase
            .from('disposable_menus')
            .select('name')
            .eq('id', newEvent.menu_id)
            .single();

          const alert: SecurityAlert = {
            id: newEvent.id,
            menu_id: newEvent.menu_id,
            event_type: newEvent.event_type,
            severity: newEvent.severity,
            description: `${newEvent.event_type.replace(/_/g, ' ')} detected`,
            metadata: newEvent.event_data || {},
            created_at: newEvent.created_at,
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAsRead = () => {
    setUnreadCount(0);
  };

  return {
    alerts,
    unreadCount,
    markAsRead
  };
};
