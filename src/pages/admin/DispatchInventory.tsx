import { logger } from '@/lib/logger';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarcodeScanner } from '@/components/inventory/BarcodeScanner';
import { ArrowLeft, Trash2, DollarSign } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useToast } from '@/hooks/use-toast';
import { calculateExpectedProfit } from '@/utils/barcodeHelpers';

interface ScannedProduct {
  barcode: string;
  product_id: string;
  product_name: string;
  quantity: number;
  cost_per_unit: number;
  price_per_unit: number;
}

export default function DispatchInventory() {
  const navigate = useNavigate();
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const { toast } = useToast();
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [frontTo, setFrontTo] = useState('');
  const [dealType, setDealType] = useState('fronted');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBarcodeScan = async (barcode: string) => {
    if (!tenant) return;
    try {
      // @ts-ignore - Avoid deep Supabase type inference
      const result = await supabase
        .from('products')
        .select('id, name, cost_per_unit, wholesale_price')
        .eq('barcode', barcode)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      const product = result.data;
      const error = result.error;

      if (error || !product) {
        toast({
          title: 'Product Not Found',
          description: `No product found with barcode: ${barcode}`,
          variant: 'destructive'
        });
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
            cost_per_unit: product.cost_per_unit || 0,
            price_per_unit: product.wholesale_price || 0
          }
        ]);
      }

      toast({
        title: 'Product Scanned',
        description: `${product.name} added to dispatch`
      });
    } catch (error) {
      logger.error('Error scanning product:', error);
      toast({
        title: 'Error',
        description: 'Failed to scan product',
        variant: 'destructive'
      });
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
      toast({
        title: 'No Products',
        description: 'Please scan products to dispatch',
        variant: 'destructive'
      });
      return;
    }

    if (!frontTo.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please specify who you are fronting to',
        variant: 'destructive'
      });
      return;
    }

    if (!tenant) return;

    setLoading(true);

    try {
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
          fronted_to_customer_name: frontTo,
          deal_type: dealType,
          cost_per_unit: product.cost_per_unit,
          price_per_unit: product.price_per_unit,
          expected_revenue: expectedRevenue,
          expected_profit: expectedProfit,
          payment_due_date: paymentDueDate || null,
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
          .maybeSingle<ProductQuantity>();

        if (currentProduct) {
          await supabase
            .from('products')
            .update({
              fronted_quantity: (currentProduct.fronted_quantity || 0) + product.quantity,
              available_quantity: Math.max(0, (currentProduct.available_quantity || 0) - product.quantity)
            })
            .eq('id', product.product_id);
        }
      });

      await Promise.all(promises);

      toast({
        title: 'Success!',
        description: `${calculateTotals().totalUnits} units dispatched successfully`
      });

      navigateToAdmin('inventory/fronted');
    } catch (error) {
      logger.error('Error dispatching inventory:', error);
      toast({
        title: 'Error',
        description: 'Failed to dispatch inventory',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Dispatch Inventory | Inventory Management"
        description="Front products to drivers or locations"
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigateToAdmin('inventory/fronted')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">🚚 Dispatch/Front Inventory</h1>
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
                        className="w-20"
                      />
                      <span className="text-sm">×</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.price_per_unit}
                        onChange={(e) => handlePriceChange(product.barcode, parseFloat(e.target.value) || 0)}
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

        {/* Step 2: Front To */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 2: Who Are You Fronting To?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Name / Business *</Label>
              <Input
                placeholder="Driver name, business name, etc."
                value={frontTo}
                onChange={(e) => setFrontTo(e.target.value)}
              />
            </div>
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fronted">Fronted (Pay Later)</SelectItem>
                  <SelectItem value="consignment">Consignment (Pay for what sells)</SelectItem>
                  <SelectItem value="paid">Already Paid</SelectItem>
                  <SelectItem value="loan">Loan (Return or Pay)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Payment Due Date</Label>
              <Input
                type="date"
                value={paymentDueDate}
                onChange={(e) => setPaymentDueDate(e.target.value)}
              />
            </div>

            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Expected Revenue:</span>
                <span className="font-bold">${totals.totalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Your Cost:</span>
                <span className="font-bold">${totals.totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span className="text-sm">Expected Profit:</span>
                <span className="font-bold">${totals.totalProfit.toFixed(2)} ({totals.profitMargin.toFixed(1)}%)</span>
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
            disabled={loading || scannedProducts.length === 0 || !frontTo.trim()}
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
