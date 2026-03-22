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
import { Key, Plus, Copy, Loader2, Coins } from 'lucide-react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { humanizeError } from '@/lib/humanizeError';
import { formatSmartDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';
import { useCredits } from '@/hooks/useCredits';
import { CreditCostBadge } from '@/components/credits/CreditCostBadge';
import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal';
import { useCreditGatedAction } from '@/hooks/useCreditGatedAction';

/** Per-call credit costs by HTTP method for API endpoints */
const API_ENDPOINT_COSTS = [
  { method: 'GET', cost: 1, description: 'Read operations (list, fetch details)', variant: 'secondary' as const },
  { method: 'POST', costRange: '5–25', cost: 5, description: 'Create operations (orders, products, menus)', variant: 'default' as const },
  { method: 'PUT', cost: 3, description: 'Update operations (edit records)', variant: 'secondary' as const },
  { method: 'DELETE', cost: 1, description: 'Delete operations (remove records)', variant: 'outline' as const },
] as const;

export default function ApiAccess() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    permissions: [] as string[],
  });

  const { isFreeTier, balance } = useCredits();
  const {
    execute,
    isExecuting,
    showOutOfCreditsModal,
    closeOutOfCreditsModal,
    blockedAction,
  } = useCreditGatedAction();

  const { data: apiKeys, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.apiKeys.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await listAdminRecords('api_keys');

      if (error) {
        logger.error('Error fetching API keys:', error);
        return [];
      }

      return data ?? [];
    },
    enabled: !!tenantId,
    retry: 2,
  });

  const createKeyMutation = useMutation({
    mutationFn: async (keyData: { name: string; permissions: string[] }) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await createAdminRecord('api_keys', {
        name: keyData.name,
        key: `sk_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`,
        permissions: keyData.permissions ?? [],
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.byTenant(tenantId) });
      toast.success("New API key has been generated.");
      setFormData({ name: '', permissions: [] });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create API key: ${humanizeError(error)}`);
    },
  });

  const handleCreateKey = () => {
    execute({
      actionKey: 'api_call',
      action: async () => {
        createKeyMutation.mutate(formData);
      },
      onSuccess: () => {
        logger.info('API key creation credit-gated action succeeded');
      },
    });
  };

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
        <div className="flex items-center gap-2">
          <CreditCostBadge actionKey="api_call" showTooltip />
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create API Key
          </Button>
        </div>
      </div>

      {isFreeTier && (
        <Card data-testid="api-cost-reference">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Per-Call API Costs</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Each API call consumes credits based on the HTTP method. Current balance: {balance.toLocaleString()} credits.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {API_ENDPOINT_COSTS.map((endpoint) => (
                <div
                  key={endpoint.method}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg bg-muted/50 text-center"
                  data-testid={`api-cost-${endpoint.method.toLowerCase()}`}
                >
                  <Badge variant={endpoint.variant} className="font-mono text-xs">
                    {endpoint.method}
                  </Badge>
                  <span className="text-lg font-bold">
                    {'costRange' in endpoint ? endpoint.costRange : endpoint.cost}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {endpoint.description}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Example: 1,000 GET calls = 1,000 credits · 100 POST calls = 500–2,500 credits
            </p>
          </CardContent>
        </Card>
      )}

      {apiKeys && apiKeys.length > 0 ? (
        <div className="space-y-4">
          {apiKeys.map((key: { id: string; name: string; key: string; created_at: string; permissions: string[] }) => (
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
              onClick={handleCreateKey}
              disabled={createKeyMutation.isPending || isExecuting}
            >
              {(createKeyMutation.isPending || isExecuting) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {(createKeyMutation.isPending || isExecuting) ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OutOfCreditsModal
        open={showOutOfCreditsModal}
        onOpenChange={closeOutOfCreditsModal}
        actionAttempted={blockedAction ?? undefined}
      />
    </div>
  );
}
