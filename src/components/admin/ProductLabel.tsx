/**
 * Product Label Component
 * Preview and download printable product labels
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Printer, Loader2, QrCode, Barcode as BarcodeIcon } from 'lucide-react';
import { downloadProductLabel, generateProductLabelPDF, type ProductLabelData, type LabelSize } from '@/lib/utils/labelGenerator';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { generateBarcodeSVG } from '@/utils/barcodeService';
import { QRCodeSVG } from 'qrcode.react';

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
  const [labelSize, setLabelSize] = useState<LabelSize>('standard');
  const [barcodeDataUrl, setBarcodeDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate barcode when dialog opens
  useEffect(() => {
    if (open && product.sku) {
      try {
        const barcodeValue = (product.barcode as string) || product.sku || '';
        const svgString = generateBarcodeSVG(barcodeValue, {
          width: 2,
          height: 80,
          displayValue: true,
          format: 'CODE128',
        });
        setBarcodeDataUrl(svgString);
      } catch (error) {
        logger.error('Failed to generate barcode preview', error, {
          component: 'ProductLabel',
        });
      }
    }
  }, [open, product.sku, product.barcode]);

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
      await downloadProductLabel(labelData, labelSize);
      toast.success(`${labelSize} label downloaded successfully`);
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
      const pdfBlob = await generateProductLabelPDF(labelData, labelSize);
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

  // Generate product info QR code data
  const productQRData = JSON.stringify({
    sku: product.sku,
    name: product.name,
    category: product.category,
    strain: product.strain_name,
    thc: product.thc_percent,
    cbd: product.cbd_percent,
    batch: product.batch_number,
  });

  const sizeDescriptions = {
    small: '2" x 1" - Compact label for small items',
    standard: '4" x 2" - Standard product label',
    large: '4" x 3" - Extended label with extra info',
    sheet: '4" x 6" - Full sheet with detailed information',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarcodeIcon className="h-5 w-5" />
            Product Label: {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Label Size Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Label Size</label>
            <Select value={labelSize} onValueChange={(value) => setLabelSize(value as LabelSize)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small (2" x 1")</SelectItem>
                <SelectItem value="standard">Standard (4" x 2")</SelectItem>
                <SelectItem value="large">Large (4" x 3")</SelectItem>
                <SelectItem value="sheet">Sheet (4" x 6")</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{sizeDescriptions[labelSize]}</p>
          </div>
          {/* Label Preview */}
          <div className="border-2 border-dashed border-muted rounded-lg p-6 bg-card space-y-4">
            {/* Header Section */}
            <div className="text-center border-b border-border pb-3">
              <h3 className="text-xl font-bold text-foreground">{product.name}</h3>
              {product.strain_name && (
                <p className="text-sm font-medium text-primary mt-1">{product.strain_name}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">SKU: {product.sku}</p>
            </div>

            {/* Product Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {product.category && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium text-foreground capitalize">{product.category}</span>
                </div>
              )}
              {product.vendor_name && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Vendor:</span>
                  <span className="font-medium text-foreground">{product.vendor_name}</span>
                </div>
              )}
              {product.strain_type && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-semibold text-foreground capitalize">{product.strain_type}</span>
                </div>
              )}
              {product.batch_number && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Batch:</span>
                  <span className="font-mono text-xs text-foreground">{product.batch_number}</span>
                </div>
              )}
              {product.thc_percent !== null && product.thc_percent !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">THC:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">{product.thc_percent}%</span>
                </div>
              )}
              {product.cbd_percent !== null && product.cbd_percent !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">CBD:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{product.cbd_percent}%</span>
                </div>
              )}
              {product.wholesale_price && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Wholesale:</span>
                  <span className="font-medium text-foreground">${product.wholesale_price}</span>
                </div>
              )}
              {product.retail_price && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Retail:</span>
                  <span className="font-medium text-foreground">${product.retail_price}</span>
                </div>
              )}
              {product.available_quantity !== null && product.available_quantity !== undefined && (
                <div className="flex items-center gap-1 col-span-2">
                  <span className="text-muted-foreground">In Stock:</span>
                  <span className="font-medium text-foreground">{product.available_quantity} units</span>
                </div>
              )}
            </div>

            {/* Barcode & QR Code Section */}
            <div className="pt-4 border-t border-border space-y-4">
              {/* Barcode */}
              <div className="flex flex-col items-center">
                <p className="text-xs text-muted-foreground mb-2">Barcode</p>
                {barcodeDataUrl ? (
                  <div 
                    className="flex justify-center p-2 bg-white rounded"
                    dangerouslySetInnerHTML={{ __html: barcodeDataUrl }}
                  />
                ) : product.barcode_image_url ? (
                  <img
                    src={product.barcode_image_url as string}
                    alt="Barcode"
                    className="h-20 object-contain"
                  />
                ) : (
                  <div className="h-20 flex items-center justify-center border border-muted rounded px-4 bg-white">
                    <p className="font-mono text-sm text-black">{product.sku}</p>
                  </div>
                )}
              </div>

              {/* QR Code */}
              {labelSize !== 'small' && (
                <div className="flex flex-col items-center">
                  <p className="text-xs text-muted-foreground mb-2">Quick Scan</p>
                  <div className="p-2 bg-white rounded">
                    <QRCodeSVG
                      value={productQRData}
                      size={80}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Product Details</p>
                </div>
              )}
            </div>

            {/* Compliance Info (for larger labels) */}
            {(labelSize === 'large' || labelSize === 'sheet') && (
              <div className="pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
                <p>⚠️ For adult use only (21+)</p>
                <p>🚫 Keep out of reach of children</p>
                <p>📅 Packaged: {new Date().toLocaleDateString()}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarcodeIcon className="h-4 w-4" />
            <span>Preview: {sizeDescriptions[labelSize]}</span>
          </div>
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

