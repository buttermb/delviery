import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, Eye, Lock, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SecurityEvent {
  id?: string;
  severity?: string;
  event_type?: string;
  description?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface AccessLog {
  ip_address?: string;
  violations?: unknown[];
  [key: string]: unknown;
}

interface EventsBySeverity {
  [key: string]: SecurityEvent[];
}

interface SuspiciousIP {
  ip: string;
  count: number;
}

interface SecurityHeatmapProps {
  securityEvents: SecurityEvent[];
  accessLogs: AccessLog[];
}

export const SecurityHeatmap = ({ securityEvents, accessLogs }: SecurityHeatmapProps) => {
  // Group events by severity
  const eventsBySeverity = securityEvents.reduce((acc: EventsBySeverity, event: SecurityEvent) => {
    const severity = event.severity || 'low';
    if (!acc[severity]) acc[severity] = [];
    acc[severity].push(event);
    return acc;
  }, {});

  const critical = eventsBySeverity.critical || [];
  const high = eventsBySeverity.high || [];
  const medium = eventsBySeverity.medium || [];
  const low = eventsBySeverity.low || [];

  // Failed access attempts
  const failedAttempts = securityEvents.filter(e => 
    e.event_type === 'failed_access_code' || 
    e.event_type === 'invalid_token'
  );

  // Geofence violations
  const geofenceViolations = securityEvents.filter(e => 
    e.event_type === 'geofence_violation'
  );

  // Screenshot attempts
  const screenshotAttempts = securityEvents.filter(e => 
    e.event_type === 'screenshot_attempt'
  );

  // New device accesses
  const newDevices = securityEvents.filter(e => 
    e.event_type === 'new_device_detected'
  );

  // Suspicious IPs (multiple failed attempts)
  const suspiciousIPs = accessLogs.reduce((acc: Record<string, number>, log: AccessLog) => {
    if (log.violations && Array.isArray(log.violations) && log.violations.length > 0) {
      const ip = log.ip_address || 'Unknown';
      acc[ip] = (acc[ip] || 0) + 1;
    }
    return acc;
  }, {});

  const suspiciousIPList: SuspiciousIP[] = Object.entries(suspiciousIPs)
    .map(([ip, count]) => ({ ip, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('geofence')) return MapPin;
    if (eventType.includes('screenshot')) return Eye;
    if (eventType.includes('device')) return Shield;
    return Lock;
  };

  return (
    <div className="space-y-6">
      {/* Severity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-red-600/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Critical</p>
              <p className="text-3xl font-bold text-red-600">{critical.length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-4 border-warning/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">High</p>
              <p className="text-3xl font-bold text-warning">{high.length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-warning" />
          </div>
        </Card>

        <Card className="p-4 border-yellow-600/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Medium</p>
              <p className="text-3xl font-bold text-yellow-600">{medium.length}</p>
            </div>
            <Shield className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-4 border-muted">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Low</p>
              <p className="text-3xl font-bold">{low.length}</p>
            </div>
            <Shield className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
      </div>

      {/* Event Type Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">Failed Access</p>
          </div>
          <p className="text-2xl font-bold">{failedAttempts.length}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">Geofence Violations</p>
          </div>
          <p className="text-2xl font-bold">{geofenceViolations.length}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">Screenshot Attempts</p>
          </div>
          <p className="text-2xl font-bold">{screenshotAttempts.length}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">New Devices</p>
          </div>
          <p className="text-2xl font-bold">{newDevices.length}</p>
        </Card>
      </div>

      {/* Recent Security Events */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Recent Security Events</h3>
        <div className="space-y-3">
          {securityEvents.slice(0, 10).map((event: SecurityEvent) => {
            const Icon = getEventIcon(event.event_type);
            return (
              <div key={event.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-medium">
                      {event.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </p>
                    <Badge variant={getSeverityColor(event.severity)}>
                      {event.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {event.description || 'Security event detected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
          {securityEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No security events detected</p>
            </div>
          )}
        </div>
      </Card>

      {/* Suspicious IPs */}
      {suspiciousIPList.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Suspicious IP Addresses</h3>
          <div className="space-y-2">
            {suspiciousIPList.map((item: SuspiciousIP) => (
              <div key={item.ip} className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-mono text-sm font-medium">{item.ip}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} failed attempts
                    </p>
                  </div>
                </div>
                <Badge variant="destructive">Block</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
