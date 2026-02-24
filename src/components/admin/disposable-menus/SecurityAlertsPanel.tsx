import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSecurityAlerts } from '@/hooks/useSecurityAlerts';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Shield,
  Info,
  MapPin,
  Clock,
  User,
  Eye,
  type LucideIcon
} from 'lucide-react';

const severityConfig = {
  critical: {
    color: 'bg-red-500/10 text-red-500 border-red-500/20',
    icon: AlertTriangle,
    label: 'Critical'
  },
  high: {
    color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    icon: AlertTriangle,
    label: 'High'
  },
  medium: {
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    icon: Shield,
    label: 'Medium'
  },
  low: {
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: Info,
    label: 'Low'
  }
};

const eventTypeIcons: Record<string, LucideIcon> = {
  failed_access_code: Shield,
  geofence_violation: MapPin,
  time_restriction: Clock,
  device_mismatch: User,
  excessive_views: Eye,
  suspicious_ip: AlertTriangle,
  screenshot_attempt: AlertTriangle
};

export const SecurityAlertsPanel = () => {
  const { alerts, unreadCount, markAsRead } = useSecurityAlerts();
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(a => a.severity === filter);

  return (
    <Card id="security-alerts">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Alerts
            </CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="rounded-full">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={markAsRead}>
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button 
            size="sm" 
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All ({alerts.length})
          </Button>
          <Button 
            size="sm" 
            variant={filter === 'critical' ? 'destructive' : 'outline'}
            onClick={() => setFilter('critical')}
          >
            Critical
          </Button>
          <Button 
            size="sm" 
            variant={filter === 'high' ? 'default' : 'outline'}
            onClick={() => setFilter('high')}
            className={filter === 'high' ? 'bg-orange-500 hover:bg-orange-600' : ''}
          >
            High
          </Button>
          <Button 
            size="sm" 
            variant={filter === 'medium' ? 'default' : 'outline'}
            onClick={() => setFilter('medium')}
            className={filter === 'medium' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
          >
            Medium
          </Button>
          <Button 
            size="sm" 
            variant={filter === 'low' ? 'default' : 'outline'}
            onClick={() => setFilter('low')}
            className={filter === 'low' ? 'bg-blue-500 hover:bg-blue-600' : ''}
          >
            Low
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No security alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map(alert => {
                const config = severityConfig[alert.severity];
                const EventIcon = eventTypeIcons[alert.event_type] || AlertTriangle;

                return (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-4 ${config.color}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3">
                        <EventIcon className="h-5 w-5 mt-0.5" />
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {alert.menu_name}
                            <Badge variant="outline" className={config.color}>
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm mt-1">{alert.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(alert.created_at), 'MMM dd, yyyy HH:mm:ss')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-current/10">
                        <div className="text-xs space-y-1 opacity-70">
                          {alert.metadata.ip_address && (
                            <div>IP: {String(alert.metadata.ip_address)}</div>
                          )}
                          {alert.metadata.location && (
                            <div>Location: {String(alert.metadata.location)}</div>
                          )}
                          {alert.metadata.customer_name && (
                            <div>Customer: {String(alert.metadata.customer_name)}</div>
                          )}
                          {alert.metadata.attempts && (
                            <div>Attempts: {String(alert.metadata.attempts)}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
