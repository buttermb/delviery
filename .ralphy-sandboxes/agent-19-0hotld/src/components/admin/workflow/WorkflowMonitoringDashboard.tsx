/**
 * Workflow Execution Monitoring Dashboard
 * Real-time monitoring of workflow executions with metrics and logs
 */

import { useState } from 'react';
import { useWorkflowExecutions } from '@/hooks/useWorkflowExecutions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Search,
  RefreshCw,
  TrendingUp,
  Timer,
} from 'lucide-react';
import { formatSmartDate } from '@/lib/formatters';

interface ExecutionLog {
  status: 'success' | 'error';
  action_type: string;
  duration_ms?: number;
  error?: string;
  result?: Record<string, unknown>;
}

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  tenant_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  execution_log?: ExecutionLog[];
  error_message?: string;
  trigger_data?: Record<string, unknown>;
  workflow?: {
    name: string;
    description?: string;
  };
}

export function WorkflowMonitoringDashboard() {
  const { executions, metrics, isLoading, refetch } = useWorkflowExecutions(100, true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-warning" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'running':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const filteredExecutions = executions.filter((execution) => {
    const matchesSearch =
      !searchQuery ||
      execution.workflow?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      execution.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || execution.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{metrics.running} running</Badge>
              <Badge variant="outline">{metrics.queued} queued</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.successRate}%</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-success">
                {metrics.completed} completed
              </span>
              <span className="text-sm text-destructive">{metrics.failed} failed</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgDuration}ms</div>
            <p className="text-xs text-muted-foreground mt-2">
              Average execution time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-success">Completed</span>
                <span className="font-medium">{metrics.completed}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-destructive">Failed</span>
                <span className="font-medium">{metrics.failed}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Execution History</CardTitle>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by workflow name or ID..."
                aria-label="Search by workflow name or ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'running' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('running')}
              >
                Running
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
              >
                Completed
              </Button>
              <Button
                variant={statusFilter === 'failed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('failed')}
              >
                Failed
              </Button>
            </div>
          </div>

          {/* Execution List */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {filteredExecutions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No executions found
                </div>
              ) : (
                filteredExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedExecution(execution)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {getStatusIcon(execution.status)}
                      <div className="flex-1">
                        <p className="font-medium">
                          {execution.workflow?.name || 'Unknown Workflow'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatSmartDate(execution.started_at, { includeTime: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {execution.duration_ms && (
                        <span className="text-sm text-muted-foreground">
                          {execution.duration_ms}ms
                        </span>
                      )}
                      <Badge variant={getStatusBadgeVariant(execution.status)}>
                        {execution.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Execution Details Dialog */}
      <Dialog
        open={!!selectedExecution}
        onOpenChange={(open) => !open && setSelectedExecution(null)}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execution Details</DialogTitle>
          </DialogHeader>

          {selectedExecution && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Workflow
                  </p>
                  <p className="text-sm">
                    {selectedExecution.workflow?.name || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={getStatusBadgeVariant(selectedExecution.status)}>
                    {selectedExecution.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Started At
                  </p>
                  <p className="text-sm">
                    {formatSmartDate(selectedExecution.started_at, { includeTime: true })}
                  </p>
                </div>
                {selectedExecution.completed_at && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Completed At
                    </p>
                    <p className="text-sm">
                      {formatSmartDate(selectedExecution.completed_at, { includeTime: true })}
                    </p>
                  </div>
                )}
                {selectedExecution.duration_ms && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Duration
                    </p>
                    <p className="text-sm">{selectedExecution.duration_ms}ms</p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {selectedExecution.error_message && (
                <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-2">
                    Error
                  </p>
                  <p className="text-sm text-destructive">
                    {selectedExecution.error_message}
                  </p>
                </div>
              )}

              {/* Trigger Data */}
              {selectedExecution.trigger_data && (
                <div>
                  <p className="text-sm font-medium mb-2">Trigger Data</p>
                  <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedExecution.trigger_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Execution Log */}
              {selectedExecution.execution_log &&
                selectedExecution.execution_log.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Execution Log</p>
                    <div className="space-y-2">
                      {selectedExecution.execution_log.map(
                        (log: ExecutionLog, index: number) => (
                          <div
                            key={index}
                            className="p-3 border rounded-lg bg-background"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {log.status === 'success' ? (
                                  <CheckCircle className="w-4 h-4 text-success" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-destructive" />
                                )}
                                <span className="text-sm font-medium">
                                  {log.action_type}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {log.duration_ms}ms
                              </span>
                            </div>
                            {log.error && (
                              <p className="text-xs text-destructive">{log.error}</p>
                            )}
                            {log.result && (
                              <pre className="text-xs text-muted-foreground overflow-x-auto mt-2">
                                {JSON.stringify(log.result, null, 2)}
                              </pre>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
