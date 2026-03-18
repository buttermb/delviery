import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { SEOHead } from '@/components/SEOHead';
import { BarcodeScanner } from '@/components/inventory/BarcodeScanner';
import { ArrowLeft, Package, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import { useCreditGatedAction } from '@/hooks/useCredits';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ScannedReturn {
  barcode: string;
  condition: 'good' | 'damaged';
  reason?: string;
}

interface FrontedInventory {
  id: string;
  quantity_returned?: number;
  quantity_damaged?: number;
  product_id?: string;
  client_id?: string;
  price_per_unit?: number;
  products?: {
    name?: string;
    sku?: string;
    barcode?: string;
  };
  [key: string]: unknown;
}

export default function RecordFrontedReturn() {
  const { id } = useParams<{ id: string }>();
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [front, setFront] = useState<FrontedInventory | null>(null);
  const [scannedReturns, setScannedReturns] = useState<ScannedReturn[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (tenant?.id) {
      loadFrontDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadFrontDetails is defined below, only run when id/tenant changes
  }, [id, tenant]);

  const loadFrontDetails = async () => {
    if (!tenant?.id) return;
    try {
      const { data, error } = await supabase
        .from('fronted_inventory')
        .select(`
          *,
          products (name, sku, barcode)
        `)
        .eq('id', id)
        .eq('account_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to load fronted inventory details', error, { component: 'RecordFrontedReturn', id });
        toast.error('Failed to load details');
        return;
      }
      setFront(data);
    } catch (error) {
      logger.error('Error loading fronted inventory', error, { component: 'RecordFrontedReturn', id });
      toast.error('Failed to load details');
    }
  };

  const handleScan = (barcode: string) => {
    if (scannedReturns.find((r) => r.barcode === barcode)) {
      toast.error('Item already scanned');
      return;
    }

    setScannedReturns((prev) => [...prev, { barcode, condition: 'good' }]);
    toast.success('Item scanned');
  };

  const updateCondition = (barcode: string, condition: 'good' | 'damaged') => {
    setScannedReturns((prev) =>
      prev.map((r) => (r.barcode === barcode ? { ...r, condition } : r))
    );
  };

  const updateReason = (barcode: string, reason: string) => {
    setScannedReturns((prev) =>
      prev.map((r) => (r.barcode === barcode ? { ...r, reason } : r))
    );
  };

  const removeReturn = (barcode: string) => {
    setScannedReturns((prev) => prev.filter((r) => r.barcode !== barcode));
  };

  const { execute: executeCreditAction } = useCreditGatedAction();

  const handleProcessReturn = async () => {
    if (!tenant?.id) {
      toast.error('Tenant not found');
      return;
    }

    if (!front) {
      toast.error('Fronted inventory data not loaded');
      return;
    }

    if (scannedReturns.length === 0) {
      toast.error('No items scanned');
      return;
    }

    await executeCreditAction('return_process', async () => {
      setProcessing(true);
      try {
        const goodReturns = scannedReturns.filter((r) => r.condition === 'good').length;
        const damagedReturns = scannedReturns.filter((r) => r.condition === 'damaged').length;

        // Try atomic RPC first (handles inventory, balance update, and movement logging)
        const { error: rpcError } = await supabase.rpc('process_fronted_return_atomic', {
          p_fronted_id: id,
          p_good_returns: goodReturns,
          p_damaged_returns: damagedReturns,
          p_notes: notes || null,
        });

        if (rpcError) {
          // If RPC doesn't exist, fall back to legacy method
          if (rpcError.code === 'PGRST202' || rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
            logger.warn('Atomic RPC not available, using legacy method', { component: 'RecordFrontedReturn', code: rpcError.code });

            const { error: updateError } = await supabase
              .from('fronted_inventory')
              .update({
                quantity_returned: (front.quantity_returned ?? 0) + goodReturns,
                quantity_damaged: (front.quantity_damaged ?? 0) + damagedReturns,
              })
              .eq('id', id)
              .eq('account_id', tenant.id);

            if (updateError) throw updateError;

            // Update product inventory for good returns
            if (goodReturns > 0 && front.product_id) {
              const { data: product } = await supabase
                .from('products')
                .select('available_quantity, fronted_quantity')
                .eq('id', front.product_id)
                .eq('tenant_id', tenant.id)
                .maybeSingle();

              if (product) {
                await supabase
                  .from('products')
                  .update({
                    available_quantity: (product.available_quantity ?? 0) + goodReturns,
                    fronted_quantity: Math.max(0, (product.fronted_quantity ?? 0) - goodReturns),
                  })
                  .eq('id', front.product_id)
                  .eq('tenant_id', tenant.id);
              }

              // Update client balance (return value reduces debt)
              if (front.client_id && front.price_per_unit) {
                const returnValue = goodReturns * front.price_per_unit;
                const { error: balanceError } = await supabase.rpc('adjust_client_balance', {
                  p_client_id: front.client_id,
                  p_amount: returnValue,
                  p_operation: 'subtract',
                });

                if (balanceError) {
                  logger.warn('adjust_client_balance RPC failed, falling back to direct update', balanceError, { component: 'RecordFrontedReturn' });
                  const { data: client } = await supabase
                    .from('wholesale_clients')
                    .select('outstanding_balance')
                    .eq('id', front.client_id)
                    .eq('tenant_id', tenant.id)
                    .maybeSingle();

                  if (client) {
                    const newBalance = Math.max(0, (client.outstanding_balance ?? 0) - returnValue);
                    await supabase
                      .from('wholesale_clients')
                      .update({ outstanding_balance: newBalance })
                      .eq('id', front.client_id)
                      .eq('tenant_id', tenant.id);
                  }
                }
              }
            }
          } else {
            throw rpcError;
          }
        }

        // Batch insert scan records
        const scanRecords = scannedReturns.map((returnItem) => ({
          account_id: tenant.id,
          fronted_inventory_id: id,
          product_id: front.product_id,
          barcode: returnItem.barcode,
          scan_type: returnItem.condition === 'good' ? 'return' : 'damage',
          quantity: 1,
          notes: returnItem.reason || notes,
        }));

        const { error: scanError } = await supabase
          .from('fronted_inventory_scans')
          .insert(scanRecords);

        if (scanError) {
          logger.error('Failed to create scan records', scanError, { component: 'RecordFrontedReturn', id });
        }

        // Invalidate related queries
        await queryClient.invalidateQueries({ queryKey: queryKeys.frontedInventory.detail(id!) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.frontedInventory.lists() });

        toast.success(
          `Return processed: ${goodReturns} returned to inventory, ${damagedReturns} marked as damaged`
        );
        navigateToAdmin(`inventory/fronted/${id}`);
      } catch (error: unknown) {
        logger.error('Failed to process return', error, { component: 'RecordFrontedReturn', id });
        toast.error('Failed to process return: ' + humanizeError(error, 'Unknown error'));
      } finally {
        setProcessing(false);
      }
    });
  };

  if (!front) return <EnhancedLoadingState variant="card" message="Loading return details..." />;

  const goodReturns = scannedReturns.filter((r) => r.condition === 'good').length;
  const damagedReturns = scannedReturns.filter((r) => r.condition === 'damaged').length;

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead title="Scan Returns | Inventory Management" />

      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigateToAdmin(`inventory/fronted/${id}`)} aria-label="Back to fronted inventory details">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold">Scan Returns</h1>
            <p className="text-muted-foreground">
              {front.products?.name} &bull; Front #{id?.slice(0, 8)}
            </p>
          </div>
        </div>

        {/* Scanner */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Scan Returned Items</CardTitle>
            <Button onClick={() => setIsScanning(!isScanning)}>
              {isScanning ? 'Stop Scanning' : 'Start Scanning'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isScanning && (
              <div className="border-2 border-dashed rounded-lg p-4">
                <BarcodeScanner onScan={handleScan} />
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold">{scannedReturns.length}</p>
                <p className="text-sm text-muted-foreground">Total Scanned</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{goodReturns}</p>
                <p className="text-sm text-muted-foreground">Good Condition</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{damagedReturns}</p>
                <p className="text-sm text-muted-foreground">Damaged</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scanned Items */}
        {scannedReturns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Scanned Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {scannedReturns.map((returnItem) => (
                <div
                  key={returnItem.barcode}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {returnItem.condition === 'good' ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-6 w-6 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="font-medium">{returnItem.barcode}</p>
                      <Badge variant={returnItem.condition === 'good' ? 'default' : 'destructive'}>
                        {returnItem.condition.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <Label>Condition</Label>
                      <Select
                        value={returnItem.condition}
                        onValueChange={(value: 'good' | 'damaged') =>
                          updateCondition(returnItem.barcode, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">Good - Return to Inventory</SelectItem>
                          <SelectItem value="damaged">Damaged - Write Off</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {returnItem.condition === 'damaged' && (
                      <div className="space-y-2">
                        <Label>Reason for Damage</Label>
                        <Input
                          placeholder="e.g., Package opened, expired, broken seal..."
                          value={returnItem.reason || ''}
                          onChange={(e) => updateReason(returnItem.barcode, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeReturn(returnItem.barcode)}
                    aria-label="Remove return item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any additional notes about these returns..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => navigateToAdmin(`inventory/fronted/${id}`)}>
            Cancel
          </Button>
          <Button onClick={handleProcessReturn} disabled={scannedReturns.length === 0 || processing}>
            <Package className="h-4 w-4 mr-2" />
            {processing ? 'Processing...' : `Process ${scannedReturns.length} Returns`}
          </Button>
        </div>
      </div>
    </div>
  );
}
