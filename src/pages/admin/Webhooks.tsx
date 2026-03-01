import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Webhook, Plus, Edit, Loader2, History } from 'lucide-react';
import { handleError } from '@/utils/errorHandling/handlers';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { WebhookLogs } from '@/components/integrations/WebhookLogs';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  status: string;
  is_active?: boolean;
  last_triggered_at?: string | null;
  integration_id?: string | null;
  created_at: string;
}

const WEBHOOK_EVENTS = [
  'order.created',
  'order.updated',
  'order.completed',
  'order.cancelled',
  'customer.created',
  'customer.updated',
  'payment.succeeded',
  'payment.failed',
];

import { type Database } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/queryKeys';

// Workaround for missing table types
type TableKey = keyof Database['public']['Tables'];
const TABLE_WEBHOOKS = 'webhooks' as unknown as TableKey;

export default function Webhooks() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    status: 'active',
  });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: queryKeys.webhooks.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from(TABLE_WEBHOOKS)
          .select('id, name, url, events, secret, status, is_active, last_triggered_at, integration_id, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (webhook: Partial<WebhookConfig>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from(TABLE_WEBHOOKS)
        .insert({
          tenant_id: tenantId,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events ?? [],
          secret: webhook.secret || null,
          status: webhook.status || 'active',
        })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Webhooks table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.byTenant(tenantId) });
      toast.success("Webhook has been created successfully.");
      resetForm();
    },
    onError: (error) => {
      handleError(error, {
        component: 'Webhooks.createWebhook',
        toastTitle: 'Error',
        showToast: true
      });
    },
  });

  const updateWebhookMutation = useMutation({
    mutationFn: async ({ id, ...webhook }: WebhookConfig) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from(TABLE_WEBHOOKS)
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
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Webhooks table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.byTenant(tenantId) });
      toast.success("Webhook has been updated successfully.");
      resetForm();
    },
    onError: (error) => {
      handleError(error, {
        component: 'Webhooks.updateWebhook',
        toastTitle: 'Error',
        showToast: true
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
    setIsDialogOpen(false);
  };

  const handleEdit = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events ?? [],
      secret: webhook.secret ?? '',
      status: webhook.status,
    });
    setIsDialogOpen(true);
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

  const toggleEvent = (event: string) => {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">Manage webhook integrations</p>
        </div>
        <EnhancedLoadingState variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">Configure webhook endpoints for real-time events</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Webhook
        </Button>
      </div>

      {webhooks && webhooks.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(webhooks as unknown as WebhookConfig[]).map((webhook) => (
            <Card
              key={webhook.id}
              className={`cursor-pointer transition-colors ${
                selectedWebhookId === webhook.id ? 'border-primary bg-muted/30' : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedWebhookId(webhook.id === selectedWebhookId ? null : webhook.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    <CardTitle>{webhook.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(webhook);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>{webhook.url}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}>
                      {webhook.status || 'inactive'}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Events</div>
                    <div className="flex flex-wrap gap-1">
                      {(webhook.events ?? []).slice(0, 3).map((event: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                      {(webhook.events ?? []).length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{(webhook.events ?? []).length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                    <History className="h-4 w-4" />
                    <span>Click to view logs</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhooks configured. Create your first webhook to get started.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedWebhookId && (
        <WebhookLogs webhookId={selectedWebhookId} limit={20} />
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
            <DialogDescription>
              Configure webhook endpoint and events
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Webhook Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Webhook URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://example.com/webhook"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret">Secret (optional)</Label>
                <Input
                  id="secret"
                  type="password"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  placeholder="Webhook secret for verification"
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg max-h-48 overflow-y-auto">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label key={event} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded"
                      />
                      <span className="text-sm">{event}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createWebhookMutation.isPending || updateWebhookMutation.isPending}
              >
                {(createWebhookMutation.isPending || updateWebhookMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {createWebhookMutation.isPending ? 'Creating...' : updateWebhookMutation.isPending ? 'Updating...' : editingWebhook ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

