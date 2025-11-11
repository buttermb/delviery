/**
 * Workflow Builder Component
 * Inspired by N8N - Visual workflow automation
 * Allows users to create automation workflows with triggers and actions
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Zap,
  Play,
  Pause,
  Trash2,
  Plus,
  Settings,
  ArrowRight,
  Circle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  nodes: WorkflowNode[];
  createdAt: string;
  updatedAt: string;
}

const TRIGGER_TYPES = [
  { value: 'order_created', label: 'Order Created', icon: '🛒' },
  { value: 'customer_registered', label: 'Customer Registered', icon: '👤' },
  { value: 'low_stock', label: 'Low Stock Alert', icon: '⚠️' },
  { value: 'payment_received', label: 'Payment Received', icon: '💰' },
  { value: 'schedule', label: 'Scheduled', icon: '⏰' },
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email', icon: '📧' },
  { value: 'send_sms', label: 'Send SMS', icon: '💬' },
  { value: 'create_task', label: 'Create Task', icon: '✅' },
  { value: 'update_inventory', label: 'Update Inventory', icon: '📦' },
  { value: 'webhook', label: 'Webhook', icon: '🔗' },
  { value: 'notify_team', label: 'Notify Team', icon: '🔔' },
];

export function WorkflowBuilder() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleCreateWorkflow = () => {
    const newWorkflow: Workflow = {
      id: `workflow-${Date.now()}`,
      name: 'New Workflow',
      enabled: false,
      nodes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setWorkflows([...workflows, newWorkflow]);
    setSelectedWorkflow(newWorkflow);
    setIsEditing(true);
  };

  const handleAddNode = (type: 'trigger' | 'action' | 'condition') => {
    if (!selectedWorkflow) return;

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      name: type === 'trigger' ? 'Select Trigger' : type === 'action' ? 'Select Action' : 'Condition',
      config: {},
      position: { x: 100, y: 100 + selectedWorkflow.nodes.length * 80 },
    };

    const updated = {
      ...selectedWorkflow,
      nodes: [...selectedWorkflow.nodes, newNode],
      updatedAt: new Date().toISOString(),
    };

    setSelectedWorkflow(updated);
    setWorkflows(workflows.map(w => w.id === updated.id ? updated : w));
  };

  const handleToggleWorkflow = (workflowId: string) => {
    setWorkflows(workflows.map(w => 
      w.id === workflowId ? { ...w, enabled: !w.enabled } : w
    ));
    toast({
      title: 'Workflow updated',
      description: 'Workflow status has been changed',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6" />
            Workflow Automation
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Create automated workflows to streamline your business processes
          </p>
        </div>
        <Button onClick={handleCreateWorkflow}>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {/* Workflows List */}
      {workflows.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-2">No workflows yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first automation workflow
              </p>
              <Button onClick={handleCreateWorkflow}>
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{workflow.name}</CardTitle>
                    {workflow.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {workflow.description}
                      </p>
                    )}
                  </div>
                  <Badge variant={workflow.enabled ? 'default' : 'secondary'}>
                    {workflow.enabled ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nodes:</span>
                    <span className="font-medium">{workflow.nodes.length}</span>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedWorkflow(workflow);
                        setIsEditing(true);
                      }}
                      className="flex-1"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleWorkflow(workflow.id)}
                    >
                      {workflow.enabled ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Workflow Editor */}
      {isEditing && selectedWorkflow && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Edit Workflow: {selectedWorkflow.name}</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedWorkflow(null);
                  }}
                >
                  Save & Close
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add Trigger */}
            <div>
              <h3 className="text-sm font-medium mb-3">Triggers</h3>
              <Select
                onValueChange={(value) => {
                  const trigger = TRIGGER_TYPES.find(t => t.value === value);
                  if (trigger) {
                    handleAddNode('trigger');
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Add trigger..." />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      {trigger.icon} {trigger.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Workflow Nodes Visual */}
            {selectedWorkflow.nodes.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Workflow Steps</h3>
                <div className="space-y-3">
                  {selectedWorkflow.nodes.map((node, index) => (
                    <div
                      key={node.id}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      <Circle className="h-3 w-3 fill-current" />
                      <div className="flex-1">
                        <div className="font-medium">{node.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {node.type}
                        </div>
                      </div>
                      {index < selectedWorkflow.nodes.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Actions */}
            {selectedWorkflow.nodes.some(n => n.type === 'trigger') && (
              <div>
                <h3 className="text-sm font-medium mb-3">Actions</h3>
                <Select
                  onValueChange={(value) => {
                    const action = ACTION_TYPES.find(a => a.value === value);
                    if (action) {
                      handleAddNode('action');
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Add action..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.icon} {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

