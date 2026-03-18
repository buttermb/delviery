import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarcodeScanner } from '@/components/inventory/BarcodeScanner';
import { SmartClientPicker } from '@/components/wholesale/SmartClientPicker';
import { Trash2, DollarSign, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { toast } from 'sonner';
import { calculateExpectedProfit } from '@/utils/barcodeHelpers';
import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { useCreditGatedAction } from '@/hooks/useCredits';
import { formatCurrency } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

interface ScannedProduct {
  barcode: string;
  product_id: string;
  product_name: string;
  quantity: number;
  cost_per_unit: number;
  price_per_unit: number;
}

interface SelectedClient {
  id: string;
  business_name: string;
  contact_name: string;
  credit_limit: number;
  outstanding_balance: number;
  status: string;
  phone?: string;
  email?: string;
}

// Preset payment due date options
const PAYMENT_DUE_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
] as const;

export default function DispatchInventory() {
  const [searchParams] = useSearchParams();
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const { execute: executeCreditAction } = useCreditGatedAction();
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(null);
  const [dealType, setDealType] = useState('fronted');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [selectedDuePreset, setSelectedDuePreset] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-select client if passed via URL params
  const preselectedClientId = searchParams.get('clientId');

  // Fetch pre-selected client if URL param exists
  const { data: preselectedClient } = useQuery({
    queryKey: queryKeys.preselectedClient.byId(preselectedClientId),
    queryFn: async () => {
      if (!preselectedClientId || !tenant?.id) return null;
      const { data, error } = await supabase
        .from('wholesale_clients')
        .select('id, business_name, contact_name, credit_limit, outstanding_balance, status, phone, email')
        .eq('id', preselectedClientId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (error) throw error;
      return data as SelectedClient | null;
    },
    enabled: !!preselectedClientId && !!tenant?.id,
  });

  // Set pre-selected client when data loads
  useEffect(() => {
    if (preselectedClient && !selectedClient) {
      setSelectedClient(preselectedClient);
    }
  }, [preselectedClient, selectedClient]);

  // Handle payment due preset selection
  const handleDuePresetSelect = (days: number) => {
    setSelectedDuePreset(days);
    const dueDate = addDays(new Date(), days);
    setPaymentDueDate(format(dueDate, 'yyyy-MM-dd'));
  };

  const handleBarcodeScan = async (barcode: string) => {
    if (!tenant) return;
    try {
      const result = await supabase
        .from('products')
        .select('id, name, cost_per_unit, wholesale_price')
        .eq('barcode', barcode)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      const product = result.data;
      const error = result.error;

      if (error || !product) {
        toast.error("No product found with barcode: ${barcode}");
        return;
      }

      // Check if already scanned
      const existing = scannedProducts.find(p => p.barcode === barcode);
      if (existing) {
        // Increment quantity
        setScannedProducts(prev =>
          prev.map(p =>
            p.barcode === barcode
              ? { ...p, quantity: p.quantity + 1 }
              : p
          )
        );
      } else {
        // Add new product
        setScannedProducts(prev => [
          ...prev,
          {
            barcode,
            product_id: product.id,
            product_name: product.name,
            quantity: 1,
            cost_per_unit: product.cost_per_unit ?? 0,
            price_per_unit: product.wholesale_price ?? 0
          }
        ]);
      }

      toast.success("${product.name} added to dispatch");
    } catch (error) {
      logger.error('Error scanning product:', error);
      toast.error("Failed to scan product");
    }
  };

  const handleQuantityChange = (barcode: string, newQuantity: number) => {
    setScannedProducts(prev =>
      prev.map(p =>
        p.barcode === barcode
          ? { ...p, quantity: Math.max(1, newQuantity) }
          : p
      )
    );
  };

  const handlePriceChange = (barcode: string, newPrice: number) => {
    setScannedProducts(prev =>
      prev.map(p =>
        p.barcode === barcode
          ? { ...p, price_per_unit: newPrice }
          : p
      )
    );
  };

  const removeProduct = (barcode: string) => {
    setScannedProducts(prev => prev.filter(p => p.barcode !== barcode));
  };

  const calculateTotals = () => {
    const totals = scannedProducts.reduce(
      (acc, product) => {
        const { expectedRevenue, totalCost, expectedProfit } = calculateExpectedProfit(
          product.quantity,
          product.cost_per_unit,
          product.price_per_unit
        );
        return {
          totalUnits: acc.totalUnits + product.quantity,
          totalRevenue: acc.totalRevenue + expectedRevenue,
          totalCost: acc.totalCost + totalCost,
          totalProfit: acc.totalProfit + expectedProfit
        };
      },
      { totalUnits: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0 }
    );

    return {
      ...totals,
      profitMargin: totals.totalCost > 0 ? (totals.totalProfit / totals.totalCost) * 100 : 0
    };
  };

  const handleDispatch = async () => {
    if (scannedProducts.length === 0) {
      toast.error("Please scan products to dispatch");
      return;
    }

    if (!selectedClient) {
      toast.error("Please select a client to front inventory to");
      return;
    }

    if (!paymentDueDate) {
      toast.error("Please select a payment due date");
      return;
    }

    if (!tenant) return;

    await executeCreditAction('dispatch_create', async () => {
      setLoading(true);

      try {
        // Prepare items for atomic RPC
        const items = scannedProducts.map((product) => ({
          product_id: product.product_id,
          quantity: product.quantity,
          cost_per_unit: product.cost_per_unit,
          price_per_unit: product.price_per_unit
        }));

        // Try atomic RPC first (preferred method - prevents race conditions)
        const { data: rpcResult, error: rpcError } = await supabase.rpc('create_fronted_inventory_atomic', {
          p_tenant_id: tenant.id,
          p_client_id: selectedClient.id,
          p_items: items,
          p_payment_due_date: paymentDueDate,
          p_notes: notes || null,
          p_deal_type: dealType
        });

        if (rpcError) {
          // If RPC doesn't exist yet, fall back to legacy method
          if (rpcError.code === 'PGRST202' || rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
            logger.warn('Atomic RPC not available, using legacy method');
            await handleDispatchLegacy();
            return;
          }
          throw rpcError;
        }

        // RPC succeeded
        const _result = rpcResult as { success: boolean; total_expected_revenue: number; client_name: string };

        // Create scan records for audit trail
        for (const product of scannedProducts) {
          await supabase.from('fronted_inventory_scans').insert({
            account_id: tenant.id,
            product_id: product.product_id,
            barcode: product.barcode,
            scan_type: 'dispatch',
            quantity: product.quantity,
          });
        }

        toast.success("${calculateTotals().totalUnits} units dispatched to ${result.client_name}. Expected revenue: ${formatCurrency(result.total_expected_revenue)}");

        navigateToAdmin('inventory/fronted');
      } catch (error) {
        logger.error('Error dispatching inventory:', error);
        toast.error("Failed to dispatch inventory. Please try again.");
      } finally {
        setLoading(false);
      }
    });
  };

  // Legacy dispatch method (fallback if atomic RPC not available)
  const handleDispatchLegacy = async () => {
    if (!tenant || !selectedClient) return;

    // Calculate total expected revenue for balance update
    const totalExpectedRevenue = scannedProducts.reduce((sum, product) => {
      const { expectedRevenue } = calculateExpectedProfit(
        product.quantity,
        product.cost_per_unit,
        product.price_per_unit
      );
      return sum + expectedRevenue;
    }, 0);

    // Create fronted inventory records for each product
    const promises = scannedProducts.map(async (product) => {
      const { expectedRevenue, expectedProfit } = calculateExpectedProfit(
        product.quantity,
        product.cost_per_unit,
        product.price_per_unit
      );

      const { error } = await supabase.from('fronted_inventory').insert({
        account_id: tenant.id,
        product_id: product.product_id,
        quantity_fronted: product.quantity,
        client_id: selectedClient.id,
        fronted_to_customer_name: selectedClient.business_name,
        deal_type: dealType,
        cost_per_unit: product.cost_per_unit,
        price_per_unit: product.price_per_unit,
        expected_revenue: expectedRevenue,
        expected_profit: expectedProfit,
        payment_due_date: paymentDueDate,
        notes
      });

      if (error) throw error;

      // Create scan record
      await supabase.from('fronted_inventory_scans').insert({
        account_id: tenant.id,
        product_id: product.product_id,
        barcode: product.barcode,
        scan_type: 'dispatch',
        quantity: product.quantity,
      });

      // Update product fronted quantity
      interface ProductQuantity {
        fronted_quantity?: number | null;
        available_quantity?: number | null;
      }
      const { data: currentProduct } = await supabase
        .from('products')
        .select('fronted_quantity, available_quantity')
        .eq('id', product.product_id)
        .maybeSingle() as { data: ProductQuantity | null };

      if (currentProduct) {
        await supabase
          .from('products')
          .update({
            fronted_quantity: (currentProduct.fronted_quantity ?? 0) + product.quantity,
            available_quantity: Math.max(0, (currentProduct.available_quantity ?? 0) - product.quantity)
          })
          .eq('id', product.product_id)
          .eq('tenant_id', tenant.id);
      }
    });

    await Promise.all(promises);

    // Update client's outstanding balance using atomic RPC if available, else direct update
    const { error: balanceError } = await supabase.rpc('adjust_client_balance', {
      p_client_id: selectedClient.id,
      p_amount: totalExpectedRevenue,
      p_operation: 'add'
    });

    if (balanceError) {
      // Fallback to direct update
      const newOutstandingBalance = (selectedClient.outstanding_balance ?? 0) + totalExpectedRevenue;
      await supabase
        .from('wholesale_clients')
        .update({ outstanding_balance: newOutstandingBalance })
        .eq('id', selectedClient.id)
        .eq('tenant_id', tenant.id);
    }

    toast.success("${calculateTotals().totalUnits} units dispatched to ${selectedClient.business_name}");

    navigateToAdmin('inventory/fronted');
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead
        title="Dispatch Inventory | Inventory Management"
        description="Front products to drivers or locations"
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-xl font-bold">Dispatch/Front Inventory</h1>
        </div>

        {/* Step 1: Scan Products */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 1: Scan Products</CardTitle>
          </CardHeader>
          <CardContent>
            <BarcodeScanner onScan={handleBarcodeScan} />

            {scannedProducts.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-semibold">Scanned Items ({totals.totalUnits} units)</h3>
                {scannedProducts.map((product) => (
                  <div key={product.barcode} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{product.product_name}</p>
                      <p className="text-sm text-muted-foreground">{product.barcode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={product.quantity}
                        onChange={(e) => handleQuantityChange(product.barcode, parseInt(e.target.value) || 1)}
                        aria-label={`Quantity for ${product.product_name}`}
                        className="w-20"
                      />
                      <span className="text-sm">×</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.price_per_unit}
                        onChange={(e) => handlePriceChange(product.barcode, parseFloat(e.target.value) || 0)}
                        aria-label={`Price for ${product.product_name}`}
                        className="w-24"
                        prefix="$"
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeProduct(product.barcode)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Select Client */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 2: Select Client *</CardTitle>
            <CardDescription>Choose which client you are fronting inventory to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SmartClientPicker
              selectedClient={selectedClient}
              onSelect={(client) => setSelectedClient(client as SelectedClient)}
            />

            {selectedClient && (
              <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-lg">{selectedClient.business_name}</span>
                  <Badge variant={selectedClient.status === 'active' ? 'default' : 'secondary'}>
                    {selectedClient.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Contact:</span>
                    <span className="ml-2">{selectedClient.contact_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Credit Limit:</span>
                    <span className="ml-2">{formatCurrency(selectedClient.credit_limit ?? 0)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Current Balance:</span>
                    <span className={`ml-2 font-medium ${(selectedClient.outstanding_balance ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatCurrency(selectedClient.outstanding_balance ?? 0)}
                    </span>
                    {(selectedClient.outstanding_balance ?? 0) > (selectedClient.credit_limit ?? 0) && (
                      <Badge variant="destructive" className="ml-2">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Over Limit
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setSelectedClient(null)}
                >
                  Change Client
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Deal Terms */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 3: Deal Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Deal Type</Label>
              <Select value={dealType} onValueChange={setDealType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select deal type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fronted">Fronted (Pay Later)</SelectItem>
                  <SelectItem value="consignment">Consignment (Pay for what sells)</SelectItem>
                  <SelectItem value="paid">Already Paid</SelectItem>
                  <SelectItem value="loan">Loan (Return or Pay)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Payment Due Date *
              </Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PAYMENT_DUE_PRESETS.map((preset) => (
                  <Button
                    key={preset.days}
                    type="button"
                    variant={selectedDuePreset === preset.days ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleDuePresetSelect(preset.days)}
                    className="flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    {preset.label}
                  </Button>
                ))}
              </div>
              <Input
                type="date"
                value={paymentDueDate}
                onChange={(e) => {
                  setPaymentDueDate(e.target.value);
                  setSelectedDuePreset(null);
                }}
                aria-label="Payment due date"
                className="w-full"
              />
              {paymentDueDate && (
                <p className="text-sm text-muted-foreground">
                  Due: {format(new Date(paymentDueDate), 'EEEE, MMMM d, yyyy')}
                </p>
              )}
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Expected Revenue:</span>
                <span className="font-bold">{formatCurrency(totals.totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Your Cost:</span>
                <span className="font-bold">{formatCurrency(totals.totalCost)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span className="text-sm">Expected Profit:</span>
                <span className="font-bold">{formatCurrency(totals.totalProfit)} ({totals.profitMargin.toFixed(1)}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Notes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 4: Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add any notes about this front..."
              aria-label="Dispatch notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => navigateToAdmin('inventory/fronted')} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleDispatch}
            disabled={loading || scannedProducts.length === 0 || !selectedClient || !paymentDueDate}
            className="flex-1"
          >
            <DollarSign className="w-4 h-4 mr-2" />
            {loading ? 'Dispatching...' : 'Dispatch & Track'}
          </Button>
        </div>
      </div>
    </div>
  );
}
