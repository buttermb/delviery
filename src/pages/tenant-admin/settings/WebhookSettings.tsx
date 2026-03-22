import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Webhook, Plus, Trash2, TestTube, Info } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { trackCreditEvent, getCreditCost } from '@/lib/credits';
import { useCredits } from '@/hooks/useCredits';
import { CreditCostBadge } from '@/components/credits/CreditCostBadge';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret: string;
}

const AVAILABLE_EVENTS = [
  { id: 'order.created', label: 'Order Created', description: 'When a new order is placed' },
  { id: 'order.updated', label: 'Order Updated', description: 'When an order status changes' },
  { id: 'payment.received', label: 'Payment Received', description: 'When payment is confirmed' },
  { id: 'stock.low', label: 'Stock Low', description: 'When inventory falls below threshold' },
  { id: 'delivery.completed', label: 'Delivery Completed', description: 'When delivery is marked complete' },
];

export default function WebhookSettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const { isFreeTier, balance } = useCredits();
  const webhookFireCost = getCreditCost('webhook_fired');

  // Track webhook configuration page view for analytics
  useEffect(() => {
    if (tenant?.id && isFreeTier) {
      trackCreditEvent(tenant.id, 'webhook_config_viewed', balance);
    }
  }, [tenant?.id, isFreeTier, balance]);

  const { isLoading } = useQuery({
    queryKey: queryKeys.webhooks.list(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('webhooks')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const webhookConfigs: WebhookConfig[] = (data || []).map((w: Record<string, unknown>) => ({
        id: w.id as string,
        name: w.name as string || 'Unnamed Webhook',
        url: w.url as string,
        events: (w.events as string[]) || [],
        enabled: w.active as boolean ?? true,
        secret: w.secret as string || '',
      }));

      setWebhooks(webhookConfigs);
      return webhookConfigs;
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (webhook: WebhookConfig) => {
      if (!tenant?.id) throw new Error('No tenant');

      if (webhook.id.startsWith('temp-')) {
        // Create new
        const { error } = await supabase
          .from('webhooks')
          .insert({
            tenant_id: tenant.id,
            name: webhook.name,
            url: webhook.url,
            events: webhook.events,
            active: webhook.enabled,
            secret: webhook.secret || crypto.randomUUID(),
          });

        if (error) throw error;
      } else {
        // Update existing
        const { error } = await supabase
          .from('webhooks')
          .update({
            name: webhook.name,
            url: webhook.url,
            events: webhook.events,
            active: webhook.enabled,
            secret: webhook.secret,
          })
          .eq('id', webhook.id)
          .eq('tenant_id', tenant.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(tenant?.id) });
      toast.success('Webhook saved');
    },
    onError: (error) => {
      logger.error('Failed to save webhook', { error });
      toast.error(humanizeError(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { error } = await supabase
        .from('webhooks')
        .delete()
        .eq('id', webhookId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.list(tenant?.id) });
      toast.success('Webhook deleted');
    },
    onError: (error) => {
      logger.error('Failed to delete webhook', { error });
      toast.error(humanizeError(error));
    },
  });

  const handleAddWebhook = () => {
    const newWebhook: WebhookConfig = {
      id: `temp-${Date.now()}`,
      name: 'New Webhook',
      url: '',
      events: [],
      enabled: true,
      secret: crypto.randomUUID(),
    };
    setWebhooks([...webhooks, newWebhook]);
  };

  const handleRemoveWebhook = (id: string) => {
    if (id.startsWith('temp-')) {
      setWebhooks(webhooks.filter(w => w.id !== id));
    } else {
      deleteMutation.mutate(id);
    }
  };

  const handleWebhookChange = (id: string, field: keyof WebhookConfig, value: unknown) => {
    const updatedWebhooks = webhooks.map(w =>
      w.id === id ? { ...w, [field]: value } : w
    );
    setWebhooks(updatedWebhooks);

    const webhook = updatedWebhooks.find(w => w.id === id);
    if (webhook) {
      saveMutation.mutate(webhook);
    }
  };

  const handleToggleEvent = (webhookId: string, eventId: string) => {
    const webhook = webhooks.find(w => w.id === webhookId);
    if (!webhook) return;

    const newEvents = webhook.events.includes(eventId)
      ? webhook.events.filter(e => e !== eventId)
      : [...webhook.events, eventId];

    handleWebhookChange(webhookId, 'events', newEvents);
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingWebhook(webhookId);
    try {
      const webhook = webhooks.find(w => w.id === webhookId);
      if (!webhook) throw new Error('Webhook not found');

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhook.secret,
        },
        body: JSON.stringify({
          event: 'test',
          timestamp: new Date().toISOString(),
          data: { message: 'Test webhook from FloraIQ' },
        }),
      });

      if (response.ok) {
        toast.success('Test webhook sent successfully');
      } else {
        toast.error(`Webhook returned ${response.status}`);
      }
    } catch (error) {
      logger.error('Failed to test webhook', { error });
      toast.error('Failed to send test webhook');
    } finally {
      setTestingWebhook(null);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Webhook Configuration</h2>
        <p className="text-muted-foreground mt-1">
          Configure webhook URLs for real-time event notifications
        </p>
      </div>

      {isFreeTier && webhookFireCost > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span>Webhook configuration is free.</span>{' '}
            <span>Each webhook trigger costs <strong>{webhookFireCost} credits</strong>.</span>
          </div>
          <CreditCostBadge actionKey="webhook_fired" showTooltip />
        </div>
      )}

      <SettingsSection
        title="Webhooks"
        description="Receive HTTP POST requests when events occur"
        icon={Webhook}
        action={
          <Button onClick={handleAddWebhook} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        }
      >
        <SettingsCard>
          {webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No webhooks configured. Click "Add Webhook" to create one.
            </div>
          ) : (
            <div className="space-y-6">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={webhook.name}
                          onChange={(e) => handleWebhookChange(webhook.id, 'name', e.target.value)}
                          placeholder="e.g., Order Notifications"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Webhook URL</Label>
                        <Input
                          value={webhook.url}
                          onChange={(e) => handleWebhookChange(webhook.id, 'url', e.target.value)}
                          placeholder="https://example.com/webhook"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Switch
                        checked={webhook.enabled}
                        onCheckedChange={(checked) => handleWebhookChange(webhook.id, 'enabled', checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveWebhook(webhook.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">Events</Label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_EVENTS.map((event) => (
                        <Badge
                          key={event.id}
                          variant={webhook.events.includes(event.id) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => handleToggleEvent(webhook.id, event.id)}
                        >
                          {event.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t">
                    <div className="flex-1">
                      <Label className="text-xs">Secret</Label>
                      <Input
                        value={webhook.secret}
                        readOnly
                        className="font-mono text-xs"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestWebhook(webhook.id)}
                      disabled={!webhook.url || testingWebhook === webhook.id}
                    >
                      <TestTube className="h-4 w-4 mr-2" />
                      {testingWebhook === webhook.id ? 'Testing...' : 'Test'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>
      </SettingsSection>

      <SaveStatusIndicator
        status={saveMutation.isPending ? 'saving' : 'saved'}
      />
    </div>
  );
}
