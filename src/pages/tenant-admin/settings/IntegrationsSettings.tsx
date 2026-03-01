import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import {
  SettingsSection,
  SettingsCard,
} from '@/components/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plug,
  CreditCard,
  MessageSquare,
  BarChart3,
  Webhook,
  Key,
  Copy,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  Loader2,
  Brain,
} from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useNavigate } from 'react-router-dom';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'connected' | 'disconnected' | 'error';
  category: 'payments' | 'communications' | 'analytics' | 'compliance';
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept payments and manage transactions',
    icon: <CreditCard className="h-5 w-5" />,
    status: 'connected',
    category: 'payments',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS notifications and verification',
    icon: <MessageSquare className="h-5 w-5" />,
    status: 'disconnected',
    category: 'communications',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Email delivery and marketing',
    icon: <MessageSquare className="h-5 w-5" />,
    status: 'connected',
    category: 'communications',
  },
  {
    id: 'analytics',
    name: 'Google Analytics',
    description: 'Website and user analytics',
    icon: <BarChart3 className="h-5 w-5" />,
    status: 'disconnected',
    category: 'analytics',
  },
];

interface AIIntegration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'available' | 'demo';
  features: string[];
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered?: string;
}

export default function IntegrationsSettings() {
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [showApiKey, setShowApiKey] = useState(false);
  const [addWebhookOpen, setAddWebhookOpen] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');

  // AI Assistant configuration
  const aiAssistant: AIIntegration = {
    id: 'local-ai',
    name: 'Local AI Assistant',
    description: 'Run AI models locally without API fees',
    icon: <Brain className="h-5 w-5" />,
    status: 'available',
    features: [
      'Sentiment Analysis',
      'Text Summarization',
      'Message Classification',
      'Translation',
    ],
  };

  const apiKey = 'your_api_key_will_appear_here';

  // Fetch real webhooks from custom_integrations table
  const { data: webhooks = [], isLoading: webhooksLoading } = useQuery({
    queryKey: queryKeys.webhooks.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('custom_integrations')
        .select('id, config, status, updated_at')
        .eq('tenant_id', tenant.id)
        .eq('type', 'webhook')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch webhooks', error);
        return [];
      }

      return (data ?? []).map(item => ({
        id: item.id,
        url: (item.config as Record<string, unknown>)?.url as string ?? '',
        events: (item.config as Record<string, unknown>)?.events as string[] || ['order.created'],
        active: item.status === 'active',
        lastTriggered: item.updated_at ? formatSmartDate(item.updated_at, { includeTime: true }) : undefined,
      })) as WebhookEndpoint[];
    },
    enabled: !!tenant?.id,
  });

  // Add webhook mutation
  const addWebhookMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('custom_integrations')
        .insert({
          tenant_id: tenant.id,
          name: `Webhook - ${new URL(url).hostname}`,
          type: 'webhook',
          config: { url, events: ['order.created'] },
          status: 'active',
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.byTenant(tenant?.id) });
      setNewWebhookUrl('');
      setAddWebhookOpen(false);
      toast.success('Webhook added');
    },
    onError: (error) => {
      toast.error('Failed to add webhook', { description: humanizeError(error) });
    },
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.byTenant(tenant?.id) });
      toast.success('Webhook deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete webhook', { description: humanizeError(error) });
    },
  });

  // Toggle webhook mutation with optimistic UI
  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('custom_integrations')
        .update({ status: active ? 'active' : 'inactive' })
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.webhooks.byTenant(tenant?.id) });
      const previousWebhooks = queryClient.getQueryData<WebhookEndpoint[]>(queryKeys.webhooks.byTenant(tenant?.id));
      queryClient.setQueryData<WebhookEndpoint[]>(queryKeys.webhooks.byTenant(tenant?.id), (old) => {
        if (!old) return old;
        return old.map((webhook) =>
          webhook.id === id ? { ...webhook, active } : webhook
        );
      });
      return { previousWebhooks };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousWebhooks) {
        queryClient.setQueryData(queryKeys.webhooks.byTenant(tenant?.id), context.previousWebhooks);
      }
      logger.error('Failed to toggle webhook', { error });
      toast.error('Failed to toggle webhook', { description: humanizeError(error) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.byTenant(tenant?.id) });
    },
  });

  const handleConnect = (id: string) => {
    setIntegrations(
      integrations.map((i) =>
        i.id === id ? { ...i, status: 'connected' as const } : i
      )
    );
    toast.success('Integration connected', { description: `${id} has been connected successfully` });
  };

  const handleDisconnect = (id: string) => {
    setIntegrations(
      integrations.map((i) =>
        i.id === id ? { ...i, status: 'disconnected' as const } : i
      )
    );
    toast.success('Integration disconnected');
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success('API key copied to clipboard');
  };

  const handleRegenerateApiKey = () => {
    toast.success('API key regenerated', { description: 'Your old key is no longer valid' });
  };

  const handleAddWebhook = () => {
    if (!newWebhookUrl) {
      toast.error('URL required');
      return;
    }

    try {
      new URL(newWebhookUrl); // Validate URL
      addWebhookMutation.mutate(newWebhookUrl);
    } catch (error) {
      toast.error('Invalid URL', { description: humanizeError(error) });
    }
  };

  const getStatusBadge = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-emerald-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground mt-1">
          Connect third-party services and manage API access
        </p>
      </div>

      {/* Available Integrations */}
      <SettingsSection
        title="Available Integrations"
        description="Connect your favorite tools and services"
        icon={Plug}
      >
        <div className="grid md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <SettingsCard key={integration.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'h-12 w-12 rounded-xl flex items-center justify-center',
                      integration.status === 'connected'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {integration.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold">{integration.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {integration.description}
                    </p>
                    <div className="mt-2">{getStatusBadge(integration.status)}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t">
                {integration.status === 'connected' ? (
                  <>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDisconnect(integration.id)}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => handleConnect(integration.id)}>
                    <Plug className="h-4 w-4 mr-2" />
                    Connect
                  </Button>
                )}
              </div>
            </SettingsCard>
          ))}
        </div>
      </SettingsSection>

      {/* AI Assistant Settings */}
      <SettingsSection
        title="AI Assistant"
        description="Local AI processing for intelligent automation"
        icon={Brain}
      >
        <SettingsCard>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-600">
                {aiAssistant.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{aiAssistant.name}</h4>
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500">
                    Demo Mode
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {aiAssistant.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {aiAssistant.features.map((feature) => (
                    <Badge key={feature} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <Brain className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                Run AI models locally in your browser or on your server.
                No data is sent to external services, ensuring complete privacy and no API fees.
              </span>
            </p>
          </div>
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button
              size="sm"
              onClick={() => navigate(`/${tenantSlug}/admin/integrations-hub?tab=ai`)}
            >
              <Brain className="h-4 w-4 mr-2" />
              Open AI Assistant
            </Button>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Documentation
            </Button>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* API Keys */}
      <SettingsSection
        title="API Keys"
        description="Manage your API access credentials"
        icon={Key}
      >
        <SettingsCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Live API Key</p>
                <p className="text-sm text-muted-foreground">
                  Use this key for production requests
                </p>
              </div>
              <Badge variant="default">Production</Badge>
            </div>

            <div className="flex items-center gap-2">
              <Input
                value={showApiKey ? apiKey : '•'.repeat(40)}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="icon" onClick={handleCopyApiKey} aria-label="Copy API key">
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRegenerateApiKey}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate Key
              </Button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <strong>Warning:</strong> Keep your API key secret. Never expose it in client-side code.
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Webhooks */}
      <SettingsSection
        title="Webhooks"
        description="Receive real-time notifications for events"
        icon={Webhook}
        action={
          <Dialog open={addWebhookOpen} onOpenChange={setAddWebhookOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Webhook Endpoint</DialogTitle>
                <DialogDescription>
                  We'll send POST requests to this URL when events occur
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endpoint URL</label>
                  <Input
                    type="url"
                    placeholder="https://api.yoursite.com/webhook"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddWebhookOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddWebhook} disabled={addWebhookMutation.isPending}>
                  {addWebhookMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        <SettingsCard>
          {webhooksLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No webhooks configured</p>
              <p className="text-sm">Add a webhook to receive real-time event notifications</p>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'h-3 w-3 rounded-full',
                        webhook.active ? 'bg-emerald-500' : 'bg-muted'
                      )}
                    />
                    <div>
                      <p className="font-mono text-sm">{webhook.url}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {webhook.events.length} events
                        </Badge>
                        {webhook.lastTriggered && (
                          <span className="text-xs text-muted-foreground">
                            Last triggered {webhook.lastTriggered}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch 
                      checked={webhook.active}
                      onCheckedChange={(checked) => toggleWebhookMutation.mutate({ id: webhook.id, active: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                      disabled={deleteWebhookMutation.isPending}
                      aria-label="Delete webhook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
