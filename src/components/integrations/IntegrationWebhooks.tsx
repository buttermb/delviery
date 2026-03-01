import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Webhook, Plus, Edit, Trash2, Loader2, Link2, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { WebhookLogs } from './WebhookLogs';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { handleError } from '@/utils/errorHandling/handlers';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { queryKeys } from '@/lib/queryKeys';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  status: string;
  integration_id: string | null;
  created_at: string;
}

interface IntegrationWebhooksProps {
  integrationId: string;
  integrationName: string;
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

export function IntegrationWebhooks({ integrationId, integrationName }: IntegrationWebhooksProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [webhookToDelete, setWebhookToDelete] = useState<WebhookConfig | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
  });

  const { data: webhooks, isLoading } = useQuery({
    queryKey: queryKeys.integrationWebhooks.byIntegration(tenantId, integrationId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('webhooks')
          .select('id, name, url, events, secret, status, integration_id, created_at')
          .eq('tenant_id', tenantId)
          .eq('integration_id', integrationId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data ?? []) as unknown as WebhookConfig[];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId && !!integrationId,
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (webhook: Partial<WebhookConfig>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('webhooks')
        .insert({
          tenant_id: tenantId,
          integration_id: integrationId,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events ?? [],
          secret: webhook.secret || null,
          status: 'active',
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
      queryClient.invalidateQueries({ queryKey: queryKeys.integrationWebhooks.byIntegration(tenantId, integrationId) });
      toast.success('Webhook created — Webhook has been linked to this integration.');
      resetForm();
    },
    onError: (error) => {
      handleError(error, {
        component: 'IntegrationWebhooks.createWebhook',
        toastTitle: 'Error',
        showToast: true,
      });
    },
  });

  const updateWebhookMutation = useMutation({
    mutationFn: async ({ id, ...webhook }: WebhookConfig) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('webhooks')
        .update({
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret || null,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrationWebhooks.byIntegration(tenantId, integrationId) });
      toast.success('Webhook updated — Webhook configuration has been updated.');
      resetForm();
    },
    onError: (error) => {
      handleError(error, {
        component: 'IntegrationWebhooks.updateWebhook',
        toastTitle: 'Error',
        showToast: true,
      });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrationWebhooks.byIntegration(tenantId, integrationId) });
      toast.success('Webhook deleted — Webhook has been removed from this integration.');
      if (selectedWebhookId) setSelectedWebhookId(null);
    },
    onError: (error) => {
      handleError(error, {
        component: 'IntegrationWebhooks.deleteWebhook',
        toastTitle: 'Error',
        showToast: true,
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      events: [],
      secret: '',
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            Webhooks
          </CardTitle>
          <CardDescription>Loading webhooks...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks for {integrationName}
              </CardTitle>
              <CardDescription>
                Configure webhook endpoints to receive events from this integration
              </CardDescription>
            </div>
            <Button onClick={() => setIsDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks && webhooks.length > 0 ? (
            <div className="space-y-3">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedWebhookId === webhook.id ? 'border-primary bg-muted/30' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedWebhookId(webhook.id === selectedWebhookId ? null : webhook.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{webhook.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          {webhook.url}
                          <ExternalLink className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}>
                        {webhook.status}
                      </Badge>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWebhookToDelete(webhook);
                          setDeleteDialogOpen(true);
                        }}
                        disabled={deleteWebhookMutation.isPending}
                      >
                        {deleteWebhookMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {webhook.events && webhook.events.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {webhook.events.slice(0, 4).map((event, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                      {webhook.events.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{webhook.events.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhooks configured for this integration.</p>
              <p className="text-sm">Add a webhook to receive real-time event notifications.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedWebhookId && (
        <WebhookLogs webhookId={selectedWebhookId} limit={20} />
      )}

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setWebhookToDelete(null);
        }}
        onConfirm={() => {
          if (webhookToDelete) {
            deleteWebhookMutation.mutate(webhookToDelete.id);
            setDeleteDialogOpen(false);
            setWebhookToDelete(null);
          }
        }}
        itemName={webhookToDelete?.name}
        itemType="webhook"
        isLoading={deleteWebhookMutation.isPending}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Add Webhook'}</DialogTitle>
            <DialogDescription>
              Configure webhook endpoint for {integrationName}
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
                  placeholder="e.g., Order Notifications"
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
                {editingWebhook ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
