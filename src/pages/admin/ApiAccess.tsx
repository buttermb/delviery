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
import { Plus, Trash2, Copy, Eye, EyeOff, Key, Activity } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  key_hash?: string;
  last_used_at?: string;
  created_at: string;
  expires_at?: string;
  status: 'active' | 'revoked';
}

interface ApiUsage {
  date: string;
  requests: number;
  endpoint: string;
}

export default function ApiAccess() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const { data: apiKeys, isLoading } = useQuery({
    queryKey: ['api-keys', tenantId],
    queryFn: async (): Promise<ApiKey[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('api_keys')
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

  const { data: apiUsage } = useQuery({
    queryKey: ['api-usage', tenantId],
    queryFn: async (): Promise<ApiUsage[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('api_usage_logs')
          .select('created_at, endpoint')
          .eq('tenant_id', tenantId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1000);

        if (error && error.code === '42P01') {
          return [];
        }
        if (error) throw error;

        // Aggregate by date
        const usageByDate: Record<string, { requests: number; endpoints: Set<string> }> = {};
        data?.forEach((log: any) => {
          const date = new Date(log.created_at).toLocaleDateString();
          if (!usageByDate[date]) {
            usageByDate[date] = { requests: 0, endpoints: new Set() };
          }
          usageByDate[date].requests++;
          usageByDate[date].endpoints.add(log.endpoint || 'unknown');
        });

        return Object.entries(usageByDate).map(([date, data]) => ({
          date,
          requests: data.requests,
          endpoint: Array.from(data.endpoints).join(', '),
        }));
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const generateApiKey = () => {
    const prefix = `sk_live_${tenantId?.slice(0, 8)}`;
    const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${prefix}_${randomPart}`;
  };

  const createApiKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const fullKey = generateApiKey();
      const keyHash = await hashKey(fullKey);

      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: tenantId,
          name,
          key_prefix: fullKey.slice(0, 20) + '...',
          key_hash: keyHash,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('API keys table does not exist. Please run database migrations.');
        }
        throw error;
      }

      return { data, fullKey };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', tenantId] });
      setGeneratedKey(result.fullKey);
      setShowCreateForm(false);
      setNewKeyName('');
      toast({
        title: 'API Key Created',
        description: 'Make sure to copy the key now. It will not be shown again.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create API key',
        variant: 'destructive',
      });
    },
  });

  const revokeApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('api_keys')
        .update({ status: 'revoked' })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', tenantId] });
      toast({ title: 'API Key Revoked', description: 'API key has been revoked.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke API key',
        variant: 'destructive',
      });
    },
  });

  const hashKey = async (key: string): Promise<string> => {
    // Simplified - would use proper hashing in production
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'API key copied to clipboard.' });
  };

  const totalRequests = apiUsage?.reduce((sum, u) => sum + u.requests, 0) || 0;
  const activeKeys = apiKeys?.filter((k) => k.status === 'active').length || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading API access...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">API Access</h1>
          <p className="text-muted-foreground">Manage API keys and monitor usage</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeKeys}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">API Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiUsage ? new Set(apiUsage.map((u) => u.endpoint.split(', ')).flat()).size : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generated Key Display */}
      {generatedKey && (
        <Card className="border-green-500 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">New API Key Created</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono">{generatedKey}</code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedKey)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
            <div className="text-sm text-yellow-800 bg-yellow-50 p-3 rounded-lg">
              ⚠️ Important: Save this key in a secure location. You will not be able to view it again.
            </div>
            <Button onClick={() => setGeneratedKey(null)} className="w-full">
              I've Saved the Key
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create API Key Form */}
      {showCreateForm && !generatedKey && (
        <Card>
          <CardHeader>
            <CardTitle>Create New API Key</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (!newKeyName.trim()) {
                      toast({
                        title: 'Name required',
                        description: 'Please enter a name for the API key.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    createApiKeyMutation.mutate(newKeyName);
                  }}
                  disabled={createApiKeyMutation.isPending}
                >
                  Generate Key
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>API Keys ({apiKeys?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeys && apiKeys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs font-mono">{key.key_prefix}</code>
                    </TableCell>
                    <TableCell>
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>{new Date(key.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={key.status === 'active' ? 'default' : 'secondary'}>
                        {key.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {key.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm('Are you sure you want to revoke this API key?')) {
                              revokeApiKeyMutation.mutate(key.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {apiKeys !== undefined
                ? 'No API keys created yet. Create your first API key to get started.'
                : 'API keys table not found. Please run database migrations.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Base URL</h3>
              <code className="block p-2 bg-muted rounded text-sm">
                {import.meta.env.VITE_SUPABASE_URL || 'https://api.example.com'}/v1
              </code>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Authentication</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Include your API key in the Authorization header:
              </p>
              <code className="block p-2 bg-muted rounded text-sm">
                Authorization: Bearer YOUR_API_KEY
              </code>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Available Endpoints</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>GET /orders - List orders</li>
                <li>POST /orders - Create order</li>
                <li>GET /products - List products</li>
                <li>GET /customers - List customers</li>
                <li>POST /deliveries - Create delivery</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Logs */}
      {apiUsage && apiUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent API Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Endpoints</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiUsage.slice(0, 10).map((usage, index) => (
                  <TableRow key={index}>
                    <TableCell>{usage.date}</TableCell>
                    <TableCell className="font-bold">{usage.requests}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{usage.endpoint}</TableCell>
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

