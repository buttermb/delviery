import { logger } from '@/lib/logger';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { listAdminRecords, createAdminRecord } from '@/utils/adminApiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Key, Plus, Copy, Loader2 } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { humanizeError } from '@/lib/humanizeError';
import { formatSmartDate } from '@/lib/formatters';

export default function ApiAccess() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    permissions: [] as string[],
  });

  const { data: apiKeys, isLoading, error, refetch } = useQuery({
    queryKey: ['api-keys', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await listAdminRecords('api_keys');
      
      if (error) {
        logger.error('Error fetching API keys:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!tenantId,
  });

  const createKeyMutation = useMutation({
    mutationFn: async (keyData: any) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await createAdminRecord('api_keys', {
        name: keyData.name,
        key: `sk_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`,
        permissions: keyData.permissions || [],
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', tenantId] });
      toast.success("New API key has been generated.");
      setFormData({ name: '', permissions: [] });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error("Error");
    },
  });

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API key copied to clipboard");
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">API Access</h1>
          <p className="text-muted-foreground">Manage API keys and access tokens</p>
        </div>
        <EnhancedLoadingState variant="card" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive">Failed to load data. Please try again.</p>
        <Button variant="outline" onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">API Access</h1>
          <p className="text-muted-foreground">Manage API keys and access tokens</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {apiKeys && apiKeys.length > 0 ? (
        <div className="space-y-4">
          {apiKeys.map((key: any) => (
            <Card key={key.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    <CardTitle>{key.name || 'Unnamed Key'}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(key.key)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Created {formatSmartDate(key.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="font-mono text-sm bg-muted p-2 rounded break-all">
                    {key.key?.slice(0, 20)}...
                  </div>
                  {key.permissions && key.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {key.permissions.map((perm: string, idx: number) => (
                        <Badge key={idx} variant="secondary">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys found. Create your first API key to get started.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for your application
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Key Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Production API Key"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createKeyMutation.mutate(formData)}
              disabled={createKeyMutation.isPending}
            >
              {createKeyMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {createKeyMutation.isPending ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

