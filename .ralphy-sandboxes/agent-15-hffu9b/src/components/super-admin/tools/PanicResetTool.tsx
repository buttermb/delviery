// @ts-nocheck
/**
 * Panic Reset Tool Component
 * Allows super admins to reset tenant data with confirmation
 */

import { logger } from '@/lib/logger';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { callAdminFunction } from '@/utils/adminFunctionHelper';
import { supabase } from '@/integrations/supabase/client';

export function PanicResetTool() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [resetType, setResetType] = useState<string>('orders');
  const [confirmation, setConfirmation] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  // Fetch tenants
  const { data: tenants } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, business_name, slug')
        .order('business_name');

      if (error) throw error;
      return data || [];
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const { data, error } = await callAdminFunction({
        functionName: 'panic-reset',
        body: { action: 'preview', tenant_id: tenantId },
        errorMessage: 'Failed to load preview',
        showToast: false,
      });

      if (error) throw error;
      return data;
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async ({ tenantId, resetType }: { tenantId: string; resetType: string }) => {
      const { data, error } = await callAdminFunction({
        functionName: 'panic-reset',
        body: {
          action: 'reset',
          tenant_id: tenantId,
          reset_type: resetType,
          confirmation: 'CONFIRM_RESET',
        },
        errorMessage: 'Failed to reset data',
        showToast: false,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Reset Complete',
        description: data?.message || 'Data has been reset successfully',
      });
      setConfirmation('');
      setShowPreview(false);
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
    onError: (error: unknown) => {
      logger.error('Panic reset error', error);
      toast({
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'An error occurred during reset',
        variant: 'destructive',
      });
    },
  });

  const handlePreview = () => {
    if (!selectedTenantId) {
      toast({
        title: 'Select Tenant',
        description: 'Please select a tenant first',
        variant: 'destructive',
      });
      return;
    }
    setShowPreview(true);
    previewMutation.mutate(selectedTenantId);
  };

  const handleReset = () => {
    if (!selectedTenantId) {
      toast({
        title: 'Select Tenant',
        description: 'Please select a tenant first',
        variant: 'destructive',
      });
      return;
    }

    if (confirmation !== 'CONFIRM_RESET') {
      toast({
        title: 'Confirmation Required',
        description: 'Please type CONFIRM_RESET to proceed',
        variant: 'destructive',
      });
      return;
    }

    resetMutation.mutate({ tenantId: selectedTenantId, resetType });
  };

  const selectedTenant = tenants?.find((t) => t.id === selectedTenantId);

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle>Panic Reset Tool</CardTitle>
        </div>
        <CardDescription>
          <strong className="text-destructive">DANGER:</strong> This will permanently delete tenant data.
          Use with extreme caution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tenant-select">Select Tenant</Label>
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger id="tenant-select">
              <SelectValue placeholder="Choose a tenant..." />
            </SelectTrigger>
            <SelectContent>
              {tenants?.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.business_name} ({tenant.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-type">Reset Type</Label>
          <Select value={resetType} onValueChange={setResetType}>
            <SelectTrigger id="reset-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="orders">Orders Only</SelectItem>
              <SelectItem value="inventory">Inventory Only</SelectItem>
              <SelectItem value="deliveries">Deliveries Only</SelectItem>
              <SelectItem value="invoices">Invoices Only</SelectItem>
              <SelectItem value="all">All Data (Orders, Inventory, Deliveries, Invoices)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!selectedTenantId || previewMutation.isPending}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMutation.isPending ? 'Loading...' : 'Preview'}
          </Button>
        </div>

        {showPreview && previewMutation.data && (
          <Alert>
            <AlertTitle>Preview: {previewMutation.data.tenant?.business_name}</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1">
                {Object.entries(previewMutation.data.preview || {}).map(([table, count]) => (
                  <div key={table} className="flex justify-between text-sm">
                    <span className="font-mono text-xs">{table}</span>
                    <Badge variant={(count as number) > 0 ? 'destructive' : 'outline'}>{count as number} records</Badge>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {selectedTenant && (
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="confirmation">
              Type <code className="text-destructive font-bold">CONFIRM_RESET</code> to proceed:
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="CONFIRM_RESET"
              className="font-mono"
            />
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={confirmation !== 'CONFIRM_RESET' || resetMutation.isPending}
              className="w-full"
            >
              {resetMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset {resetType === 'all' ? 'All Data' : resetType}
                </>
              )}
            </Button>
          </div>
        )}

        {resetMutation.data && (
          <Alert className="mt-4">
            <AlertTitle>Reset Complete</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-1 text-sm">
                {Object.entries(resetMutation.data.results || {}).map(([table, result]: [string, any]) => (
                  <div key={table} className="flex justify-between">
                    <span className="font-mono text-xs">{table}</span>
                    <Badge variant={result.deleted > 0 ? 'default' : 'outline'}>
                      {result.deleted} deleted
                    </Badge>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

