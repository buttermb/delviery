import { logger } from '@/lib/logger';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarcodeScanner } from '@/components/inventory/BarcodeScanner';
import { ArrowLeft, DollarSign, Trash2 } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { toast } from 'sonner';
interface ScannedSale {
  barcode: string;
  product_name: string;
  quantity: number;
}

export default function RecordFrontedSale() {
  const { navigateToAdmin, navigate } = useTenantNavigation();
  const { id } = useParams();
  const { tenant } = useTenantAdminAuth();
  const [scannedItems, setScannedItems] = useState<ScannedSale[]>([]);
  const [loading, setLoading] = useState(false);

  const handleBarcodeScan = async (barcode: string) => {
    if (!tenant?.id) return;
    try {
      const result = await supabase
        .from('products')
        .select('id, name')
        .eq('barcode', barcode)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      const product = result.data;

      if (!product) {
        toast.error("No product found with barcode: ${barcode}");
        return;
      }

      const existing = scannedItems.find(i => i.barcode === barcode);
      if (existing) {
        setScannedItems(prev =>
          prev.map(i => i.barcode === barcode ? { ...i, quantity: i.quantity + 1 } : i)
        );
      } else {
        setScannedItems(prev => [...prev, {
          barcode,
          product_name: product.name,
          quantity: 1
        }]);
      }

      toast.success("${product.name} added");
    } catch (error) {
      logger.error('Error scanning barcode', error, { component: 'RecordFrontedSale', barcode });
    }
  };

  const handleRecordSale = async () => {
    if (!tenant?.id) {
      toast.error("Tenant not found");
      return;
    }

    if (scannedItems.length === 0) return;

    setLoading(true);
    try {
      const totalSold = scannedItems.reduce((sum, i) => sum + i.quantity, 0);

      // Update fronted inventory - increment quantity_sold
      const { data: currentFront } = await supabase
        .from('fronted_inventory')
        .select('quantity_sold')
        .eq('id', id)
        .eq('account_id', tenant.id)
        .maybeSingle();

      if (currentFront) {
        await supabase
          .from('fronted_inventory')
          .update({
            quantity_sold: (currentFront.quantity_sold || 0) + totalSold
          })
          .eq('id', id)
          .eq('account_id', tenant.id);
      }

      // Create scan records for each item
      const scanRecords = scannedItems.map(item => ({
        account_id: tenant.id,
        fronted_inventory_id: id,
        barcode: item.barcode,
        scan_type: 'sold',
        quantity: item.quantity
      }));

      await supabase.from('fronted_inventory_scans').insert(scanRecords);

      toast.success("${totalSold} units recorded as sold");
      if (tenant?.slug) {
        navigate(`/${tenant.slug}/admin/inventory/fronted/${id}`);
      }
    } catch (error) {
      logger.error('Error recording sale', error, { component: 'RecordFrontedSale', frontedInventoryId: id });
      toast.error("Failed to record sales");
    } finally {
      setLoading(false);
    }
  };

  const totalUnits = scannedItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead title="Record Sale | Inventory Management" />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigateToAdmin(`fronted-inventory/${id}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">Record Sale</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Scan Sold Items</CardTitle>
          </CardHeader>
          <CardContent>
            <BarcodeScanner onScan={handleBarcodeScan} />

            {scannedItems.length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="font-semibold">Scanned ({totalUnits} units)</h3>
                {scannedItems.map((item) => (
                  <div key={item.barcode} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-muted-foreground">{item.barcode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{item.quantity}x</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setScannedItems(prev => prev.filter(i => i.barcode !== item.barcode))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          onClick={handleRecordSale}
          disabled={loading || scannedItems.length === 0}
          className="w-full"
          size="lg"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          {loading ? 'Recording...' : 'Record Sale'}
        </Button>
      </div>
    </div>
  );
}
