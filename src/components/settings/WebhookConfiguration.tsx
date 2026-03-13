import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Webhook, Loader2, Plus, Trash2, TestTube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { format } from 'date-fns';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

const webhookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Must be a valid URL'),
  events: z.array(z.string()).min(1, 'Select at least one event'),
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

const AVAILABLE_EVENTS = [
  { id: 'order.created', label: 'Order Created' },
  { id: 'order.updated', label: 'Order Updated' },
  { id: 'order.cancelled', label: 'Order Cancelled' },
  { id: 'payment.received', label: 'Payment Received' },
  { id: 'payment.failed', label: 'Payment Failed' },
  { id: 'product.low_stock', label: 'Low Stock Alert' },
  { id: 'customer.created', label: 'Customer Created' },
  { id: 'delivery.completed', label: 'Delivery Completed' },
];

export function WebhookConfiguration() {
  const { tenant } = useTenantAdminAuth();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name: '',
      url: '',
      events: [],
    },
  });

  useEffect(() => {
    loadWebhooks();
  }, [tenant]);

  const loadWebhooks = async () => {
    if (!tenant?.id) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase as any).from('webhooks').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });

      if (error) throw error;
      setWebhooks(data || []);
    } catch (error) {
      logger.error('Error loading webhooks:', error);
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async (data: WebhookFormValues) => {
    if (!tenant?.id) {
      toast.error('Tenant not found');
      return;
    }

    try {
      const secret = `whsec_${Math.random().toString(36).substring(2, 15)}`;

      const { error } = await (supabase as any).from('webhooks').insert({
        tenant_id: tenant.id,
        name: data.name,
        url: data.url,
        events: data.events,
        secret,
        is_active: true,
      });

      if (error) throw error;

      toast.success('Webhook created successfully');
      form.reset();
      setDialogOpen(false);
      loadWebhooks();
      logger.info('Webhook created', { tenantId: tenant.id });
    } catch (error) {
      logger.error('Error creating webhook:', error);
      toast.error('Failed to create webhook');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!tenant?.id) return;

    try {
      const { error } = await (supabase as any).from('webhooks').delete().eq('id', webhookId);

      if (error) throw error;

      toast.success('Webhook deleted successfully');
      loadWebhooks();
      logger.info('Webhook deleted', { tenantId: tenant.id, webhookId });
    } catch (error) {
      logger.error('Error deleting webhook:', error);
      toast.error('Failed to delete webhook');
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    toast.info('Sending test webhook...');
    logger.info('Test webhook triggered', { webhookId });
    // In real implementation, this would trigger a test event
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Webhook Configuration
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Webhook</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreateWebhook)} className="space-y-4 py-4">
              <div>
                <Label htmlFor="webhook-name">Name</Label>
                <Input
                  id="webhook-name"
                  {...form.register('name')}
                  placeholder="Production Webhook"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  {...form.register('url')}
                  placeholder="https://your-domain.com/webhooks/floraiq"
                />
                {form.formState.errors.url && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.url.message}
                  </p>
                )}
              </div>

              <div>
                <Label>Events</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Select the events that will trigger this webhook
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_EVENTS.map((event) => (
                    <div key={event.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={event.id}
                        checked={form.watch('events').includes(event.id)}
                        onCheckedChange={(checked) => {
                          const current = form.watch('events');
                          if (checked) {
                            form.setValue('events', [...current, event.id]);
                          } else {
                            form.setValue(
                              'events',
                              current.filter((e) => e !== event.id)
                            );
                          }
                        }}
                      />
                      <label htmlFor={event.id} className="text-sm cursor-pointer">
                        {event.label}
                      </label>
                    </div>
                  ))}
                </div>
                {form.formState.errors.events && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.events.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create Webhook
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Webhook className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No webhooks configured. Create one to receive events.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{webhook.name}</h4>
                    <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                      {webhook.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono mt-1">{webhook.url}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestWebhook(webhook.id)}
                  >
                    <TestTube className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteWebhook(webhook.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Events:</p>
                <div className="flex flex-wrap gap-2">
                  {webhook.events.map((event) => (
                    <Badge key={event} variant="outline">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>

              {webhook.last_triggered_at && (
                <p className="text-xs text-muted-foreground mt-3">
                  Last triggered {format(new Date(webhook.last_triggered_at), 'MMM dd, yyyy HH:mm')}
                </p>
              )}

              {webhook.secret && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Secret: <code className="font-mono bg-muted px-1 py-0.5 rounded">{webhook.secret}</code>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
