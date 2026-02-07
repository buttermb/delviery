import { Clock, CheckCircle, Package, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TimelineEvent {
  label: string;
  timestamp: string | null;
  icon: 'clock' | 'check' | 'package' | 'navigation';
  completed: boolean;
}

interface DeliveryTimelineProps {
  events: TimelineEvent[];
}

export function DeliveryTimeline({ events }: DeliveryTimelineProps) {
  const getIcon = (iconType: TimelineEvent['icon']) => {
    const iconClass = "h-4 w-4";
    switch (iconType) {
      case 'clock': return <Clock className={iconClass} />;
      case 'check': return <CheckCircle className={iconClass} />;
      case 'package': return <Package className={iconClass} />;
      case 'navigation': return <Navigation className={iconClass} />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, index) => (
            event.timestamp && (
              <div key={index} className="flex items-start gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  event.completed 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {getIcon(event.icon)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{event.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(event.timestamp), 'MMM dd, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            )
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
