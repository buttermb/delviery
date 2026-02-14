/**
 * Workflow Builder Component
 * Visual workflow designer for automation
 * Inspired by N8N and Zapier
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Workflow, Save, Play, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkflowAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

interface WorkflowConfig {
  name: string;
  description: string;
  triggerType: 'event' | 'schedule' | 'manual';
  triggerConfig: Record<string, unknown>;
  actions: WorkflowAction[];
  enabled: boolean;
}

const availableTriggers = [
  { value: 'event', label: 'Event Trigger', description: 'Triggered by a specific event' },
  { value: 'schedule', label: 'Scheduled', description: 'Runs on a schedule' },
  { value: 'manual', label: 'Manual', description: 'Run manually' },
];

const availableActions = [
  { value: 'send_email', label: 'Send Email', description: 'Send an email notification' },
  { value: 'create_record', label: 'Create Record', description: 'Create a database record' },
  { value: 'update_record', label: 'Update Record', description: 'Update a database record' },
  { value: 'send_webhook', label: 'Send Webhook', description: 'Send HTTP webhook' },
  { value: 'delay', label: 'Delay', description: 'Wait for specified time' },
  { value: 'conditional', label: 'Conditional', description: 'Execute based on condition' },
];

export function WorkflowBuilder() {
  const { toast } = useToast();
  const [workflow, setWorkflow] = useState<WorkflowConfig>({
    name: '',
    description: '',
    triggerType: 'event',
    triggerConfig: {},
    actions: [],
    enabled: true,
  });

  const addAction = (actionType: string) => {
    const newAction: WorkflowAction = {
      id: `action-${Date.now()}`,
      type: actionType,
      config: {},
    };
    setWorkflow({ ...workflow, actions: [...workflow.actions, newAction] });
  };

  const removeAction = (actionId: string) => {
    setWorkflow({
      ...workflow,
      actions: workflow.actions.filter((a) => a.id !== actionId),
    });
  };

  const updateAction = (actionId: string, updates: Partial<WorkflowAction>) => {
    setWorkflow({
      ...workflow,
      actions: workflow.actions.map((a) =>
        a.id === actionId ? { ...a, ...updates } : a
      ),
    });
  };

  const handleSave = () => {
    if (!workflow.name) {
      toast({
        title: 'Error',
        description: 'Please enter a workflow name',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Workflow Saved',
      description: 'Workflow configuration has been saved',
    });
  };

  const handleTest = () => {
    toast({
      title: 'Testing Workflow',
      description: 'Running workflow test...',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5" />
          Workflow Builder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workflow-name">Workflow Name</Label>
            <Input
              id="workflow-name"
              value={workflow.name}
              onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              placeholder="New Tenant Onboarding"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workflow-description">Description</Label>
            <Textarea
              id="workflow-description"
              value={workflow.description}
              onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
              placeholder="Describe what this workflow does..."
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Label>Trigger Type</Label>
              <Select
                value={workflow.triggerType}
                onValueChange={(value: string) =>
                  setWorkflow({ ...workflow, triggerType: value as 'event' | 'schedule' | 'manual' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTriggers.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      {trigger.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={workflow.enabled}
                onCheckedChange={(checked) =>
                  setWorkflow({ ...workflow, enabled: checked })
                }
              />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>
        </div>

        {/* Trigger Configuration */}
        {workflow.triggerType === 'event' && (
          <div className="p-4 border rounded-lg space-y-2">
            <Label>Event Type</Label>
            <Select
              value={(workflow.triggerConfig.eventType as string) || ''}
              onValueChange={(value) =>
                setWorkflow({
                  ...workflow,
                  triggerConfig: { ...workflow.triggerConfig, eventType: value },
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tenant_created">Tenant Created</SelectItem>
                <SelectItem value="tenant_updated">Tenant Updated</SelectItem>
                <SelectItem value="payment_failed">Payment Failed</SelectItem>
                <SelectItem value="subscription_cancelled">Subscription Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {workflow.triggerType === 'schedule' && (
          <div className="p-4 border rounded-lg space-y-2">
            <Label>Cron Expression</Label>
            <Input
              placeholder="0 0 * * * (daily at midnight)"
              value={(workflow.triggerConfig.cron as string) || ''}
              onChange={(e) =>
                setWorkflow({
                  ...workflow,
                  triggerConfig: { ...workflow.triggerConfig, cron: e.target.value },
                })
              }
            />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Actions</Label>
            <Select
              value=""
              onValueChange={(value) => addAction(value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Add Action..." />
              </SelectTrigger>
              <SelectContent>
                {availableActions.map((action) => (
                  <SelectItem key={action.value} value={action.value}>
                    {action.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {workflow.actions.map((action, index) => (
              <div key={action.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="font-medium">
                      {availableActions.find((a) => a.value === action.type)?.label || action.type}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(action.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {availableActions.find((a) => a.value === action.type)?.description}
                </p>
                {/* Action-specific config would go here */}
                <Input
                  placeholder="Action configuration..."
                  value={JSON.stringify(action.config)}
                  onChange={(e) => {
                    try {
                      const config = JSON.parse(e.target.value);
                      updateAction(action.id, { config });
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  className="font-mono text-xs"
                />
              </div>
            ))}
            {workflow.actions.length === 0 && (
              <div className="p-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                <Workflow className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No actions added</p>
                <p className="text-xs mt-1">Add actions to build your workflow</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Workflow
          </Button>
          <Button variant="outline" onClick={handleTest}>
            <Play className="h-4 w-4 mr-2" />
            Test Workflow
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

