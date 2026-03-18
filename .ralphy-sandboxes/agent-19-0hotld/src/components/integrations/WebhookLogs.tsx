import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CheckCircle2, XCircle, Clock, ChevronDown, RefreshCw, Loader2, History } from 'lucide-react';
import { format } from 'date-fns/format';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { useState } from 'react';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { queryKeys } from '@/lib/queryKeys';

interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  duration_ms: number | null;
  status: 'pending' | 'success' | 'failed';
  created_at: string;
  completed_at: string | null;
}

interface WebhookLogsProps {
  webhookId?: string;
  limit?: number;
  showTitle?: boolean;
}

export function WebhookLogs({ webhookId, limit = 10, showTitle = true }: WebhookLogsProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const { data: logs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.webhooks.logs(tenantId, webhookId, limit),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        let query = supabase
          .from('webhook_logs')
          .select('id, webhook_id, event_type, payload, response_status, response_body, error_message, duration_ms, status, created_at, completed_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (webhookId) {
          query = query.eq('webhook_id', webhookId);
        }

        const { data, error } = await query;

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data ?? []) as WebhookLog[];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const toggleExpanded = (logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="border-green-600 text-green-600">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getHttpStatusBadge = (statusCode: number | null) => {
    if (!statusCode) return null;

    if (statusCode >= 200 && statusCode < 300) {
      return <Badge variant="outline" className="border-green-600 text-green-600">{statusCode}</Badge>;
    }
    if (statusCode >= 400 && statusCode < 500) {
      return <Badge variant="outline" className="border-yellow-600 text-yellow-600">{statusCode}</Badge>;
    }
    if (statusCode >= 500) {
      return <Badge variant="destructive">{statusCode}</Badge>;
    }
    return <Badge variant="outline">{statusCode}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          {showTitle && (
            <>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Webhook Logs
              </CardTitle>
              <CardDescription>Recent webhook delivery attempts</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading logs...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            {showTitle && (
              <>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Webhook Logs
                </CardTitle>
                <CardDescription>Recent webhook delivery attempts</CardDescription>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            {isRefetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs && logs.length > 0 ? (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {logs.map((log) => (
                <Collapsible
                  key={log.id}
                  open={expandedLogs.has(log.id)}
                  onOpenChange={() => toggleExpanded(log.id)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(log.status)}
                          <div className="text-left">
                            <div className="font-medium text-sm">{log.event_type}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getHttpStatusBadge(log.response_status)}
                          {getStatusBadge(log.status)}
                          {log.duration_ms && (
                            <span className="text-xs text-muted-foreground">
                              {log.duration_ms}ms
                            </span>
                          )}
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedLogs.has(log.id) ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-3 border-t pt-3">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Timestamp
                          </div>
                          <div className="text-sm">
                            {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm:ss a")}
                          </div>
                        </div>

                        {log.error_message && (
                          <div>
                            <div className="text-xs font-medium text-destructive mb-1">
                              Error
                            </div>
                            <div className="text-sm bg-destructive/10 p-2 rounded text-destructive">
                              {log.error_message}
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Payload
                          </div>
                          <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </div>

                        {log.response_body && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              Response
                            </div>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                              {log.response_body}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No webhook logs yet.</p>
            <p className="text-sm">Logs will appear here when webhooks are triggered.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
