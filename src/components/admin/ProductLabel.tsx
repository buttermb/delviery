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
  product: Pick<Product, 'id' | 'name' | 'sku' | 'strain_name' | 'strain_type' | 'barcode'> & {
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
    strainName: product.strain_name || undefined,
    strainType: (product.strain_type as 'Sativa' | 'Indica' | 'Hybrid') || undefined,
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
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-white">
            {/* Label Preview */}
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold">{product.name}</h3>
              {product.strain_name && (
                <p className="text-sm">Strain: {product.strain_name}</p>
              )}
              {product.strain_type && (
                <p className="text-xs font-semibold text-gray-600">
                  Type: {product.strain_type}
                </p>
              )}
              {product.barcode_image_url ? (
                <img
                  src={product.barcode_image_url as string}
                  alt="Barcode"
                  className="mx-auto h-16 object-contain"
                />
              ) : (
                <div className="mx-auto h-16 flex items-center justify-center border border-gray-300 rounded">
                  <p className="text-xs font-mono">{product.sku}</p>
                </div>
              )}
              <p className="text-xs text-gray-500">SKU: {product.sku}</p>
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

