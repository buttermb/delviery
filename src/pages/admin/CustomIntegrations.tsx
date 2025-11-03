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
import { useToast } from '@/hooks/use-toast';
import { Plug, Plus, Edit, Trash2 } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  type: string;
  config: any;
  status: string;
  created_at: string;
}

const INTEGRATION_TYPES = [
  { value: 'payment', label: 'Payment Gateway' },
  { value: 'shipping', label: 'Shipping Provider' },
  { value: 'email', label: 'Email Service' },
  { value: 'sms', label: 'SMS Service' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'other', label: 'Other' },
];

export default function CustomIntegrations() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    api_key: '',
    api_secret: '',
    config: {},
  });

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['custom-integrations', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('custom_integrations')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createIntegrationMutation = useMutation({
    mutationFn: async (integration: Partial<Integration>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('custom_integrations')
        .insert({
          tenant_id: tenantId,
          name: integration.name,
          type: integration.type,
          config: {
            api_key: formData.api_key,
            api_secret: formData.api_secret,
            ...formData.config,
          },
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Custom integrations table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-integrations', tenantId] });
      toast({ title: 'Integration created', description: 'Custom integration has been created.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create integration',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: '',
      api_key: '',
      api_secret: '',
      config: {},
    });
    setEditingIntegration(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (integration: Integration) => {
    setEditingIntegration(integration);
    setFormData({
      name: integration.name,
      type: integration.type,
      api_key: integration.config?.api_key || '',
      api_secret: integration.config?.api_secret || '',
      config: integration.config || {},
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createIntegrationMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading integrations...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Custom Integrations</h1>
          <p className="text-muted-foreground">Connect third-party services and APIs</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      {integrations && integrations.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration: any) => (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plug className="h-5 w-5" />
                    <CardTitle>{integration.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(integration)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>{integration.type}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                      {integration.status || 'pending'}
                    </Badge>
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
              <Plug className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No integrations configured. Add your first integration to get started.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingIntegration ? 'Edit Integration' : 'Add Integration'}</DialogTitle>
            <DialogDescription>
              Configure a new third-party integration
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Integration Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Integration Type</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  <option value="">Select type</option>
                  {INTEGRATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_key">API Key</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_secret">API Secret</Label>
                <Input
                  id="api_secret"
                  type="password"
                  value={formData.api_secret}
                  onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={createIntegrationMutation.isPending}>
                {editingIntegration ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

