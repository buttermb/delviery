import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { BarcodeGenerator } from '@/components/inventory/BarcodeGenerator';
import { QRCodeSVG } from 'qrcode.react';
import {
  Download,
  Printer,
  Barcode,
  RefreshCw,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import jsPDF from 'jspdf';

// Barcode format types
type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'UPC';
type OutputType = 'barcode' | 'qrcode' | 'both';

// Product type for the component
interface ProductForBarcode {
  id: string;
  name: string;
  sku: string | null;
  barcode?: string | null;
  wholesale_price?: number | null;
  retail_price?: number | null;
  category?: string | null;
}

// Generated barcode item
interface GeneratedBarcodeItem {
  id: string;
  productId: string;
  productName: string;
  value: string;
  format: BarcodeFormat;
  sku?: string | null;
  price?: number | null;
}

interface ProductBarcodeGeneratorProps {
  /** Pre-selected product ID (optional) */
  productId?: string;
  /** Called when barcodes are generated */
  onGenerate?: (barcodes: GeneratedBarcodeItem[]) => void;
  /** Show compact view */
  compact?: boolean;
}

/**
 * ProductBarcodeGenerator - Creates scannable barcodes for products
 *
 * Features:
 * - Multiple barcode formats (CODE128, CODE39, EAN13, UPC)
 * - QR code generation with product data
 * - Bulk generation for multiple products
 * - PDF export and print functionality
 * - Copy barcode values to clipboard
 */
export function ProductBarcodeGenerator({
  productId,
  onGenerate,
  compact = false
}: ProductBarcodeGeneratorProps) {
  const { tenant } = useTenantAdminAuth();

  // State
  const [selectedProducts, setSelectedProducts] = useState<string[]>(productId ? [productId] : []);
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>('CODE128');
  const [outputType, setOutputType] = useState<OutputType>('barcode');
  const [quantity, setQuantity] = useState(1);
  const [includePrice, setIncludePrice] = useState(false);
  const [includeSku, setIncludeSku] = useState(true);
  const [generatedBarcodes, setGeneratedBarcodes] = useState<GeneratedBarcodeItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Fetch products for selection
  const { data: products, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: queryKeys.products.byTenant(tenant?.id ?? ''),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, barcode, wholesale_price, retail_price, category')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for barcode generator', { error });
        throw error;
      }

      return (data ?? []) as ProductForBarcode[];
    },
    enabled: !!tenant?.id
  });

  // Generate barcode value from product data
  const generateBarcodeValue = useCallback((product: ProductForBarcode, index: number): string => {
    // Use existing barcode if available
    if (product.barcode) {
      return quantity > 1 ? `${product.barcode}-${String(index + 1).padStart(4, '0')}` : product.barcode;
    }

    // Use SKU if available
    if (product.sku) {
      return quantity > 1 ? `${product.sku}-${String(index + 1).padStart(4, '0')}` : product.sku;
    }

    // Generate from product ID and timestamp
    const timestamp = Date.now().toString().slice(-6);
    const productPrefix = product.id.substring(0, 6).toUpperCase();
    return `PRD${productPrefix}${timestamp}${String(index + 1).padStart(3, '0')}`;
  }, [quantity]);

  // Validate barcode for format
  const validateBarcodeForFormat = useCallback((value: string, format: BarcodeFormat): boolean => {
    switch (format) {
      case 'EAN13':
        return /^\d{12,13}$/.test(value);
      case 'UPC':
        return /^\d{11,12}$/.test(value);
      case 'CODE39':
        return /^[A-Z0-9\-.$/+%\s]+$/i.test(value);
      case 'CODE128':
      default:
        return value.length > 0 && value.length <= 80;
    }
  }, []);

  // Handle barcode generation
  const handleGenerate = useCallback(async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    setIsGenerating(true);

    try {
      const newBarcodes: GeneratedBarcodeItem[] = [];
      const selectedProductData = products?.filter(p => selectedProducts.includes(p.id)) ?? [];

      for (const product of selectedProductData) {
        for (let i = 0; i < quantity; i++) {
          let barcodeValue = generateBarcodeValue(product, i);

          // For EAN13/UPC, generate numeric-only codes
          if (barcodeFormat === 'EAN13' || barcodeFormat === 'UPC') {
            const requiredLength = barcodeFormat === 'EAN13' ? 12 : 11;
            barcodeValue = String(Date.now()).slice(-requiredLength).padStart(requiredLength, '0');
          }

          // Validate the generated barcode
          if (!validateBarcodeForFormat(barcodeValue, barcodeFormat)) {
            logger.warn('Generated barcode failed validation, using fallback', {
              product: product.name,
              value: barcodeValue,
              format: barcodeFormat
            });
            // Fallback to a safe CODE128 compatible value
            barcodeValue = `PRD-${product.id.substring(0, 8)}-${String(i + 1).padStart(4, '0')}`;
          }

          newBarcodes.push({
            id: `${product.id}-${i}-${Date.now()}`,
            productId: product.id,
            productName: product.name,
            value: barcodeValue,
            format: barcodeFormat,
            sku: includeSku ? product.sku : null,
            price: includePrice ? (product.retail_price ?? product.wholesale_price) : null
          });
        }
      }

      setGeneratedBarcodes(newBarcodes);
      onGenerate?.(newBarcodes);
      toast.success(`Generated ${newBarcodes.length} barcode(s)`);
    } catch (error) {
      logger.error('Failed to generate barcodes', { error });
      toast.error('Failed to generate barcodes');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedProducts, products, quantity, barcodeFormat, includeSku, includePrice, generateBarcodeValue, validateBarcodeForFormat, onGenerate]);

  // Copy barcode value to clipboard
  const handleCopyBarcode = useCallback(async (barcode: GeneratedBarcodeItem) => {
    try {
      await navigator.clipboard.writeText(barcode.value);
      setCopiedId(barcode.id);
      toast.success('Barcode copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy barcode');
    }
  }, []);

  // Generate PDF with barcodes
  const handleDownloadPdf = useCallback(async () => {
    if (generatedBarcodes.length === 0) {
      toast.error('No barcodes to download');
      return;
    }

    setIsPdfGenerating(true);
    toast.info('Generating PDF...');

    try {
      // Defer to avoid blocking UI
      await new Promise(resolve => setTimeout(resolve, 100));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: [8.5, 11] // US Letter
      });

      const cols = 3;
      const rows = 10;
      const cardWidth = 2.5;
      const cardHeight = 1;
      const margin = 0.25;
      const spacing = 0.1;

      let index = 0;

      for (const barcode of generatedBarcodes) {
        if (index > 0 && index % (rows * cols) === 0) {
          pdf.addPage();
        }

        const pageIndex = index % (rows * cols);
        const col = pageIndex % cols;
        const row = Math.floor(pageIndex / cols);

        const x = margin + col * (cardWidth + spacing);
        const y = margin + row * (cardHeight + spacing);

        // Draw border
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(x, y, cardWidth, cardHeight);

        // Add product name
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        const truncatedName = barcode.productName.length > 30
          ? barcode.productName.substring(0, 27) + '...'
          : barcode.productName;
        pdf.text(truncatedName, x + 0.1, y + 0.2);

        // Add barcode value
        pdf.setFontSize(10);
        pdf.setFont('courier', 'normal');
        pdf.text(barcode.value, x + 0.1, y + 0.5);

        // Add SKU if present
        if (barcode.sku) {
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`SKU: ${barcode.sku}`, x + 0.1, y + 0.75);
        }

        // Add price if present
        if (barcode.price) {
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'normal');
          const priceX = barcode.sku ? x + 1.3 : x + 0.1;
          pdf.text(`$${barcode.price.toFixed(2)}`, priceX, y + 0.75);
        }

        index++;
      }

      pdf.save(`product-barcodes-${Date.now()}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      logger.error('Failed to generate PDF', { error });
      toast.error('Failed to generate PDF');
    } finally {
      setIsPdfGenerating(false);
    }
  }, [generatedBarcodes]);

  // Print barcodes
  const handlePrint = useCallback(() => {
    if (generatedBarcodes.length === 0) {
      toast.error('No barcodes to print');
      return;
    }
    window.print();
  }, [generatedBarcodes]);

  // Toggle product selection
  const handleProductToggle = useCallback((productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }, []);

  // Select all products
  const handleSelectAll = useCallback(() => {
    if (products) {
      setSelectedProducts(products.map(p => p.id));
    }
  }, [products]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedProducts([]);
  }, []);

  // Loading state
  if (productsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (productsError) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load products. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No tenant state
  if (!tenant) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No tenant context available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${compact ? 'max-w-2xl' : ''}`}>
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Product Barcode Generator
          </CardTitle>
          <CardDescription>
            Generate scannable barcodes for your products in multiple formats
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Products</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={!products || products.length === 0}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  disabled={selectedProducts.length === 0}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="border rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
              {products && products.length > 0 ? (
                products.map(product => (
                  <div
                    key={product.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                      selectedProducts.includes(product.id) ? 'bg-muted' : ''
                    }`}
                    onClick={() => handleProductToggle(product.id)}
                  >
                    <Checkbox
                      checked={selectedProducts.includes(product.id)}
                      onCheckedChange={() => handleProductToggle(product.id)}
                    />
                    <span className="flex-1 truncate">{product.name}</span>
                    {product.sku && (
                      <Badge variant="secondary" className="text-xs">
                        {product.sku}
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground p-2">
                  No products available. Add products first.
                </p>
              )}
            </div>
            {selectedProducts.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedProducts.length} product(s) selected
              </p>
            )}
          </div>

          {/* Format Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Barcode Format</Label>
              <Select value={barcodeFormat} onValueChange={(v) => setBarcodeFormat(v as BarcodeFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE128">CODE128 (Recommended)</SelectItem>
                  <SelectItem value="CODE39">CODE39</SelectItem>
                  <SelectItem value="EAN13">EAN-13</SelectItem>
                  <SelectItem value="UPC">UPC-A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Output Type</Label>
              <Select value={outputType} onValueChange={(v) => setOutputType(v as OutputType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="barcode">Barcode Only</SelectItem>
                  <SelectItem value="qrcode">QR Code Only</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantity per Product</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              />
            </div>
          </div>

          {/* Include Options */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeSku"
                checked={includeSku}
                onCheckedChange={(checked) => setIncludeSku(checked === true)}
              />
              <Label htmlFor="includeSku" className="cursor-pointer">
                Include SKU
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="includePrice"
                checked={includePrice}
                onCheckedChange={(checked) => setIncludePrice(checked === true)}
              />
              <Label htmlFor="includePrice" className="cursor-pointer">
                Include Price
              </Label>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || selectedProducts.length === 0}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Barcode className="h-4 w-4 mr-2" />
                Generate Barcodes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Barcodes Preview */}
      {generatedBarcodes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated Barcodes ({generatedBarcodes.length})</CardTitle>
                <CardDescription>
                  Preview and export your scannable barcodes
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={isPdfGenerating}
                >
                  {isPdfGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              ref={printRef}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-3"
            >
              {generatedBarcodes.map((barcode) => (
                <Card key={barcode.id} className="p-4 print:break-inside-avoid">
                  <div className="space-y-3">
                    {/* Product Name */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm truncate flex-1">
                        {barcode.productName}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 print:hidden"
                        onClick={() => handleCopyBarcode(barcode)}
                      >
                        {copiedId === barcode.id ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    {/* Barcode/QR Code Display */}
                    <div className="flex flex-col items-center gap-3">
                      {(outputType === 'barcode' || outputType === 'both') && (
                        <div className="w-full flex justify-center">
                          <BarcodeGenerator
                            value={barcode.value}
                            format={barcode.format}
                            height={50}
                            width={2}
                          />
                        </div>
                      )}

                      {(outputType === 'qrcode' || outputType === 'both') && (
                        <div className="flex justify-center">
                          <QRCodeSVG
                            value={JSON.stringify({
                              type: 'product',
                              id: barcode.productId,
                              name: barcode.productName,
                              barcode: barcode.value,
                              sku: barcode.sku,
                              price: barcode.price
                            })}
                            size={outputType === 'qrcode' ? 120 : 80}
                            level="M"
                          />
                        </div>
                      )}
                    </div>

                    {/* Barcode Value */}
                    <p className="text-xs font-mono text-center text-muted-foreground break-all">
                      {barcode.value}
                    </p>

                    {/* Additional Info */}
                    {(barcode.sku || barcode.price) && (
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        {barcode.sku && <span>SKU: {barcode.sku}</span>}
                        {barcode.price && <span>${barcode.price.toFixed(2)}</span>}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:grid-cols-3,
          .print\\:grid-cols-3 * {
            visibility: visible;
          }
          .print\\:break-inside-avoid {
            break-inside: avoid;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
