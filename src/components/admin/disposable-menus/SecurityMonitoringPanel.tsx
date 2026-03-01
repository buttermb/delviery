import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useMenuSecurityEvents } from '@/hooks/useDisposableMenus';
import { format } from 'date-fns';
import { 
  Shield, 
  AlertTriangle, 
  Ban, 
  Eye, 
  MapPin, 
  Smartphone,
  Activity,
  Lock,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

import { jsonToString, jsonToStringOrNumber } from '@/utils/menuTypeHelpers';
import type { Json } from '@/integrations/supabase/types';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

export const SecurityMonitoringPanel = () => {
  const { tenant } = useTenantAdminAuth();

  interface BlockedIP {
    id: string;
    ip_address: string;
    reason?: string;
    [key: string]: unknown;
  }

  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [ipToUnblock, setIpToUnblock] = useState<BlockedIP | null>(null);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const { data: recentEvents, refetch } = useMenuSecurityEvents();

  // Real-time monitoring
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`security-monitoring-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'menu_security_events'
        },
        (payload) => {
          logger.debug('New security event received', { component: 'SecurityMonitoringPanel' });
          
          // Validate payload structure
          if (!payload?.new || typeof payload.new !== 'object') {
            logger.error('Invalid security event payload structure', new Error('Invalid payload'), { component: 'SecurityMonitoringPanel' });
            return;
          }

          const newEvent = payload.new as { event_type?: string; severity?: string; description?: string; [key: string]: unknown };
          
          // Show toast for critical events
          if (newEvent.severity === 'critical' || newEvent.severity === 'high') {
            toast.error("${newEvent.event_type || ");
          }
          
          refetch();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('Security monitoring subscribed successfully', { component: 'SecurityMonitoringPanel' });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('Security monitoring channel error', new Error('Channel error'), { component: 'SecurityMonitoringPanel' });
          toast.error("Failed to connect to security monitoring. Retrying...");
        } else if (status === 'TIMED_OUT') {
          logger.error('Security monitoring subscription timed out', new Error('Subscription timeout'), { component: 'SecurityMonitoringPanel' });
          toast.error("Security monitoring connection timed out");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, refetch]);

  // Load blocked IPs
  useEffect(() => {
    loadBlockedIPs();
  }, []);

  const loadBlockedIPs = async () => {
    const { data } = await supabase
      .from('blocked_ips')
      .select('id, ip_address, reason, created_at')
      .order('created_at', { ascending: false });
    
    if (data) setBlockedIPs(data);
  };

  const handleUnblockIP = async () => {
    if (!ipToUnblock) return;
    setIsUnblocking(true);
    const { error } = await supabase
      .from('blocked_ips')
      .delete()
      .eq('id', ipToUnblock.id);

    setIsUnblocking(false);

    if (error) {
      toast.error("Failed to unblock IP");
      return;
    }

    toast.success("IP address has been unblocked");

    setUnblockDialogOpen(false);
    setIpToUnblock(null);
    loadBlockedIPs();
  };

  const handleResolveEvent = async (eventId: string) => {
    const { error } = await supabase
      .from('menu_security_events')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', eventId);

    if (error) {
      toast.error("Failed to acknowledge event");
      return;
    }

    toast.success("Security event marked as acknowledged");

    refetch();
  };

  const criticalEvents = recentEvents?.filter(
    e => (e.severity === 'critical' || e.severity === 'high') && !e.acknowledged
  ).slice(0, 5) ?? [];

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('access')) return Eye;
    if (eventType.includes('geofence')) return MapPin;
    if (eventType.includes('device')) return Smartphone;
    if (eventType.includes('screenshot')) return Shield;
    return Lock;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500 animate-pulse" />
            Live Security Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <div className="text-sm text-muted-foreground">Total Events</div>
                <div className="text-2xl font-bold">{recentEvents?.length ?? 0}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <div className="text-sm text-muted-foreground">Active Threats</div>
                <div className="text-2xl font-bold">{criticalEvents.length}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Ban className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Blocked IPs</div>
                <div className="text-2xl font-bold">{blockedIPs.length}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-sm text-muted-foreground">Acknowledged</div>
                <div className="text-2xl font-bold">
                  {recentEvents?.filter(e => e.acknowledged).length ?? 0}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {criticalEvents.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{criticalEvents.length} Active Security Threats</strong> requiring immediate attention
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Security Events */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Security Events</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {!recentEvents || recentEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No security events detected</p>
                  </div>
                ) : (
                  recentEvents.map((event) => {
                    const Icon = getEventIcon(event.event_type);
                    return (
                      <div
                        key={event.id}
                        className={`p-3 rounded-lg border ${
                          event.acknowledged
                            ? 'bg-muted/30 border-muted'
                            : event.severity === 'critical' || event.severity === 'high'
                            ? 'bg-destructive/10 border-destructive/30'
                            : 'bg-muted/50 border-muted'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-1">
                              <p className="font-medium text-sm truncate">
                                {event.event_type.replace(/_/g, ' ').toUpperCase()}
                              </p>
                              <Badge variant={getSeverityColor(event.severity) as 'default' | 'secondary' | 'destructive' | 'outline'}>
                                {event.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {typeof event.event_data === 'object' && event.event_data && 'message' in event.event_data 
                                ? String(event.event_data.message)
                                : 'Security event detected'}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(event.created_at), 'MMM dd, HH:mm:ss')}
                              </span>
                              {!event.acknowledged && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleResolveEvent(event.id)}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Acknowledge
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Blocked IPs */}
        <Card>
          <CardHeader>
            <CardTitle>Blocked IP Addresses</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {blockedIPs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Ban className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>No blocked IPs</p>
                  </div>
                ) : (
                  blockedIPs.map((blocked) => (
                    <div
                      key={blocked.id}
                      className="p-3 rounded-lg bg-destructive/10 border border-destructive/30"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Ban className="h-4 w-4 text-destructive" />
                            <span className="font-mono text-sm font-medium">
                              {blocked.ip_address}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {jsonToString(blocked.reason) || 'Suspicious activity detected'}
                          </p>
                          <div className="text-xs text-muted-foreground">
                            Blocked {format(new Date(String(jsonToStringOrNumber(blocked.created_at as Json))), 'MMM dd, yyyy HH:mm')}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setIpToUnblock(blocked); setUnblockDialogOpen(true); }}
                        >
                          Unblock
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Unblock IP Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={unblockDialogOpen}
        onOpenChange={setUnblockDialogOpen}
        onConfirm={handleUnblockIP}
        title="Unblock IP address"
        description={ipToUnblock ? `Are you sure you want to unblock "${ipToUnblock.ip_address}"? This will allow traffic from this IP again.` : undefined}
        itemType="blocked IP"
        isLoading={isUnblocking}
      />
    </div>
  );
};
