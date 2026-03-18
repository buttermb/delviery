import { logger } from '@/lib/logger';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { listAdminRecords, createAdminRecord, deleteAdminRecord } from '@/utils/adminApiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { toast } from 'sonner';
import { Key, Plus, Copy, Loader2, Trash2 } from 'lucide-react';
import { handleError } from '@/utils/errorHandling/handlers';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  created_at: string;
  permissions: string[];
}

const API_PERMISSIONS = [
  'read:orders',
  'write:orders',
  'read:products',
  'write:products',
  'read:customers',
  'write:customers',
  'read:inventory',
  'write:inventory',
] as const;

const createKeySchema = z.object({
  name: z.string().min(1, 'Key name is required').max(100, 'Key name too long'),
  permissions: z.array(z.string()).min(1, 'Select at least one permission'),
});

export default function ApiAccess() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKeyRecord | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    permissions: [] as string[],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data: apiKeys, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.apiKeys.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await listAdminRecords<ApiKeyRecord>('api_keys');

      if (error) {
        logger.error('Error fetching API keys:', error);
        throw error;
      }

      return data ?? [];
    },
    enabled: !!tenantId,
    retry: 2,
    staleTime: 60_000,
  });

  const createKeyMutation = useMutation({
    mutationFn: async (keyData: { name: string; permissions: string[] }) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await createAdminRecord('api_keys', {
        name: keyData.name,
        key: `sk_${crypto.randomUUID().replace(/-/g, '')}`,
        permissions: keyData.permissions,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.byTenant(tenantId) });
      toast.success('New API key has been generated.');
      resetForm();
    },
    onError: (error: Error) => {
      handleError(error, {
        component: 'ApiAccess.createKey',
        toastTitle: 'Failed to create API key',
        showToast: true,
      });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await deleteAdminRecord('api_keys', keyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.byTenant(tenantId) });
      toast.success('API key has been revoked.');
      setDeleteDialogOpen(false);
      setKeyToDelete(null);
    },
    onError: (error: Error) => {
      handleError(error, {
        component: 'ApiAccess.deleteKey',
        toastTitle: 'Failed to revoke API key',
        showToast: true,
      });
    },
  });

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const handleDeleteClick = (apiKey: ApiKeyRecord) => {
    setKeyToDelete(apiKey);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (keyToDelete) {
      deleteKeyMutation.mutate(keyToDelete.id);
    }
  };

  const togglePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
    setFormErrors((prev) => {
      const { permissions: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = createKeySchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          fieldErrors[field] = issue.message;
        }
      }
      setFormErrors(fieldErrors);
      return;
    }
    setFormErrors({});
    createKeyMutation.mutate(result.data);
  };

  const resetForm = () => {
    setFormData({ name: '', permissions: [] });
    setFormErrors({});
    setIsDialogOpen(false);
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
        <p className="text-destructive">Failed to load API keys. Please try again.</p>
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
        <Button onClick={() => setIsDialogOpen(true)} aria-label="Create new API key">
          <Plus className="h-4 w-4 mr-2" />
          Create API Key
        </Button>
      </div>

      {apiKeys && apiKeys.length > 0 ? (
        <div className="space-y-4">
          {apiKeys.map((apiKey: ApiKeyRecord) => (
            <Card key={apiKey.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    <CardTitle>{apiKey.name || 'Unnamed Key'}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(apiKey.key)}
                      aria-label={`Copy API key ${apiKey.name}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(apiKey)}
                      aria-label={`Revoke API key ${apiKey.name}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Created {formatSmartDate(apiKey.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="font-mono text-sm bg-muted p-2 rounded break-all">
                    {apiKey.key?.slice(0, 20)}...
                  </div>
                  {apiKey.permissions && apiKey.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {apiKey.permissions.map((perm: string) => (
                        <Badge key={perm} variant="secondary">
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
        <EnhancedEmptyState
          type="no_data"
          title="No API Keys"
          description="Generate an API key to integrate external services with your store. Keys are scoped by permission so you can limit access."
          icon={Key}
          primaryAction={{
            label: 'Create API Key',
            onClick: () => setIsDialogOpen(true),
            icon: Plus,
          }}
          compact
          designSystem="tenant-admin"
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Generate a new API key for your application
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="api-key-name">Key Name</Label>
                <Input
                  id="api-key-name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setFormErrors((prev) => {
                      const { name: _, ...rest } = prev;
                      return rest;
                    });
                  }}
                  placeholder="e.g., Production API Key"
                  maxLength={100}
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="grid grid-cols-2 gap-2 p-4 border rounded-lg">
                  {API_PERMISSIONS.map((permission) => (
                    <label key={permission} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                        className="rounded"
                      />
                      <span className="text-sm">{permission}</span>
                    </label>
                  ))}
                </div>
                {formErrors.permissions && (
                  <p className="text-sm text-destructive">{formErrors.permissions}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
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
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Revoke API Key"
        description={keyToDelete ? `Are you sure you want to revoke "${keyToDelete.name}"? Any applications using this key will lose access immediately.` : ''}
        itemName={keyToDelete?.name}
        itemType="API key"
        isLoading={deleteKeyMutation.isPending}
      />
    </div>
  );
}
