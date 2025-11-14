/**
 * Super Admin Layout Component
 * Main layout wrapper for super admin panel with horizontal navigation
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { TopNav } from '@/components/super-admin/navigation/TopNav';
import { CommandPalette } from '@/components/super-admin/CommandPalette';
import { NotificationsPanel } from '@/components/super-admin/NotificationsPanel';
import { ImpersonationBanner } from '@/components/super-admin/ImpersonationBanner';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { cn } from '@/lib/utils';

export function SuperAdminLayout() {
  const { superAdmin } = useSuperAdminAuth();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  // Check if impersonating (would come from context or localStorage)
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedTenant, setImpersonatedTenant] = useState<{ name: string; startTime: Date } | null>(null);

  // Fetch at-risk tenants count
  const { data: atRiskCount = 0 } = useQuery({
    queryKey: ['super-admin-at-risk-count'],
    queryFn: async () => {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, subscription_status, mrr, created_at, last_activity_at');

      if (!tenants) return 0;

      // Calculate health scores and count at-risk (score < 50)
      const atRisk = tenants.filter((tenant) => {
        // Simple health score calculation
        const daysSinceCreated = Math.floor(
          (Date.now() - new Date(tenant.created_at || 0).getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysSinceActivity = tenant.last_activity_at
          ? Math.floor(
              (Date.now() - new Date(tenant.last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
            )
          : daysSinceCreated;

        // Health factors
        let score = 100;
        if (tenant.subscription_status === 'past_due') score -= 30;
        if (tenant.subscription_status === 'suspended') score -= 50;
        if (daysSinceActivity > 30) score -= 20;
        if (daysSinceActivity > 60) score -= 20;
        if ((tenant.mrr as number) === 0) score -= 10;

        return score < 50;
      });

      return atRisk.length;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Track read notifications in state
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());

  // Fetch notifications from audit_logs (urgent actions)
  const { data: notifications = [] } = useQuery({
    queryKey: ['super-admin-notifications'],
    queryFn: async () => {
      const { data: logs, error } = await supabase
        .from('audit_logs')
        .select('id, action, resource_type, tenant_id, timestamp, actor_type')
        .in('action', ['tenant_suspended', 'tenant_cancelled', 'payment_failed', 'security_alert'])
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error || !logs) return [];

      return logs.map((log) => ({
        id: log.id,
        type: log.action === 'tenant_suspended' || log.action === 'security_alert' 
          ? 'urgent' as const
          : log.action === 'payment_failed'
          ? 'warning' as const
          : 'info' as const,
        title: log.action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        message: `${log.action} on ${log.resource_type || 'resource'}`,
        timestamp: log.timestamp || new Date().toISOString(),
        read: readNotificationIds.has(log.id),
        tenantId: log.tenant_id,
      }));
    },
    refetchInterval: 30000,
  });

  const unreadNotifications = notifications.filter((n: { read: boolean }) => !n.read).length;

  // Mark notification as read
  const handleMarkRead = (id: string) => {
    setReadNotificationIds((prev) => new Set([...prev, id]));
  };

  // Mark all notifications as read
  const handleMarkAllRead = () => {
    const allIds = notifications.map((n: { id: string }) => n.id);
    setReadNotificationIds((prev) => new Set([...prev, ...allIds]));
  };

  // Handle notification action (navigate to relevant page)
  const handleNotificationAction = (notification: { tenantId?: string; type: string }) => {
    if (notification.tenantId) {
      window.location.href = `/super-admin/tenants/${notification.tenantId}`;
    } else if (notification.type === 'urgent') {
      window.location.href = '/super-admin/security';
    } else {
      window.location.href = '/super-admin/dashboard';
    }
  };

  // Fetch security alerts count from audit logs
  const { data: securityAlerts = 0 } = useQuery({
    queryKey: ['super-admin-security-alerts'],
    queryFn: async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .in('action', ['security_alert', 'unauthorized_access', 'suspicious_activity'])
        .gte('timestamp', oneDayAgo);

      return count || 0;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch system status from system_metrics
  const { data: systemStatus = 'healthy' } = useQuery({
    queryKey: ['super-admin-system-status'],
    queryFn: async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: metrics } = await supabase
        .from('system_metrics')
        .select('metric_type, value')
        .gte('timestamp', oneHourAgo)
        .in('metric_type', ['api_latency', 'error_rate', 'database_connections']);

      if (!metrics || metrics.length === 0) return 'healthy';

      // Check if any critical thresholds exceeded
      const hasCritical = metrics.some((m) => {
        const value = Number(m.value);
        if (m.metric_type === 'api_latency' && value > 500) return true;
        if (m.metric_type === 'error_rate' && value > 5) return true;
        if (m.metric_type === 'database_connections' && value > 95) return true;
        return false;
      });

      const hasWarning = metrics.some((m) => {
        const value = Number(m.value);
        if (m.metric_type === 'api_latency' && value > 200) return true;
        if (m.metric_type === 'error_rate' && value > 1) return true;
        if (m.metric_type === 'database_connections' && value > 80) return true;
        return false;
      });

      if (hasCritical) return 'critical';
      if (hasWarning) return 'warning';
      return 'healthy';
    },
    refetchInterval: 30000,
  });

  // Keyboard shortcuts
  useKeyboardShortcuts(() => setCommandPaletteOpen(true));

  if (!superAdmin) {
    return null; // Will be handled by protected route
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <TopNav
        onCommandPaletteOpen={() => setCommandPaletteOpen(true)}
        onNotificationsOpen={() => setNotificationsOpen(true)}
        unreadNotifications={unreadNotifications}
        atRiskCount={atRiskCount}
        securityAlerts={securityAlerts}
        systemStatus={systemStatus}
      />

      {/* Impersonation Banner */}
      {isImpersonating && impersonatedTenant && (
        <ImpersonationBanner
          tenantName={impersonatedTenant.name}
          sessionStartTime={impersonatedTenant.startTime}
          onStop={() => {
            setIsImpersonating(false);
            setImpersonatedTenant(null);
            // Clear impersonation from localStorage
            try {
              localStorage.removeItem('impersonating_tenant_id');
              localStorage.removeItem('impersonating_tenant_name');
              localStorage.removeItem('impersonation_start_time');
            } catch (e) {
              // Ignore localStorage errors
            }
            // Redirect to dashboard
            window.location.href = '/super-admin/dashboard';
          }}
          onOpenInNewTab={() => {
            const tenantId = localStorage.getItem('impersonating_tenant_id');
            if (tenantId) {
              window.open(`/super-admin/tenants/${tenantId}`, '_blank');
            }
          }}
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          isImpersonating ? 'pt-28' : 'pt-16', // Extra offset if impersonation banner is shown
          'min-h-[calc(100vh-4rem)]',
          'px-4 md:px-6'
        )}
      >
        <Outlet />
      </main>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      {/* Notifications Panel */}
      {notificationsOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-end p-4"
          onClick={() => setNotificationsOpen(false)}
        >
          <NotificationsPanel
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            onAction={handleNotificationAction}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

