import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Eye, 
  ShoppingCart, 
  AlertTriangle, 
  Lock, 
  MapPin,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CustomerActivityTimelineProps {
  whitelistId: string;
  customerName: string;
}

export const CustomerActivityTimeline = ({ 
  whitelistId, 
  customerName 
}: CustomerActivityTimelineProps) => {
  // Fetch access logs for this customer
  const { data: accessLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['customer-access-logs', whitelistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_access_logs')
        .select('*')
        .eq('access_whitelist_id', whitelistId)
        .order('accessed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch orders for this customer
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', whitelistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_orders')
        .select('*')
        .eq('access_whitelist_id', whitelistId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch security events for this customer
  const { data: securityEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['customer-security-events', whitelistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_security_events')
        .select('*')
        .eq('access_whitelist_id', whitelistId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    }
  });

  // Combine and sort all activities
  const activities = [
    ...(accessLogs?.map(log => ({
      type: 'access',
      timestamp: log.accessed_at,
      data: log
    })) || []),
    ...(orders?.map(order => ({
      type: 'order',
      timestamp: order.created_at,
      data: order
    })) || []),
    ...(securityEvents?.map(event => ({
      type: 'security',
      timestamp: event.created_at,
      data: event
    })) || [])
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const isLoading = logsLoading || ordersLoading || eventsLoading;

  const getActivityIcon = (type: string, data: any) => {
    switch (type) {
      case 'access':
        return data.access_code_correct ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        );
      case 'order':
        return <ShoppingCart className="h-5 w-5 text-primary" />;
      case 'security':
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      default:
        return <Eye className="h-5 w-5" />;
    }
  };

  const getActivityDescription = (type: string, data: any) => {
    switch (type) {
      case 'access':
        return data.access_code_correct
          ? `Accessed menu successfully from ${data.location || 'unknown location'}`
          : `Failed access attempt - incorrect code`;
      case 'order':
        return `Placed order for $${parseFloat(String(data.total_amount || 0)).toFixed(2)}`;
      case 'security':
        return data.event_type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      default:
        return 'Activity';
    }
  };

  const getActivityColor = (type: string, data: any) => {
    if (type === 'access' && !data.access_code_correct) return 'border-red-600/50';
    if (type === 'security') return 'border-amber-600/50';
    return 'border-border';
  };

  // Calculate stats
  const totalViews = accessLogs?.length || 0;
  const successfulAccess = accessLogs?.filter(log => log.access_code_correct).length || 0;
  const totalOrders = orders?.length || 0;
  const totalSpent = orders?.reduce((sum, o) => sum + parseFloat(String(o.total_amount || 0)), 0) || 0;
  const securityIssues = securityEvents?.length || 0;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Views</p>
          </div>
          <p className="text-2xl font-bold">{totalViews}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-xs text-muted-foreground">Successful</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{successfulAccess}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <p className="text-xs text-muted-foreground">Orders</p>
          </div>
          <p className="text-2xl font-bold">{totalOrders}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">Total Spent</span>
          </div>
          <p className="text-2xl font-bold">${totalSpent.toFixed(0)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-xs text-muted-foreground">Security</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{securityIssues}</p>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Activity Timeline</h3>
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading activity...
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 p-4 border rounded-lg ${getActivityColor(activity.type, activity.data)}`}
                >
                  <div className="mt-0.5">
                    {getActivityIcon(activity.type, activity.data)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">
                        {getActivityDescription(activity.type, activity.data)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </span>
                      {activity.type === 'access' && (activity.data as any).ip_address && (
                        <span>IP: {(activity.data as any).ip_address}</span>
                      )}
                      {activity.type === 'access' && (activity.data as any).location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {(activity.data as any).location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>No activity recorded yet</p>
            </div>
          )}
        </ScrollArea>
      </Card>
    </div>
  );
};
