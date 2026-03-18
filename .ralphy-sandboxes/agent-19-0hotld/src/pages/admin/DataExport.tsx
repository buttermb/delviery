import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { formatSmartDate } from '@/lib/formatters';
import { Download } from 'lucide-react';
import { DisabledTooltip } from '@/components/shared/DisabledTooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";

import { CreditCostBadge, CreditCostIndicator, useCreditConfirm, CreditConfirmDialog } from '@/components/credits';
import { useCredits } from '@/hooks/useCredits';
import { queryKeys } from '@/lib/queryKeys';

export default function DataExport() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const [exportType, setExportType] = useState<string>('');
  const [format, setFormat] = useState<string>('csv');
  const { isFreeTier, performAction } = useCredits();

  const { data: exportHistory, isLoading: historyLoading } = useQuery({
    queryKey: queryKeys.dataExport.history(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('data_exports')
          .select('id, data_type, format, created_at, status')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const handleExport = async () => {
    if (!exportType) {
      toast.error("Please select a data type to export");
      return;
    }

    if (!tenantId) return;

    // Consume credits for export action
    const actionKey = format === 'csv' ? 'export_csv' : 'export_pdf';
    if (isFreeTier) {
      const result = await performAction(actionKey, undefined, 'export');
      if (!result.success) {
        toast.error("Insufficient Credits");
        return;
      }
    }

    try {
      toast.success(`Preparing ${exportType} export...`);

      // 1. Create Job Record
      const { data: job, error: dbError } = await supabase
        .from('data_exports')
        .insert({
          tenant_id: tenantId,
          // user_id: auth.user.id, // need auth context but let's rely on RLS/defaults or ignore if not critical
          data_type: exportType,
          format: format,
          status: 'pending'
        })
        .select()
        .maybeSingle();

      if (dbError) throw dbError;

      // 2. Invoke Edge Function (Async Trigger)
      const { data: invokeData, error: invokeError } = await supabase.functions.invoke('process-data-export', {
        body: { exportId: job.id }
      });

      if (invokeError) {
        logger.error("Failed to trigger export function", invokeError);
        toast.success("Export job created but processing might be delayed.");
      } else if (invokeData && typeof invokeData === 'object' && 'error' in invokeData && invokeData.error) {
        // Check for error in response body (edge functions can return 200 with error)
        const errorMessage = typeof invokeData.error === 'string' ? invokeData.error : 'Export processing failed';
        logger.error("Export function returned error in response", { error: errorMessage });
        toast.error("Export Failed");
      } else {
        toast.success("Your export is running in the background. It will appear in the history list below when complete.");
      }

      // Refresh history
      /* refetch() if we had the query handle handy, but react-query will re-fetch on window focus 
         or we can invalidate queries */

    } catch (error: unknown) {
      logger.error("Export initiation failed", error);
      toast.error("Export Failed");
    }
  };

  // Credit confirmation for exports
  const { trigger: triggerExport, dialogProps } = useCreditConfirm({
    actionKey: format === 'csv' ? 'export_csv' : 'export_pdf',
    actionDescription: `Export ${exportType || 'data'} as ${format.toUpperCase()}`,
    onConfirm: handleExport,
  });

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Data Export</h1>
        <p className="text-muted-foreground">Export your data in various formats</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
            <CardDescription>Select data type and format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Type</label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="deliveries">Deliveries</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Export Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Credit cost indicator for free tier users */}
            {isFreeTier && exportType && (
              <CreditCostIndicator actionKey={format === 'csv' ? 'export_csv' : 'export_pdf'} />
            )}

            <DisabledTooltip disabled={!exportType} reason="Select a data type to export">
              <Button onClick={triggerExport} className="w-full" disabled={!exportType}>
                <Download className="h-4 w-4 mr-2" />
                Export Data
                {isFreeTier && <CreditCostBadge actionKey={format === 'csv' ? 'export_csv' : 'export_pdf'} className="ml-2" />}
              </Button>
            </DisabledTooltip>
          </CardContent>
        </Card>

        {/* Credit confirmation dialog */}
        <CreditConfirmDialog {...dialogProps} />

        <Card>
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <CardDescription>Recent export operations</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-12 rounded-full" />
                  </div>
                ))}
              </div>
            ) : exportHistory && exportHistory.length > 0 ? (
              <div className="space-y-2">
                {exportHistory.map((exportItem) => (
                  <div key={exportItem.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{exportItem.data_type || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatSmartDate(exportItem.created_at, { includeTime: true })}
                      </div>
                    </div>
                    <Badge>{exportItem.format || 'csv'}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No export history. Exports will appear here once you start exporting data.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

