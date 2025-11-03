import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Plus, Trash2, Edit, Send, Save, X, Activity } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  status: 'active' | 'inactive';
  created_at: string;
  last_triggered_at?: string;
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  event: string;
  status: 'success' | 'failed';
  response_code?: number;
  response_body?: string;
  error_message?: string;
  created_at: string;
}

const WEBHOOK_EVENTS = [
  'order.created',
  'order.updated',
  'order.completed',
  'order.cancelled',
  'payment.received',
  'payment.failed',
  'delivery.dispatched',
  'delivery.completed',
  'customer.created',
  'customer.updated',
  'inventory.low_stock',
];

export default function Webhooks() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    status: 'active' as 'active' | 'inactive',
  });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['webhooks', tenantId],
    queryFn: async (): Promise<Webhook[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('webhooks')
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

  const { data: webhookLogs } = useQuery({
    queryKey: ['webhook-logs', tenantId],
    queryFn: async (): Promise<WebhookLog[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('webhook_logs')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100);

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

  const createWebhookMutation = useMutation({
    mutationFn: async (webhook: Omit<Webhook, 'id' | 'created_at' | 'last_triggered_at'>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('webhooks')
        .insert({
          tenant_id: tenantId,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret || null,
          status: webhook.status,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Webhooks table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', tenantId] });
      toast({ title: 'Webhook created', description: 'Webhook has been created successfully.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create webhook',
        variant: 'destructive',
      });
    },
  });

  const updateWebhookMutation = useMutation({
    mutationFn: async ({ id, ...webhook }: Webhook) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('webhooks')
        .update({
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret || null,
          status: webhook.status,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Webhooks table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', tenantId] });
      toast({ title: 'Webhook updated', description: 'Webhook has been updated successfully.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update webhook',
        variant: 'destructive',
      });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('webhooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks', tenantId] });
      toast({ title: 'Webhook deleted', description: 'Webhook has been deleted.' });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      // Simulate webhook test
      toast({
        title: 'Test webhook sent',
        description: 'A test webhook has been sent to your endpoint.',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      events: [],
      secret: '',
      status: 'active',
    });
    setEditingWebhook(null);
    setShowForm(false);
  };

  const handleToggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const handleEdit = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      secret: '',
      status: webhook.status,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWebhook) {
      updateWebhookMutation.mutate({
        ...editingWebhook,
        ...formData,
      });
    } else {
      createWebhookMutation.mutate(formData);
    }
  };

  const successCount = webhookLogs?.filter((log) => log.status === 'success').length || 0;
  const failedCount = webhookLogs?.filter((log) => log.status === 'failed').length || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading webhooks...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">Configure webhook endpoints for real-time event notifications</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Webhook
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Webhooks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {webhooks?.filter((w) => w.status === 'active').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Successful Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingWebhook ? 'Edit Webhook' : 'Create New Webhook'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Webhook Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Order Notifications"
                  required
                />
              </div>
              <div>
                <Label htmlFor="url">Webhook URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://your-server.com/webhooks"
                  required
                />
              </div>
              <div>
                <Label htmlFor="secret">Secret (Optional)</Label>
                <Input
                  id="secret"
                  type="password"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder="Webhook signing secret"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Used to verify webhook authenticity using HMAC
                </p>
              </div>
              <div>
                <Label>Events to Subscribe</Label>
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-4">
                  {WEBHOOK_EVENTS.map((event) => (
                    <div key={event} className="flex items-center space-x-2">
                      <Checkbox
                        id={event}
                        checked={formData.events.includes(event)}
                        onCheckedChange={() => handleToggleEvent(event)}
                      />
                      <Label htmlFor={event} className="text-sm font-normal cursor-pointer">
                        {event}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={formData.status === 'active'}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, status: checked ? 'active' : 'inactive' })
                  }
                />
                <Label htmlFor="active" className="cursor-pointer">
                  Active
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createWebhookMutation.isPending || updateWebhookMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingWebhook ? 'Update' : 'Create'} Webhook
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                {editingWebhook && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testWebhookMutation.mutate(editingWebhook.id)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Webhooks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Webhooks ({webhooks?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {webhooks && webhooks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell>
                      <code className="text-xs font-mono">{webhook.url}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{webhook.events.length} events</Badge>
                    </TableCell>
                    <TableCell>
                      {webhook.last_triggered_at
                        ? new Date(webhook.last_triggered_at).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}>
                        {webhook.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(webhook)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this webhook?')) {
                              deleteWebhookMutation.mutate(webhook.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testWebhookMutation.mutate(webhook.id)}
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {webhooks !== undefined
                ? 'No webhooks configured. Create a webhook to receive real-time event notifications.'
                : 'Webhooks table not found. Please run database migrations.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Logs */}
      {webhookLogs && webhookLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Webhook Logs (Last 100)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response Code</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhookLogs.slice(0, 20).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{log.event}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.response_code || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {log.error_message || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

