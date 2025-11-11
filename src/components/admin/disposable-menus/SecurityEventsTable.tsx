import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Eye, Shield, Clock, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  event_data: Record<string, unknown>;
  acknowledged: boolean;
  created_at: string;
  menu?: {
    name: string;
  };
}

interface SecurityEventsTableProps {
  events: SecurityEvent[];
  onRefresh?: () => void;
}

const severityConfig = {
  critical: { color: 'destructive', icon: AlertTriangle },
  high: { color: 'destructive', icon: AlertTriangle },
  medium: { color: 'default', icon: Shield },
  low: { color: 'secondary', icon: Eye },
};

const eventTypeLabels: Record<string, string> = {
  excessive_views: 'Excessive Views',
  failed_access_code: 'Failed Access Code',
  suspicious_ip: 'Suspicious IP',
  geofence_violation: 'Geofence Violation',
  screenshot_attempt: 'Screenshot Attempt',
  device_change: 'Device Change',
  panic_mode: 'Panic Mode',
  view_limit_exceeded: 'View Limit Exceeded',
};

export const SecurityEventsTable = ({ events, onRefresh }: SecurityEventsTableProps) => {
  const handleAcknowledge = async (eventId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      await supabase
        .from('menu_security_events')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userData.user?.id,
        })
        .eq('id', eventId);

      toast.success('Security event acknowledged');
      onRefresh?.();
    } catch (error) {
      toast.error('Failed to acknowledge event');
    }
  };

  if (events.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">No security events</p>
        <p className="text-sm text-muted-foreground mt-2">
          All systems operating normally
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Menu</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const config = severityConfig[event.severity];
            const Icon = config.icon;

            return (
              <TableRow key={event.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{eventTypeLabels[event.event_type] || event.event_type}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium">{event.menu?.name || 'Unknown'}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={config.color as 'default' | 'secondary' | 'destructive' | 'outline'}>
                    {event.severity.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </div>
                </TableCell>
                <TableCell>
                  {event.acknowledged ? (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Acknowledged
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {!event.acknowledged && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAcknowledge(event.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};