import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;
  event_data: Record<string, unknown>;
  menu?: { name: string };
  whitelist?: { customer_name: string };
  acknowledged: boolean;
}

interface SecurityEventsListProps {
  events: SecurityEvent[];
  onAcknowledge?: (eventId: string) => void;
}

export const SecurityEventsList = ({ events, onAcknowledge }: SecurityEventsListProps) => {
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const getEventIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'medium':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-destructive';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-muted';
    }
  };

  const formatEventType = (type: string) => {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleAcknowledge = async (eventId: string) => {
    setAcknowledging(eventId);
    try {
      await onAcknowledge?.(eventId);
    } finally {
      setAcknowledging(null);
    }
  };

  if (events.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <p className="text-muted-foreground">No security events detected</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <Card key={event.id} className="p-4">
          <div className="flex items-start gap-4">
            <div className="mt-1">{getEventIcon(event.severity)}</div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h4 className="font-semibold">{formatEventType(event.event_type)}</h4>
                  <p className="text-sm text-muted-foreground">
                    {event.menu?.name} • {event.whitelist?.customer_name || 'Unknown'}
                  </p>
                </div>
                <Badge className={getSeverityColor(event.severity)}>
                  {event.severity}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground mb-3">
                <Clock className="h-3 w-3 inline mr-1" />
                {format(new Date(event.created_at), 'MMM dd, yyyy HH:mm')}
              </div>

              {event.event_data && (
                <div className="bg-muted/50 p-2 rounded text-xs font-mono mb-3">
                  {JSON.stringify(event.event_data, null, 2)}
                </div>
              )}

              {!event.acknowledged && onAcknowledge && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAcknowledge(event.id)}
                  disabled={acknowledging === event.id}
                >
                  {acknowledging === event.id ? 'Acknowledging...' : 'Acknowledge'}
                </Button>
              )}

              {event.acknowledged && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  Acknowledged
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
