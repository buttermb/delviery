import { useClientActivity } from '@/hooks/crm/useActivityLog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import UserPlus from "lucide-react/dist/esm/icons/user-plus";
import Mail from "lucide-react/dist/esm/icons/mail";
import Users from "lucide-react/dist/esm/icons/users";
import Link2 from "lucide-react/dist/esm/icons/link-2";
import Unlink from "lucide-react/dist/esm/icons/unlink";
import Star from "lucide-react/dist/esm/icons/star";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { format } from 'date-fns';
import type { CRMActivityLog, CRMActivityType } from '@/types/crm';

interface ActivityTimelineProps {
  clientId?: string;
  activities?: CRMActivityLog[];
  className?: string;
}

// Helper to format metadata changes for display
function formatChanges(metadata: Record<string, unknown> | undefined): string[] {
  if (!metadata?.changes) return [];

  const changes = metadata.changes as Record<string, { old?: unknown; new?: unknown }>;
  const formatted: string[] = [];

  for (const [field, value] of Object.entries(changes)) {
    if (typeof value === 'object' && value !== null && 'old' in value && 'new' in value) {
      const fieldName = field.replace(/_/g, ' ');
      formatted.push(`${fieldName}: ${value.old ?? '(empty)'} → ${value.new ?? '(empty)'}`);
    }
  }

  return formatted;
}

export function ActivityTimeline({ clientId, activities: propActivities, className }: ActivityTimelineProps) {
  const { data: fetchedActivities, isLoading } = useClientActivity(clientId);

  const activities = propActivities || fetchedActivities;
  const loading = !propActivities && isLoading;

  const getActivityIcon = (type: CRMActivityType | string) => {
    switch (type) {
      case 'pre_order_created':
        return <FileText className="h-4 w-4" />;
      case 'invoice_created':
      case 'invoice_updated':
        return <Receipt className="h-4 w-4" />;
      case 'payment_marked':
      case 'payment_received':
        return <DollarSign className="h-4 w-4" />;
      case 'note_added':
      case 'message_sent':
        return <MessageSquare className="h-4 w-4" />;
      case 'invite_sent':
      case 'invite_accepted':
        return <Mail className="h-4 w-4" />;
      case 'client_created':
      case 'client_updated':
      case 'client_archived':
        return <UserPlus className="h-4 w-4" />;
      // Customer sync activity types
      case 'customer_created':
        return <Users className="h-4 w-4" />;
      case 'customer_updated':
        return <RefreshCw className="h-4 w-4" />;
      case 'customer_linked':
        return <Link2 className="h-4 w-4" />;
      case 'customer_unlinked':
        return <Unlink className="h-4 w-4" />;
      case 'loyalty_points_updated':
      case 'loyalty_tier_changed':
        return <Star className="h-4 w-4" />;
      case 'order_placed':
        return <ShoppingCart className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: CRMActivityType | string) => {
    switch (type) {
      case 'payment_marked':
      case 'payment_received':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'invoice_created':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'pre_order_created':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      // Customer sync colors
      case 'customer_created':
        return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'customer_updated':
        return 'bg-sky-100 text-sky-600 border-sky-200';
      case 'customer_linked':
        return 'bg-indigo-100 text-indigo-600 border-indigo-200';
      case 'customer_unlinked':
        return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'loyalty_points_updated':
      case 'loyalty_tier_changed':
        return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'order_placed':
        return 'bg-cyan-100 text-cyan-600 border-cyan-200';
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
          activities?.map((activity) => {
            const changes = formatChanges(activity.metadata);
            return (
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
                      {activity.client_name && !activity.client?.name && (
                        <p className="text-xs text-muted-foreground">Client: {activity.client_name}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {format(new Date(activity.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  {/* Show changes for customer_updated activities */}
                  {changes.length > 0 && (
                    <div className="mt-1 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      {changes.map((change, i) => (
                        <div key={i}>{change}</div>
                      ))}
                    </div>
                  )}
                  {activity.performed_by_name && (
                    <p className="text-xs text-muted-foreground">
                      by {activity.performed_by_name}
                    </p>
                  )}
                </div>
              </div>
            );
          })
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
