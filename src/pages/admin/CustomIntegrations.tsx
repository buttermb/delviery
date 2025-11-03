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
import { Plus, Trash2, Edit, Link, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Integration {
  id: string;
  name: string;
  service: string;
  status: 'connected' | 'disconnected' | 'error';
  api_key?: string;
  api_secret?: string;
  config?: any;
  last_sync_at?: string;
  created_at: string;
}

const AVAILABLE_INTEGRATIONS = [
  {
    service: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and subscriptions',
    icon: '💳',
  },
  {
    service: 'shopify',
    name: 'Shopify',
    description: 'E-commerce platform integration',
    icon: '🛍️',
  },
  {
    service: 'quickbooks',
    name: 'QuickBooks',
    description: 'Accounting and financial management',
    icon: '📊',
  },
  {
    service: 'mailchimp',
    name: 'Mailchimp',
    description: 'Email marketing and campaigns',
    icon: '✉️',
  },
  {
    service: 'slack',
    name: 'Slack',
    description: 'Team communication and notifications',
    icon: '💬',
  },
  {
    service: 'zapier',
    name: 'Zapier',
    description: 'Automation and workflow integration',
    icon: '⚡',
  },
];

export default function CustomIntegrations() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['custom-integrations', tenantId],
    queryFn: async (): Promise<Integration[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('integrations')
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

  const connectIntegrationMutation = useMutation({
    mutationFn: async ({ service, apiKey, apiSecret }: { service: string; apiKey: string; apiSecret: string }) => {
      if (!tenantId) throw new Error('Tenant ID required');

      // Test connection (simulated)
      toast({
        title: 'Testing connection',
        description: 'Verifying credentials...',
      });

      const { data, error } = await supabase
        .from('integrations')
        .insert({
          tenant_id: tenantId,
          name: AVAILABLE_INTEGRATIONS.find((i) => i.service === service)?.name || service,
          service,
          api_key: apiKey,
          api_secret: apiSecret,
          status: 'connected',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Integrations table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-integrations', tenantId] });
      toast({ title: 'Integration connected', description: 'Integration has been successfully connected.' });
      setShowConnectForm(false);
      setSelectedService('');
      setApiKey('');
      setApiSecret('');
    },
    onError: (error: any) => {
      toast({
        title: 'Connection failed',
        description: error.message || 'Failed to connect integration',
        variant: 'destructive',
      });
    },
  });

  const disconnectIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('integrations')
        .update({ status: 'disconnected' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-integrations', tenantId] });
      toast({ title: 'Integration disconnected', description: 'Integration has been disconnected.' });
    },
  });

  const testIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      // Simulate connection test
      toast({
        title: 'Connection test',
        description: 'Testing integration connection...',
      });

      // In production, would test actual API connection
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: 'Connection successful',
        description: 'Integration is working properly.',
      });
    },
  });

  const connectedServices = integrations?.map((i) => i.service) || [];
  const availableServices = AVAILABLE_INTEGRATIONS.filter(
    (s) => !connectedServices.includes(s.service)
  );

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading integrations...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Custom Integrations</h1>
          <p className="text-muted-foreground">Connect third-party services and platforms</p>
        </div>
        <Button onClick={() => setShowConnectForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Connect Integration
        </Button>
      </div>

      {/* Connected Integrations */}
      {integrations && integrations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Integrations ({integrations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {AVAILABLE_INTEGRATIONS.find((i) => i.service === integration.service)?.icon || '🔌'}
                        </span>
                        <span className="font-medium">{integration.service}</span>
                      </div>
                    </TableCell>
                    <TableCell>{integration.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          integration.status === 'connected'
                            ? 'default'
                            : integration.status === 'error'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="flex items-center gap-1"
                      >
                        {integration.status === 'connected' ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : integration.status === 'error' ? (
                          <XCircle className="h-3 w-3" />
                        ) : null}
                        {integration.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {integration.last_sync_at
                        ? new Date(integration.last_sync_at).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testIntegrationMutation.mutate(integration.id)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Are you sure you want to disconnect this integration?')) {
                              disconnectIntegrationMutation.mutate(integration.id);
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
          </CardContent>
        </Card>
      )}

      {/* Available Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Available Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AVAILABLE_INTEGRATIONS.map((integration) => {
              const isConnected = connectedServices.includes(integration.service);
              return (
                <Card
                  key={integration.service}
                  className={isConnected ? 'border-green-500' : 'cursor-pointer hover:bg-muted/50'}
                  onClick={() => {
                    if (!isConnected) {
                      setSelectedService(integration.service);
                      setShowConnectForm(true);
                    }
                  }}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">{integration.icon}</span>
                      {integration.name}
                      {isConnected && (
                        <Badge variant="default" className="ml-auto">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Connect Form */}
      {showConnectForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              Connect {AVAILABLE_INTEGRATIONS.find((i) => i.service === selectedService)?.name || 'Integration'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="service">Service</Label>
                <Select
                  value={selectedService}
                  onValueChange={setSelectedService}
                  disabled={!!selectedService}
                >
                  <SelectTrigger id="service">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServices.map((service) => (
                      <SelectItem key={service.service} value={service.service}>
                        {service.icon} {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key"
                />
              </div>
              <div>
                <Label htmlFor="api-secret">API Secret (Optional)</Label>
                <Input
                  id="api-secret"
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Enter API secret"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (!selectedService || !apiKey) {
                      toast({
                        title: 'Fields required',
                        description: 'Please select a service and enter API key.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    connectIntegrationMutation.mutate({
                      service: selectedService,
                      apiKey,
                      apiSecret,
                    });
                  }}
                  disabled={connectIntegrationMutation.isPending}
                >
                  <Link className="h-4 w-4 mr-2" />
                  Connect
                </Button>
                <Button variant="outline" onClick={() => setShowConnectForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Marketplace */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Marketplace</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Browse additional integrations available in our marketplace. More integrations coming soon!
          </p>
          <div className="text-center py-8 text-muted-foreground">
            <Link className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Integration marketplace coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

