import { logger } from '@/lib/logger';
/**
 * Workflow Canvas - Visual workflow builder with drag & drop
 * Database-connected workflow automation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Play,
  Save,
  Plus,
  Trash2,
  Settings,
  Zap,
  Database,
  Webhook as WebhookIcon,
  Clock,
  ArrowRight,
  Blocks,
  Layout,
  History,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { VisualWorkflowEditor } from './VisualWorkflowEditor';
import { NodePalette } from './NodePalette';
import { WorkflowVersionHistory } from './WorkflowVersionHistory';
import { useWorkflowVersionStats } from '@/hooks/useWorkflowVersions';
import { Node, Edge } from 'reactflow';

interface WorkflowAction {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

interface Workflow {
  id?: string;
  name: string;
  description: string;
  trigger_type: 'database_event' | 'schedule' | 'webhook' | 'manual';
  trigger_config: Record<string, unknown>;
  actions: WorkflowAction[];
  is_active: boolean;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
}

export function WorkflowCanvas() {
  const { tenant } = useTenantAdminAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [actionTemplates, setActionTemplates] = useState<Array<{ name: string; category?: string; [key: string]: unknown }>>([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [configuringAction, setConfiguringAction] = useState<WorkflowAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [viewMode, setViewMode] = useState<'visual' | 'form'>('visual');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const versionStats = useWorkflowVersionStats(selectedWorkflow?.id || null);

  useEffect(() => {
    if (tenant?.id) {
      loadWorkflows();
      loadTemplates();
      loadActionTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load functions are defined below, only run on tenant change
  }, [tenant?.id]);

  const loadWorkflows = async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_definitions')
        .select('*')
        .eq('tenant_id', tenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkflows((data as unknown as Workflow[]) ?? []);
    } catch (error: unknown) {
      toast.error("Error loading workflows", { description: humanizeError(error) });
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_definitions')
        .select('*')
        .eq('tenant_id', tenant?.id)
        .eq('is_active', false)
        .in('name', [
          'Auto-Assign Courier on New Order',
          'Low Inventory Alert',
          'Order Status Update Notification'
        ]);

      if (error) throw error;
      // Parse Json fields to WorkflowAction[]
      const parsedTemplates = (data ?? []).map((w: { actions: unknown; trigger_config: unknown }) => ({
        ...w,
        actions: Array.isArray(w.actions) ? w.actions : (typeof w.actions === 'object' && w.actions !== null ? Object.values(w.actions) : []) as WorkflowAction[],
        trigger_config: typeof w.trigger_config === 'object' && w.trigger_config !== null ? w.trigger_config : {} as Record<string, unknown>,
      })) as Workflow[];
      setTemplates(parsedTemplates);
    } catch (error: unknown) {
      logger.error('Error loading templates', error, { component: 'WorkflowCanvas' });
    }
  };

  const loadActionTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_action_templates')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setActionTemplates(data ?? []);
    } catch (error: unknown) {
      logger.error('Error loading action templates', error, { component: 'WorkflowCanvas' });
    }
  };

  const handleCloneTemplate = (template: Workflow) => {
    const cloned: Workflow = {
      ...template,
      id: undefined,
      name: `${template.name} (Copy)`,
      is_active: false,
    };
    setSelectedWorkflow(cloned);
    setShowTemplates(false);
  };

  const handleCreateWorkflow = () => {
    const newWorkflow: Workflow = {
      name: 'New Workflow',
      description: '',
      trigger_type: 'manual',
      trigger_config: {},
      actions: [],
      is_active: false,
    };
    setSelectedWorkflow(newWorkflow);
  };

  const handleSaveWorkflow = async () => {
    if (!selectedWorkflow || !tenant?.id) return;

    try {
      const workflowData = {
        ...selectedWorkflow,
        tenant_id: tenant.id,
        actions: selectedWorkflow.actions,
        trigger_config: selectedWorkflow.trigger_config,
      } as Record<string, unknown>;

      if (selectedWorkflow.id) {
        // Update existing
        const { error } = await supabase
          .from('workflow_definitions')
          .update(workflowData)
          .eq('id', selectedWorkflow.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('workflow_definitions')
          .insert([workflowData])
          .select()
          .maybeSingle();

        if (error) throw error;
        setSelectedWorkflow(data as unknown as Workflow);
      }

      // If trigger is database_event, create trigger record
      if (selectedWorkflow.trigger_type === 'database_event' && selectedWorkflow.id) {
        await supabase
          .from('workflow_triggers')
          .upsert({
            workflow_id: selectedWorkflow.id,
            tenant_id: tenant.id,
            event_type: selectedWorkflow.trigger_config.event_type || 'INSERT',
            table_name: selectedWorkflow.trigger_config.table_name || 'orders',
            conditions: selectedWorkflow.trigger_config.conditions || {},
          });
      }

      toast.success("Your workflow has been saved successfully");

      loadWorkflows();
    } catch (error: unknown) {
      toast.error("Error saving workflow", { description: humanizeError(error) });
    }
  };

  const handleAddAction = (template: { name: string; [key: string]: unknown }) => {
    if (!selectedWorkflow) return;

    const newAction: WorkflowAction = {
      id: crypto.randomUUID(),
      type: template.name,
      config: {},
    };

    setSelectedWorkflow({
      ...selectedWorkflow,
      actions: [...selectedWorkflow.actions, newAction],
    });
  };

  const handleConfigureAction = (action: WorkflowAction) => {
    setConfiguringAction(action);
    setIsConfiguring(true);
  };

  const handleSaveActionConfig = () => {
    if (!selectedWorkflow || !configuringAction) return;

    setSelectedWorkflow({
      ...selectedWorkflow,
      actions: selectedWorkflow.actions.map(a =>
        a.id === configuringAction.id ? configuringAction : a
      ),
    });

    setIsConfiguring(false);
    setConfiguringAction(null);
  };

  const handleDeleteAction = (actionId: string) => {
    if (!selectedWorkflow) return;

    setSelectedWorkflow({
      ...selectedWorkflow,
      actions: selectedWorkflow.actions.filter(a => a.id !== actionId),
    });
  };

  const handleTestWorkflow = async () => {
    if (!selectedWorkflow?.id) {
      toast.error("Please save the workflow before testing");
      return;
    }

    try {
      // Create a test execution
      const { data: execution, error } = await supabase
        .from('workflow_executions')
        .insert({
          workflow_id: selectedWorkflow.id,
          tenant_id: tenant?.id,
          status: 'queued',
          trigger_data: { test: true, timestamp: new Date().toISOString() },
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      // Call workflow executor
      const { data: result, error: execError } = await supabase.functions.invoke(
        'workflow-executor',
        { body: { execution_id: execution.id } }
      );

      if (execError) throw execError;

      // Check for error in response body (some edge functions return 200 with error)
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        const errorMessage = typeof result.error === 'string' ? result.error : 'Workflow execution failed';
        throw new Error(errorMessage);
      }

      toast.success("Status: ${result?.status || ");
    } catch (error: unknown) {
      toast.error("Execution failed", { description: humanizeError(error) });
    }
  };

  const handleVisualWorkflowSave = useCallback(async (nodes: Node[], _edges: Edge[]) => {
    if (!selectedWorkflow) return;

    try {
      // Convert nodes and edges back to workflow actions
      const actions = nodes
        .filter(node => node.type === 'action')
        .sort((a, b) => a.position.y - b.position.y) // Sort by Y position for correct order
        .map((node) => ({
          id: node.id,
          name: node.data.label || 'Untitled Action',
          type: node.data.actionType,
          config: node.data.config || {},
        }));

      const updatedWorkflow = {
        ...selectedWorkflow,
        actions,
      };

      setSelectedWorkflow(updatedWorkflow);

      toast.success("Click Save to persist changes to database");
    } catch (error: unknown) {
      toast.error("Update failed", { description: humanizeError(error) });
    }
  }, [selectedWorkflow]);

  const handleNodeDragStart = (event: React.DragEvent, nodeType: string, config: Record<string, unknown>) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ 
      type: nodeType, 
      label: config.label || nodeType.replace('_', ' '),
      ...config 
    }));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading workflows...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Workflow Automation</h2>
          <p className="text-muted-foreground">
            Automate tasks with visual workflow builder
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTemplates(!showTemplates)}>
            Templates
          </Button>
          <Button onClick={handleCreateWorkflow}>
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Templates Panel */}
      {showTemplates && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="cursor-pointer hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={() => handleCloneTemplate(template)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCloneTemplate(template); } }}>
                  <CardHeader>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {template.description}
                    </p>
                    <Badge>{template.trigger_type}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version History */}
      {showVersionHistory && selectedWorkflow?.id && (
        <WorkflowVersionHistory
          workflowId={selectedWorkflow.id}
          workflowName={selectedWorkflow.name}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflow List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Workflows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                  selectedWorkflow?.id === workflow.id ? 'bg-accent' : ''
                }`}
                onClick={() => setSelectedWorkflow(workflow)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{workflow.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {workflow.actions.length} actions
                    </p>
                  </div>
                  <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                    {workflow.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Workflow Canvas */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedWorkflow?.name || 'Select a workflow'}
              </CardTitle>
              {selectedWorkflow && (
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'visual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('visual')}
                  >
                    <Blocks className="w-4 h-4 mr-2" />
                    Visual
                  </Button>
                  <Button
                    variant={viewMode === 'form' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('form')}
                  >
                    <Layout className="w-4 h-4 mr-2" />
                    Form
                  </Button>
                  {selectedWorkflow.id && versionStats.totalVersions > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowVersionHistory(!showVersionHistory)}
                    >
                      <History className="w-4 h-4 mr-2" />
                      Versions ({versionStats.totalVersions})
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleTestWorkflow}>
                    <Play className="w-4 h-4 mr-2" />
                    Test
                  </Button>
                  <Button size="sm" onClick={handleSaveWorkflow}>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedWorkflow ? (
              viewMode === 'visual' ? (
                <div className="flex gap-4" ref={reactFlowWrapper}>
                  <NodePalette onNodeDragStart={handleNodeDragStart} />
                  <div className="flex-1">
                    <VisualWorkflowEditor
                      workflow={selectedWorkflow as unknown as Parameters<typeof VisualWorkflowEditor>[0]['workflow']}
                      onSave={handleVisualWorkflowSave}
                    />
                  </div>
                </div>
              ) : (
              <div className="space-y-6">
                {/* Workflow Settings */}
                <div className="space-y-4">
                  <div>
                    <Label>Workflow Name</Label>
                    <Input
                      value={selectedWorkflow.name}
                      onChange={(e) =>
                        setSelectedWorkflow({
                          ...selectedWorkflow,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={selectedWorkflow.description}
                      onChange={(e) =>
                        setSelectedWorkflow({
                          ...selectedWorkflow,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Trigger Type</Label>
                    <Select
                      value={selectedWorkflow.trigger_type}
                      onValueChange={(value: 'database_event' | 'schedule' | 'webhook' | 'manual') =>
                        setSelectedWorkflow({
                          ...selectedWorkflow,
                          trigger_type: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trigger type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="database_event">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            Database Event
                          </div>
                        </SelectItem>
                        <SelectItem value="schedule">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Schedule
                          </div>
                        </SelectItem>
                        <SelectItem value="webhook">
                          <div className="flex items-center gap-2">
                            <WebhookIcon className="w-4 h-4" />
                            Webhook
                          </div>
                        </SelectItem>
                        <SelectItem value="manual">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            Manual
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Trigger Configuration */}
                  {selectedWorkflow.trigger_type === 'database_event' && (
                    <div className="space-y-2">
                      <Label>Table Name</Label>
                      <Select
                        value={selectedWorkflow.trigger_config.table_name as string}
                        onValueChange={(value) =>
                          setSelectedWorkflow({
                            ...selectedWorkflow,
                            trigger_config: {
                              ...selectedWorkflow.trigger_config,
                              table_name: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select table" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="orders">orders</SelectItem>
                          <SelectItem value="wholesale_orders">wholesale_orders</SelectItem>
                          <SelectItem value="inventory">inventory</SelectItem>
                          <SelectItem value="products">products</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Label>Event Type</Label>
                      <Select
                        value={selectedWorkflow.trigger_config.event_type as string}
                        onValueChange={(value) =>
                          setSelectedWorkflow({
                            ...selectedWorkflow,
                            trigger_config: {
                              ...selectedWorkflow.trigger_config,
                              event_type: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INSERT">Insert (New Record)</SelectItem>
                          <SelectItem value="UPDATE">Update</SelectItem>
                          <SelectItem value="DELETE">Delete</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">Actions</Label>
                  </div>

                  {/* Action List */}
                  {selectedWorkflow.actions.map((action, index) => (
                    <div key={action.id} className="flex items-center gap-2">
                      {index > 0 && (
                        <div className="flex flex-col items-center">
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <Card className="flex-1">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{action.type}</p>
                              <p className="text-xs text-muted-foreground">
                                {Object.keys(action.config).length} config items
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfigureAction(action)}
                              >
                                <Settings className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteAction(action.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}

                  {/* Add Action Button */}
                  <div className="grid grid-cols-2 gap-2">
                    {actionTemplates.slice(0, 6).map((template, index) => (
                      <Button
                        key={(template.id as string) || index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddAction(template)}
                      >
                        <span className="mr-2">{template.icon as React.ReactNode}</span>
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              )
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Select a workflow to edit or create a new one
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Configuration Dialog */}
      <Dialog open={isConfiguring} onOpenChange={setIsConfiguring}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Action: {configuringAction?.type}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {configuringAction && (
              <>
                {Object.keys(configuringAction.config).length === 0 && (
                  <div className="space-y-2">
                    <Label>Configuration (JSON)</Label>
                    <Textarea
                      placeholder='{"key": "value"}'
                      value={JSON.stringify(configuringAction.config, null, 2)}
                      onChange={(e) => {
                        try {
                          const config = JSON.parse(e.target.value);
                          setConfiguringAction({ ...configuringAction, config });
                        } catch {
                          // Invalid JSON
                        }
                      }}
                      rows={8}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfiguring(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveActionConfig}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
