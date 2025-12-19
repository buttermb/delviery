import { useClientActivity } from '@/hooks/crm/useActivityLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, Receipt, DollarSign, MessageSquare, UserPlus, Mail } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityTimelineProps {
  clientId?: string;
  activities?: any[];
  className?: string;
}

export function ActivityTimeline({ clientId, activities: propActivities, className }: ActivityTimelineProps) {
  const { data: fetchedActivities, isLoading } = useClientActivity(clientId);

  const activities = propActivities || fetchedActivities;
  const loading = !propActivities && isLoading;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'pre_order_created':
        return <FileText className="h-4 w-4" />;
      case 'invoice_created':
      case 'invoice_updated':
        return <Receipt className="h-4 w-4" />;
      case 'payment_marked':
        return <DollarSign className="h-4 w-4" />;
      case 'note_added':
      case 'message_sent':
        return <MessageSquare className="h-4 w-4" />;
      case 'invite_sent':
      case 'invite_accepted':
        return <Mail className="h-4 w-4" />;
      case 'client_created':
      case 'client_updated':
        return <UserPlus className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'payment_marked':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'invoice_created':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'pre_order_created':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const content = (
    <div className={className}>
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : activities?.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No activity recorded yet.</p>
        ) : (
          activities?.map((activity) => (
            <div key={activity.id} className="flex gap-4">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border ${getActivityColor(activity.activity_type)}`}>
                {getActivityIcon(activity.activity_type)}
              </div>
              <div className="flex flex-col gap-1 pb-6 border-b last:border-0 last:pb-0 w-full">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <p className="text-sm font-medium">{activity.description}</p>
                    {activity.client?.name && (
                      <p className="text-xs text-muted-foreground">Client: {activity.client.name}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {format(new Date(activity.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
                {activity.performed_by_name && (
                  <p className="text-xs text-muted-foreground">
                    by {activity.performed_by_name}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (propActivities) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
