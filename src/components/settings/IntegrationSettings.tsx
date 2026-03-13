import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plug, Loader2, Save, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';

interface Integration {
  id: string;
  name: string;
  type: string;
  description: string;
  status: 'active' | 'inactive' | 'error';
  config: Record<string, string>;
}

const AVAILABLE_INTEGRATIONS = [
  {
    id: 'stripe',
    name: 'Stripe',
    type: 'payment',
    description: 'Process payments with Stripe',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    type: 'sms',
    description: 'Send SMS notifications',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    type: 'email',
    description: 'Send email notifications',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    type: 'accounting',
    description: 'Sync with QuickBooks',
  },
];

export function IntegrationSettings() {
  const { tenant } = useTenantAdminAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    loadIntegrations();
  }, [tenant]);

  const loadIntegrations = async () => {
    if (!tenant?.id) return;

    try {
      const { data, error } = await (supabase as unknown as Record<string, {from: (table: string) => { select: (cols: string) => { eq: (col: string, val: string) => Promise<{data: Integration[] | null; error: unknown}> } } }>).from('custom_integrations').select('*').eq('tenant_id', tenant.id);

      if (error) throw error;
      setIntegrations(data || []);
    } catch (error) {
      logger.error('Error loading integrations:', error);
    }
  };

  const handleSaveIntegration = async (integrationId: string) => {
    if (!tenant?.id || !apiKey) {
      toast.error('Please enter an API key');
      return;
    }

    setLoading(true);
    try {
      const integration = AVAILABLE_INTEGRATIONS.find((i) => i.id === integrationId);
      if (!integration) return;

      const { error } = await (supabase as unknown as Record<string, {from: (table: string) => { upsert: (data: unknown) => Promise<{error: unknown}> } }>).from('custom_integrations').upsert({
        tenant_id: tenant.id,
        name: integration.name,
        type: integration.type,
        config: { api_key: apiKey },
        status: 'active',
      });

      if (error) throw error;

      toast.success(`${integration.name} integration saved successfully`);
      setEditingId(null);
      setApiKey('');
      loadIntegrations();
      logger.info('Integration saved', { tenantId: tenant.id, integration: integrationId });
    } catch (error) {
      logger.error('Error saving integration:', error);
      toast.error('Failed to save integration');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      inactive: 'secondary',
      error: 'destructive',
    };
    return variants[status] || 'secondary';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Plug className="h-5 w-5" />
        Integration Settings
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Connect third-party services to enhance your workflow.
      </p>

      <div className="space-y-4">
        {AVAILABLE_INTEGRATIONS.map((integration) => {
          const existingIntegration = integrations.find((i) => i.type === integration.type);
          const isEditing = editingId === integration.id;

          return (
            <div key={integration.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{integration.name}</h4>
                    {existingIntegration && (
                      <Badge variant={getStatusBadge(existingIntegration.status)}>
                        {existingIntegration.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingId(isEditing ? null : integration.id)}
                >
                  {isEditing ? 'Cancel' : 'Configure'}
                </Button>
              </div>

              {isEditing && (
                <div className="space-y-3 mt-4 pt-4 border-t">
                  <div>
                    <Label htmlFor={`api-key-${integration.id}`}>API Key</Label>
                    <Input
                      id={`api-key-${integration.id}`}
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                    />
                  </div>
                  <Button
                    onClick={() => handleSaveIntegration(integration.id)}
                    disabled={loading}
                    size="sm"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Configuration
                  </Button>
                </div>
              )}

              {existingIntegration && !isEditing && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Connected • API key configured
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-6 border-t">
        <Button variant="outline" size="sm">
          <ExternalLink className="h-4 w-4 mr-2" />
          Browse More Integrations
        </Button>
      </div>
    </Card>
  );
}
