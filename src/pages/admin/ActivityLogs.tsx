import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Activity } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';

import { handleError } from '@/utils/errorHandling/handlers';

export default function ActivityLogs() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity-logs', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('activity_logs' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error) {
        if ((error as any)?.code === '42P01') return [];
        handleError(error, { component: 'ActivityLogs', toastTitle: 'Failed to load activity logs' });
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground">Track all system activities and user actions</p>
        </div>
        <EnhancedLoadingState variant="list" count={5} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity Logs</h1>
        <p className="text-muted-foreground">Track all system activities and user actions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest system activities</CardDescription>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <div className="space-y-4">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Activity className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{log.action || 'Unknown action'}</span>
                      <Badge variant="outline">{log.type || 'info'}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {log.description || 'No description'}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{log.user_email || 'System'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No activity logs available. Activity logging will appear here once the activity_logs table is created.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

