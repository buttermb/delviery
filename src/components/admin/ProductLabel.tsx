import { logger } from '@/lib/logger';
/**
 * Product Label Component
 * Preview and download printable product labels
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Download, Printer, Loader2, Barcode as BarcodeIcon } from 'lucide-react';
import { generateProductLabelPDF, type ProductLabelData, type LabelSize } from '@/lib/utils/labelGenerator';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import type { Database } from '@/integrations/supabase/types';
import { generateBarcodeSVG } from '@/utils/barcodeService';
import { formatSmartDate } from '@/lib/formatters';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';

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
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);
  const pdfPreviewUrlRef = useRef<string>('');

  // Prepare label data - memoized to avoid triggering useEffect on every render
  const labelData: ProductLabelData | null = useMemo(() => product.sku ? {
    productName: product.name || '',
    category: product.category || undefined,
    strainName: product.strain_name || undefined,
    strainType: (product.strain_type as 'Sativa' | 'Indica' | 'Hybrid') || undefined,
    vendorName: product.vendor_name || undefined,
    batchNumber: product.batch_number || undefined,
    thcPercent: product.thc_percent || undefined,
    cbdPercent: product.cbd_percent || undefined,
    price: product.wholesale_price || undefined, // Keep for backwards compatibility
    retailPrice: product.retail_price || undefined, // NEW
    availableQuantity: product.available_quantity ?? undefined, // NEW
    sku: product.sku || '',
    barcodeImageUrl: product.barcode_image_url || undefined,
    barcodeValue: (product.barcode as string) || product.sku || '',
  } : null, [
    product.sku,
    product.name,
    product.category,
    product.strain_name,
    product.strain_type,
    product.vendor_name,
    product.batch_number,
    product.thc_percent,
    product.cbd_percent,
    product.wholesale_price,
    product.retail_price,
    product.available_quantity,
    product.barcode_image_url,
    product.barcode,
  ]);

  // Generate barcode when dialog opens
  useEffect(() => {
    if (open && product.sku) {
      try {
        const barcodeValue = (product.barcode as string) || product.sku || '';

        logger.info('Generating barcode preview', {
          component: 'ProductLabel',
          barcodeValue,
          productName: product.name,
          sku: product.sku,
        });

        // Use exact same parameters as PDF generation for consistency
        const dataUrl = generateBarcodeSVG(barcodeValue, {
          width: 3,
          height: 50,
          displayValue: true,
          format: 'CODE128',
        });

        logger.info('Barcode preview generated successfully', {
          urlLength: dataUrl.length,
          startsWithDataImage: dataUrl.startsWith('data:image'),
        });

        setBarcodeDataUrl(dataUrl);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to generate barcode preview', error, {
          component: 'ProductLabel',
          errorMessage,
          productName: product.name,
          sku: product.sku,
        });
        toast.error(`Barcode preview failed: ${errorMessage}`);
      }
    }
  }, [open, product.sku, product.barcode, product.name]);

  // Generate PDF preview when size changes or PDF preview is enabled
  useEffect(() => {
    if (open && showPdfPreview && labelData) {
      const generatePreview = async () => {
        try {
          setGeneratingPdf(true);
          // Clean up old URL using ref to avoid stale closure
          if (pdfPreviewUrlRef.current) {
            URL.revokeObjectURL(pdfPreviewUrlRef.current);
          }

          const pdfBlob = await generateProductLabelPDF(labelData, labelSize);
          const url = URL.createObjectURL(pdfBlob);
          pdfPreviewUrlRef.current = url;
          setPdfPreviewUrl(url);
        } catch (error) {
          logger.error('Failed to generate PDF preview', error, {
            component: 'ProductLabel',
          });
          toast.error('Failed to generate PDF preview', { description: humanizeError(error) });
        } finally {
          setGeneratingPdf(false);
        }
      };

      generatePreview();
    }

    // Cleanup on unmount
    return () => {
      if (pdfPreviewUrlRef.current) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
      }
    };
  }, [open, showPdfPreview, labelSize, labelData]);

  // Show error dialog if SKU is missing instead of silently returning null
  if (!product.sku) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              SKU Missing
            </DialogTitle>
            <DialogDescription>
              This product cannot generate labels because it's missing a SKU (Stock Keeping Unit).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Product:</strong> {product.name}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Labels require a SKU for barcode generation. Please edit this product to add a SKU, or delete and recreate it to auto-generate one.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const handleDownload = async () => {
    if (!labelRef.current) {
      toast.error('Label preview not available');
      return;
    }

    try {
      setLoading(true);

      logger.info('Capturing label as image', {
        component: 'ProductLabel',
        labelSize,
        productName: product.name,
        sku: product.sku,
      });

      // Capture the label div as canvas
      const canvas = await html2canvas(labelRef.current, {
        backgroundColor: '#ffffff',
        scale: 3, // Higher quality
        logging: false,
        useCORS: true,
      });

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to generate image');
        }

        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${product.sku || 'label'}-${labelSize}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Label image downloaded successfully`);
      }, 'image/png');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to download label image', error, {
        component: 'ProductLabel',
        errorMessage,
      });
      toast.error(`Failed to download label: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!labelData) {
      toast.error('Label data is missing');
      return;
    }

    try {
      setLoading(true);

      logger.info('Printing label', {
        component: 'ProductLabel',
        labelSize,
        productName: labelData.productName,
        sku: labelData.sku,
        barcodeValue: labelData.barcodeValue,
      });

      const pdfBlob = await generateProductLabelPDF(labelData, labelSize);
      const url = URL.createObjectURL(pdfBlob);

      // Open in new window for printing
      const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      toast.success('Opening print dialog...');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to print label', error, {
        component: 'ProductLabel',
        errorMessage,
      });
      toast.error(`Failed to print label: ${errorMessage}`);
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
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
                <SelectValue placeholder="Select label size" />
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

          {/* Debug Info */}
          <details className="text-xs border border-border rounded-lg">
            <summary className="p-2 cursor-pointer hover:bg-muted/50 rounded-t-lg font-medium">
              Debug Information
            </summary>
            <div className="p-3 space-y-2 bg-muted/20 border-t border-border">
              <div><strong>Product:</strong> {product.name}</div>
              <div><strong>SKU:</strong> {product.sku}</div>
              <div><strong>Barcode Value:</strong> {labelData?.barcodeValue || 'N/A'}</div>
              <div><strong>Barcode Length:</strong> {labelData?.barcodeValue?.length || 0}</div>
              <div><strong>Has Barcode URL:</strong> {barcodeDataUrl ? `Yes (${barcodeDataUrl.length} chars)` : 'No'}</div>
              <div><strong>Label Size:</strong> {labelSize}</div>
              <div><strong>Category:</strong> {product.category || 'N/A'}</div>
              <div><strong>THC:</strong> {product.thc_percent}% | <strong>CBD:</strong> {product.cbd_percent}%</div>
            </div>
          </details>

          {/* Preview Mode Toggle */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Button
              variant={!showPdfPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPdfPreview(false)}
              className="flex-1"
            >
              HTML Preview
            </Button>
            <Button
              variant={showPdfPreview ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPdfPreview(true)}
              className="flex-1"
            >
              PDF Preview
            </Button>
          </div>
          {/* Label Preview */}
          {showPdfPreview ? (
            // PDF Preview
            <div className="border-2 border-dashed border-muted rounded-lg bg-card overflow-hidden">
              {generatingPdf ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-3 text-sm text-muted-foreground">Generating PDF preview...</span>
                </div>
              ) : pdfPreviewUrl ? (
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full border-0"
                  style={{
                    height: labelSize === 'small' ? '200px' :
                            labelSize === 'standard' ? '400px' :
                            labelSize === 'large' ? '500px' : '700px'
                  }}
                  title="PDF Preview"
                />
              ) : (
                <div className="flex items-center justify-center p-12">
                  <p className="text-sm text-muted-foreground">Click "PDF Preview" to generate</p>
                </div>
              )}
            </div>
          ) : (
            // HTML Preview
            <div ref={labelRef} className="border-2 border-dashed border-muted rounded-lg p-4 bg-card space-y-3 max-w-full overflow-hidden">
            {/* Header Section */}
            <div className="text-center border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground break-words">{product.name}</h3>
              {product.strain_name && (
                <p className="text-sm font-medium text-primary mt-1">{product.strain_name}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">SKU: {product.sku}</p>
            </div>

            {/* Product Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
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
                  <span className="font-bold text-success">{product.thc_percent}%</span>
                </div>
              )}
              {product.cbd_percent !== null && product.cbd_percent !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">CBD:</span>
                  <span className="font-bold text-info">{product.cbd_percent}%</span>
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
              <div className="flex flex-col items-center w-full">
                <p className="text-xs text-muted-foreground mb-2">Barcode</p>
                {barcodeDataUrl ? (
                  <div
                    className="flex justify-center p-2 bg-white dark:bg-zinc-950 rounded w-full max-w-[300px]"
                    style={{ overflow: 'hidden' }}
                  >
                    <img
                      src={barcodeDataUrl}
                      alt="Product Barcode"
                      className="max-w-full h-auto"
                      style={{ maxHeight: '60px' }}
                    />
                  </div>
                ) : product.barcode_image_url ? (
                  <img
                    src={product.barcode_image_url as string}
                    alt="Barcode"
                    className="h-16 max-w-[300px] object-contain"
                  />
                ) : (
                  <div className="h-16 flex items-center justify-center border border-muted rounded px-4 bg-white dark:bg-zinc-950 max-w-[300px]">
                    <p className="font-mono text-xs text-black dark:text-white truncate">{product.sku}</p>
                  </div>
                )}
              </div>

              {/* QR Code */}
              {labelSize !== 'small' && (
                <div className="flex flex-col items-center">
                  <p className="text-xs text-muted-foreground mb-2">Quick Scan</p>
                  <div className="p-2 bg-white dark:bg-zinc-950 rounded inline-block">
                    <QRCodeSVG
                      value={productQRData}
                      size={64}
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
                <p>For adult use only (21+)</p>
                <p>Keep out of reach of children</p>
                <p>Packaged: {formatSmartDate(new Date())}</p>
              </div>
            )}
            </div>
          )}

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
                Download Image
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
