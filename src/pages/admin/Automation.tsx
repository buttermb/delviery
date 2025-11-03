import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Plus, Play, Trash2, Edit, Save, Zap, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  trigger_type: 'event' | 'schedule' | 'condition';
  trigger_config: any;
  action_type: string;
  action_config: any;
  enabled: boolean;
  created_at: string;
  last_run_at?: string;
}

const TRIGGER_TYPES = [
  { value: 'event', label: 'Event-Based', description: 'Trigger on system events' },
  { value: 'schedule', label: 'Scheduled', description: 'Run on a schedule' },
  { value: 'condition', label: 'Condition-Based', description: 'Trigger when conditions are met' },
];

const ACTION_TYPES = [
  { value: 'email', label: 'Send Email' },
  { value: 'sms', label: 'Send SMS' },
  { value: 'webhook', label: 'Call Webhook' },
  { value: 'update', label: 'Update Record' },
  { value: 'create', label: 'Create Record' },
  { value: 'notification', label: 'Send Notification' },
];

const AUTOMATION_TEMPLATES = [
  {
    name: 'Low Stock Alert',
    description: 'Send email when inventory drops below threshold',
    trigger_type: 'condition',
    trigger_config: { condition: 'inventory.stock < threshold' },
    action_type: 'email',
    action_config: { template: 'low_stock_alert' },
  },
  {
    name: 'Order Confirmation',
    description: 'Send confirmation email when order is created',
    trigger_type: 'event',
    trigger_config: { event: 'order.created' },
    action_type: 'email',
    action_config: { template: 'order_confirmation' },
  },
  {
    name: 'Daily Sales Report',
    description: 'Email daily sales report at end of day',
    trigger_type: 'schedule',
    trigger_config: { schedule: 'daily', time: '18:00' },
    action_type: 'email',
    action_config: { template: 'daily_report' },
  },
];

export default function Automation() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'event' as 'event' | 'schedule' | 'condition',
    trigger_config: {},
    action_type: '',
    action_config: {},
    enabled: true,
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['automation-rules', tenantId],
    queryFn: async (): Promise<AutomationRule[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('automation_rules')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') {
          return [];
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createRuleMutation = useMutation({
    mutationFn: async (rule: Omit<AutomationRule, 'id' | 'created_at' | 'last_run_at'>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('automation_rules')
        .insert({
          tenant_id: tenantId,
          name: rule.name,
          description: rule.description || null,
          trigger_type: rule.trigger_type,
          trigger_config: rule.trigger_config,
          action_type: rule.action_type,
          action_config: rule.action_config,
          enabled: rule.enabled,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Automation rules table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules', tenantId] });
      toast({ title: 'Automation created', description: 'Automation rule has been created.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create automation',
        variant: 'destructive',
      });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, ...rule }: AutomationRule) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('automation_rules')
        .update({
          name: rule.name,
          description: rule.description || null,
          trigger_type: rule.trigger_type,
          trigger_config: rule.trigger_config,
          action_type: rule.action_type,
          action_config: rule.action_config,
          enabled: rule.enabled,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Automation rules table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules', tenantId] });
      toast({ title: 'Automation updated', description: 'Automation rule has been updated.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update automation',
        variant: 'destructive',
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('automation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules', tenantId] });
      toast({ title: 'Automation deleted', description: 'Automation rule has been deleted.' });
    },
  });

  const testRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      toast({
        title: 'Test executed',
        description: 'Automation rule has been tested (simulated).',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      trigger_type: 'event',
      trigger_config: {},
      action_type: '',
      action_config: {},
      enabled: true,
    });
    setEditingRule(null);
    setShowForm(false);
  };

  const handleUseTemplate = (template: typeof AUTOMATION_TEMPLATES[0]) => {
    setFormData({
      name: template.name,
      description: template.description,
      trigger_type: template.trigger_type as any,
      trigger_config: template.trigger_config,
      action_type: template.action_type,
      action_config: template.action_config,
      enabled: true,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateRuleMutation.mutate({
        ...editingRule,
        ...formData,
      });
    } else {
      createRuleMutation.mutate(formData);
    }
  };

  const enabledCount = rules?.filter((r) => r.enabled).length || 0;
  const totalRuns = rules?.reduce((sum, r) => sum + (r.last_run_at ? 1 : 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading automation rules...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Automation</h1>
          <p className="text-muted-foreground">Create automated workflows and trigger-based actions</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Automation
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{enabledCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRuns}</div>
          </CardContent>
        </Card>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {AUTOMATION_TEMPLATES.map((template, index) => (
              <Card
                key={index}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleUseTemplate(template)}
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    {template.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingRule ? 'Edit Automation' : 'Create New Automation'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="trigger">Trigger Type</Label>
                  <Select
                    value={formData.trigger_type}
                    onValueChange={(value: any) => setFormData({ ...formData, trigger_type: value })}
                  >
                    <SelectTrigger id="trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="action">Action Type</Label>
                  <Select
                    value={formData.action_type}
                    onValueChange={(value) => setFormData({ ...formData, action_type: value })}
                  >
                    <SelectTrigger id="action">
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((action) => (
                        <SelectItem key={action.value} value={action.value}>
                          {action.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createRuleMutation.isPending || updateRuleMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingRule ? 'Update' : 'Create'} Automation
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                {editingRule && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testRuleMutation.mutate(editingRule.id)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rules Table */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Rules ({rules?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {rules && rules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.trigger_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{rule.action_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rule.last_run_at
                        ? new Date(rule.last_run_at).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this automation rule?')) {
                              deleteRuleMutation.mutate(rule.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {rules !== undefined
                ? 'No automation rules created. Use a template or create a custom automation.'
                : 'Automation rules table not found. Please run database migrations.'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

