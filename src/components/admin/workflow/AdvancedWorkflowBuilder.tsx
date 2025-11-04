/**
 * Advanced Workflow Builder
 * Inspired by Activepieces and Windmill
 * Enhanced workflow automation with more features
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Workflow,
  Play,
  Pause,
  Settings,
  History,
  Zap,
  Plus,
  Code,
  Database,
  Webhook,
} from 'lucide-react';
import { WorkflowBuilder } from './WorkflowBuilder';

// Enhanced workflow types inspired by Activepieces/Windmill
interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  logs?: string[];
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'automation' | 'integration' | 'notification' | 'data';
  icon: string;
}

export function AdvancedWorkflowBuilder() {
  const [activeTab, setActiveTab] = useState('builder');
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);

  const templates: WorkflowTemplate[] = [
    {
      id: 'order-notification',
      name: 'Order Notification',
      description: 'Send email/SMS when new order is created',
      category: 'notification',
      icon: '📧',
    },
    {
      id: 'low-stock-alert',
      name: 'Low Stock Alert',
      description: 'Notify team when inventory is low',
      category: 'automation',
      icon: '⚠️',
    },
    {
      id: 'customer-onboarding',
      name: 'Customer Onboarding',
      description: 'Automated welcome sequence for new customers',
      category: 'automation',
      icon: '👋',
    },
    {
      id: 'payment-reconciliation',
      name: 'Payment Reconciliation',
      description: 'Sync payments with accounting system',
      category: 'integration',
      icon: '💰',
    },
    {
      id: 'data-export',
      name: 'Daily Data Export',
      description: 'Export daily reports to cloud storage',
      category: 'data',
      icon: '📊',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6" />
            Advanced Workflow Automation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Inspired by Activepieces & Windmill - Powerful workflow automation
          </p>
        </div>
        <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500">
          <Zap className="h-3 w-3 mr-1" />
          Enhanced
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="builder">
            <Workflow className="h-4 w-4 mr-2" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Code className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="executions">
            <History className="h-4 w-4 mr-2" />
            Executions
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Webhook className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Builder Tab */}
        <TabsContent value="builder">
          <WorkflowBuilder />
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{template.icon}</div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="outline" className="mt-2">
                          {template.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {template.description}
                  </p>
                  <Button size="sm" variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Executions Tab */}
        <TabsContent value="executions">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              {executions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No workflow executions yet</p>
                  <p className="text-sm mt-2">Executions will appear here after running workflows</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {executions.map((execution) => (
                    <div
                      key={execution.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
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
                        <div>
                          <p className="font-medium">Workflow #{execution.workflowId}</p>
                          <p className="text-sm text-muted-foreground">
                            Started: {new Date(execution.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {execution.duration && (
                        <div className="text-sm text-muted-foreground">
                          {execution.duration}ms
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'Supabase', icon: '🗄️', status: 'connected' },
              { name: 'Email (SMTP)', icon: '📧', status: 'available' },
              { name: 'SMS Gateway', icon: '💬', status: 'available' },
              { name: 'Webhook', icon: '🔗', status: 'available' },
              { name: 'Database', icon: <Database className="h-5 w-5" />, status: 'connected' },
              { name: 'API', icon: <Webhook className="h-5 w-5" />, status: 'available' },
            ].map((integration, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {typeof integration.icon === 'string' ? integration.icon : integration.icon}
                      </div>
                      <div>
                        <p className="font-medium">{integration.name}</p>
                        <Badge
                          variant={integration.status === 'connected' ? 'default' : 'outline'}
                          className="mt-1"
                        >
                          {integration.status}
                        </Badge>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

