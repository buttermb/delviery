/**
 * Product Label Component
 * Preview and download printable product labels
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Download, Printer, Loader2 } from 'lucide-react';
import { downloadProductLabel, generateProductLabelPDF, type ProductLabelData } from '@/lib/utils/labelGenerator';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

interface ProductLabelProps {
  product: Pick<Product, 
    'id' | 'name' | 'sku' | 'strain_name' | 'strain_type' | 
    'barcode' | 'category' | 'batch_number' | 'thc_percent' | 
    'cbd_percent' | 'vendor_name' | 'wholesale_price' | 
    'retail_price' | 'available_quantity'
  > & {
    barcode_image_url?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductLabel({ product, open, onOpenChange }: ProductLabelProps) {
  const [loading, setLoading] = useState(false);

  if (!product.sku) {
    return null;
  }

  const labelData: ProductLabelData = {
    productName: product.name || '',
    category: product.category || undefined,
    strainName: product.strain_name || undefined,
    strainType: (product.strain_type as 'Sativa' | 'Indica' | 'Hybrid') || undefined,
    vendorName: product.vendor_name || undefined,
    batchNumber: product.batch_number || undefined,
    thcPercent: product.thc_percent || undefined,
    cbdPercent: product.cbd_percent || undefined,
    price: product.wholesale_price || product.retail_price || undefined,
    sku: product.sku || '',
    barcodeImageUrl: product.barcode_image_url || undefined,
    barcodeValue: (product.barcode as string) || product.sku || '',
  };

  const handleDownload = async () => {
    try {
      setLoading(true);
      await downloadProductLabel(labelData);
      toast.success('Label downloaded successfully');
    } catch (error) {
      logger.error('Failed to download label', error, {
        component: 'ProductLabel',
      });
      toast.error('Failed to download label');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setLoading(true);
      const pdfBlob = await generateProductLabelPDF(labelData);
      const url = URL.createObjectURL(pdfBlob);
      
      // Open in new window for printing
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      
      toast.success('Opening print dialog...');
    } catch (error) {
      logger.error('Failed to print label', error, {
        component: 'ProductLabel',
      });
      toast.error('Failed to print label');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Product Label: {product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Label Preview */}
          <div className="border-2 border-dashed border-muted rounded-lg p-6 bg-card space-y-4">
            {/* Header Section */}
            <div className="text-center border-b border-border pb-4">
              <h3 className="text-xl font-bold text-foreground">{product.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">SKU: {product.sku}</p>
            </div>

            {/* Product Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {product.category && (
                <div>
                  <span className="text-muted-foreground">Category:</span>
                  <span className="ml-2 font-medium text-foreground capitalize">{product.category}</span>
                </div>
              )}
              {product.vendor_name && (
                <div>
                  <span className="text-muted-foreground">Vendor:</span>
                  <span className="ml-2 font-medium text-foreground">{product.vendor_name}</span>
                </div>
              )}
              {product.strain_name && (
                <div>
                  <span className="text-muted-foreground">Strain:</span>
                  <span className="ml-2 font-medium text-foreground">{product.strain_name}</span>
                </div>
              )}
              {product.strain_type && (
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <span className="ml-2 font-semibold text-foreground capitalize">{product.strain_type}</span>
                </div>
              )}
              {product.batch_number && (
                <div>
                  <span className="text-muted-foreground">Batch:</span>
                  <span className="ml-2 font-mono text-xs text-foreground">{product.batch_number}</span>
                </div>
              )}
              {product.thc_percent !== null && product.thc_percent !== undefined && (
                <div>
                  <span className="text-muted-foreground">THC:</span>
                  <span className="ml-2 font-medium text-foreground">{product.thc_percent}%</span>
                </div>
              )}
              {product.cbd_percent !== null && product.cbd_percent !== undefined && (
                <div>
                  <span className="text-muted-foreground">CBD:</span>
                  <span className="ml-2 font-medium text-foreground">{product.cbd_percent}%</span>
                </div>
              )}
              {(product.wholesale_price || product.retail_price) && (
                <div>
                  <span className="text-muted-foreground">Price:</span>
                  <span className="ml-2 font-medium text-foreground">
                    ${product.wholesale_price || product.retail_price}
                  </span>
                </div>
              )}
            </div>

            {/* Barcode Section */}
            <div className="flex flex-col items-center pt-4 border-t border-border">
              {product.barcode_image_url ? (
                <img
                  src={product.barcode_image_url as string}
                  alt="Barcode"
                  className="h-20 object-contain"
                />
              ) : (
                <div className="h-20 flex items-center justify-center border border-muted rounded px-4">
                  <p className="font-mono text-sm text-foreground">{product.sku}</p>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Label size: 4" x 2" (standard product label)
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </>
            )}
          </Button>
          <Button
            onClick={handleDownload}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

