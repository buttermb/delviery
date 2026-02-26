/**
 * Advanced Workflow Builder
 * Inspired by Activepieces and Windmill
 * Enhanced workflow automation with database integration
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { WorkflowCanvas } from './WorkflowCanvas';
import { WorkflowMonitoringDashboard } from './WorkflowMonitoringDashboard';
import { DeadLetterQueue } from './DeadLetterQueue';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { formatSmartDate } from '@/lib/formatters';
// Enhanced workflow types inspired by Activepieces/Windmill
interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  workflow?: {
    name: string;
  };
}

export function AdvancedWorkflowBuilder() {
  const { tenant } = useTenantAdminAuth();
  const [activeTab, setActiveTab] = useState('builder');
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant?.id) {
      loadExecutions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadExecutions is defined below, only run on tenant change
  }, [tenant?.id]);

  const loadExecutions = async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          workflow:workflow_definitions(name)
        `)
        .eq('tenant_id', tenant?.id)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setExecutions((data as WorkflowExecution[]) ?? []);
    } catch {
      toast.error("Error loading executions");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto max-w-3xl">
          <TabsTrigger value="builder">
            Workflow Builder
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="history">
            Execution History
          </TabsTrigger>
          <TabsTrigger value="dead-letter-queue">
            Dead Letter Queue
          </TabsTrigger>
        </TabsList>

        {/* Builder Tab */}
        <TabsContent value="builder">
          <WorkflowCanvas />
        </TabsContent>

        {/* Monitoring Tab */}
        <TabsContent value="monitoring">
          <WorkflowMonitoringDashboard />
        </TabsContent>

        {/* Execution History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : executions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No workflow executions yet
                </div>
              ) : (
                <div className="space-y-2">
                  {executions.map((execution) => (
                    <div
                      key={execution.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        {getStatusIcon(execution.status)}
                        <div>
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
                        <Badge
                          variant={
                            execution.status === 'completed'
                              ? 'default'
                              : execution.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {execution.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dead Letter Queue Tab */}
        <TabsContent value="dead-letter-queue">
          <DeadLetterQueue />
        </TabsContent>
      </Tabs>
    </div>
  );
}
