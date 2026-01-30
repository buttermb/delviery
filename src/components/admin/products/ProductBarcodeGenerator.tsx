import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Download,
  Printer,
  Barcode,
  QrCode,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

export type BarcodeFormat = 'CODE128' | 'EAN13' | 'CODE39' | 'UPC';

interface ProductBarcodeGeneratorProps {
  product?: Pick<Product, 'id' | 'name' | 'sku' | 'barcode'>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: 'dialog' | 'inline';
}

interface GeneratedBarcode {
  value: string;
  format: BarcodeFormat;
  dataUrl: string;
  label: string;
}

export function ProductBarcodeGenerator({
  product,
  open,
  onOpenChange,
  mode = 'dialog',
}: ProductBarcodeGeneratorProps) {
  const { tenant } = useTenantAdminAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [selectedProductId, setSelectedProductId] = useState<string>(product?.id || '');
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>('CODE128');
  const [customValue, setCustomValue] = useState('');
  const [useCustomValue, setUseCustomValue] = useState(false);
  const [includeQR, setIncludeQR] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [generatedBarcodes, setGeneratedBarcodes] = useState<GeneratedBarcode[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  // Fetch products for selection (only when no product is provided)
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: queryKeys.products.byTenant(tenant?.id || ''),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, barcode')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id && !product,
  });

  const selectedProduct = product || products?.find(p => p.id === selectedProductId);

  // Generate barcode value based on product and settings
  const getBarcodeValue = useCallback((prod: typeof selectedProduct, index: number): string => {
    if (useCustomValue && customValue) {
      return quantity > 1
        ? `${customValue}-${String(index + 1).padStart(4, '0')}`
        : customValue;
    }

    if (prod?.barcode) {
      return quantity > 1
        ? `${prod.barcode}-${String(index + 1).padStart(4, '0')}`
        : prod.barcode;
    }

    if (prod?.sku) {
      return quantity > 1
        ? `${prod.sku}-${String(index + 1).padStart(4, '0')}`
        : prod.sku;
    }

    // Generate a fallback value
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PRD-${timestamp}${random}`;
  }, [useCustomValue, customValue, quantity]);

  // Validate barcode value for format
  const validateBarcodeValue = useCallback((value: string, format: BarcodeFormat): boolean => {
    if (!value || value.trim().length === 0) return false;

    switch (format) {
      case 'CODE128':
        // CODE128 supports ASCII characters 0-127
        return /^[\x00-\x7F]+$/.test(value);
      case 'CODE39':
        // CODE39 supports uppercase letters, numbers, and some special chars
        return /^[A-Z0-9\-\.\$\/\+\%\s]+$/i.test(value);
      case 'EAN13':
        // EAN13 requires exactly 12-13 digits
        return /^\d{12,13}$/.test(value);
      case 'UPC':
        // UPC requires exactly 11-12 digits
        return /^\d{11,12}$/.test(value);
      default:
        return true;
    }
  }, []);

  // Generate barcode data URL
  const generateBarcodeDataUrl = useCallback((value: string, format: BarcodeFormat): string | null => {
    const canvas = document.createElement('canvas');

    try {
      // Calculate dimensions based on barcode length
      const valueLength = value.length;
      const width = 2;
      const height = 80;
      const margin = 10;
      const calculatedWidth = (valueLength * width * 11) + (margin * 2) + 50;
      const calculatedHeight = height + 40 + (margin * 2);

      canvas.width = calculatedWidth;
      canvas.height = calculatedHeight;

      JsBarcode(canvas, value, {
        format,
        width,
        height,
        displayValue: true,
        background: '#ffffff',
        lineColor: '#000000',
        margin,
        fontSize: 14,
        textMargin: 5,
      });

      return canvas.toDataURL('image/png');
    } catch (err) {
      logger.error('Failed to generate barcode', err, {
        component: 'ProductBarcodeGenerator',
        value,
        format,
      });
      return null;
    }
  }, []);

  // Generate barcodes
  const handleGenerate = useCallback(async () => {
    if (!selectedProduct && !useCustomValue) {
      toast.error('Please select a product or provide a custom value');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedBarcodes([]);

    try {
      const newBarcodes: GeneratedBarcode[] = [];

      for (let i = 0; i < quantity; i++) {
        const value = getBarcodeValue(selectedProduct, i);

        // Validate
        if (!validateBarcodeValue(value, barcodeFormat)) {
          throw new Error(`Invalid barcode value "${value}" for format ${barcodeFormat}`);
        }

        // Generate
        const dataUrl = generateBarcodeDataUrl(value, barcodeFormat);
        if (!dataUrl) {
          throw new Error(`Failed to generate barcode for value "${value}"`);
        }

        newBarcodes.push({
          value,
          format: barcodeFormat,
          dataUrl,
          label: selectedProduct?.name || customValue || value,
        });
      }

      setGeneratedBarcodes(newBarcodes);

      logger.info('Barcodes generated successfully', {
        component: 'ProductBarcodeGenerator',
        count: newBarcodes.length,
        format: barcodeFormat,
      });

      toast.success(`Generated ${newBarcodes.length} barcode${newBarcodes.length > 1 ? 's' : ''}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate barcodes';
      setError(message);
      logger.error('Barcode generation failed', err, {
        component: 'ProductBarcodeGenerator',
      });
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedProduct, useCustomValue, quantity, barcodeFormat, getBarcodeValue, validateBarcodeValue, generateBarcodeDataUrl, customValue]);

  // Download single barcode
  const handleDownloadBarcode = useCallback((barcode: GeneratedBarcode) => {
    const link = document.createElement('a');
    link.download = `barcode-${barcode.value}.png`;
    link.href = barcode.dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Barcode downloaded');
  }, []);

  // Download all barcodes as a single image
  const handleDownloadAll = useCallback(async () => {
    if (generatedBarcodes.length === 0) return;

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      const barcodeWidth = 300;
      const barcodeHeight = 150;
      const padding = 20;
      const cols = Math.min(generatedBarcodes.length, 3);
      const rows = Math.ceil(generatedBarcodes.length / cols);

      canvas.width = cols * (barcodeWidth + padding) + padding;
      canvas.height = rows * (barcodeHeight + padding) + padding;

      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw each barcode
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };

      for (let i = 0; i < generatedBarcodes.length; i++) {
        const barcode = generatedBarcodes[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padding + col * (barcodeWidth + padding);
        const y = padding + row * (barcodeHeight + padding);

        const img = await loadImage(barcode.dataUrl);
        ctx.drawImage(img, x, y, barcodeWidth, barcodeHeight - 20);

        // Add label
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(barcode.label.slice(0, 30), x + barcodeWidth / 2, y + barcodeHeight - 5);
      }

      // Download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `barcodes-${Date.now()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('All barcodes downloaded');
    } catch (err) {
      logger.error('Failed to download barcodes', err, {
        component: 'ProductBarcodeGenerator',
      });
      toast.error('Failed to download barcodes');
    }
  }, [generatedBarcodes]);

  // Print barcodes
  const handlePrint = useCallback(() => {
    if (generatedBarcodes.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Could not open print window. Please allow popups.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Product Barcodes</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .barcode-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
            }
            .barcode-item {
              text-align: center;
              padding: 10px;
              border: 1px solid #ddd;
              break-inside: avoid;
            }
            .barcode-item img {
              max-width: 100%;
              height: auto;
            }
            .barcode-label {
              margin-top: 5px;
              font-size: 12px;
              color: #333;
            }
            .barcode-value {
              font-family: monospace;
              font-size: 10px;
              color: #666;
            }
            @media print {
              .barcode-grid {
                grid-template-columns: repeat(3, 1fr);
              }
            }
          </style>
        </head>
        <body>
          <div class="barcode-grid">
            ${generatedBarcodes.map(barcode => `
              <div class="barcode-item">
                <img src="${barcode.dataUrl}" alt="Barcode" />
                <div class="barcode-label">${barcode.label}</div>
                <div class="barcode-value">${barcode.value}</div>
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }, [generatedBarcodes]);

  // Copy barcode value to clipboard
  const handleCopyValue = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue(null), 2000);
      toast.success('Barcode value copied');
    } catch {
      toast.error('Failed to copy value');
    }
  }, []);

  const content = (
    <div className="space-y-6">
      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Barcode Configuration
          </CardTitle>
          <CardDescription>
            Configure barcode settings for your products
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Selection (if no product provided) */}
          {!product && (
            <div className="space-y-2">
              <Label>Select Product</Label>
              {productsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.sku && `(${p.sku})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Selected Product Info */}
          {selectedProduct && (
            <div className="rounded-lg bg-muted p-3">
              <p className="font-medium">{selectedProduct.name}</p>
              <p className="text-sm text-muted-foreground">
                SKU: {selectedProduct.sku || 'Not set'} |
                Barcode: {selectedProduct.barcode || 'Not set'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Barcode Format */}
            <div className="space-y-2">
              <Label>Barcode Format</Label>
              <Select
                value={barcodeFormat}
                onValueChange={(v) => setBarcodeFormat(v as BarcodeFormat)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE128">CODE128 (Recommended)</SelectItem>
                  <SelectItem value="CODE39">CODE39 (Alphanumeric)</SelectItem>
                  <SelectItem value="EAN13">EAN13 (13 digits)</SelectItem>
                  <SelectItem value="UPC">UPC (12 digits)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {barcodeFormat === 'CODE128' && 'Supports any ASCII characters. Best for general use.'}
                {barcodeFormat === 'CODE39' && 'Supports A-Z, 0-9, and some special characters.'}
                {barcodeFormat === 'EAN13' && 'Requires exactly 12-13 numeric digits.'}
                {barcodeFormat === 'UPC' && 'Requires exactly 11-12 numeric digits.'}
              </p>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">
                Generate up to 100 barcodes at once
              </p>
            </div>
          </div>

          {/* Custom Value Option */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="useCustomValue"
                checked={useCustomValue}
                onCheckedChange={(checked) => setUseCustomValue(checked === true)}
              />
              <Label htmlFor="useCustomValue" className="cursor-pointer">
                Use custom barcode value
              </Label>
            </div>

            {useCustomValue && (
              <Input
                placeholder="Enter custom barcode value"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
              />
            )}
          </div>

          {/* Include QR Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeQR"
              checked={includeQR}
              onCheckedChange={(checked) => setIncludeQR(checked === true)}
            />
            <Label htmlFor="includeQR" className="cursor-pointer flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Also generate QR code with product data
            </Label>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || (!selectedProduct && !useCustomValue)}
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
                Generate {quantity > 1 ? `${quantity} Barcodes` : 'Barcode'}
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generated Barcodes Section */}
      {generatedBarcodes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated Barcodes ({generatedBarcodes.length})</CardTitle>
                <CardDescription>
                  Click on a barcode to download it individually
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                  <Download className="h-4 w-4 mr-2" />
                  Download All
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedBarcodes.map((barcode, index) => (
                <Card
                  key={`${barcode.value}-${index}`}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleDownloadBarcode(barcode)}
                >
                  <div className="space-y-3 text-center">
                    <p className="font-medium text-sm truncate">{barcode.label}</p>

                    {/* Barcode Image */}
                    <div className="flex justify-center p-2 bg-white rounded">
                      <img
                        src={barcode.dataUrl}
                        alt={`Barcode: ${barcode.value}`}
                        className="max-w-full h-auto"
                        style={{ maxHeight: '80px' }}
                      />
                    </div>

                    {/* QR Code (if enabled) */}
                    {includeQR && selectedProduct && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-2">QR Code</p>
                        <div className="flex justify-center">
                          <QRCodeSVG
                            value={JSON.stringify({
                              sku: selectedProduct.sku,
                              barcode: barcode.value,
                              name: selectedProduct.name,
                            })}
                            size={80}
                            level="M"
                          />
                        </div>
                      </div>
                    )}

                    {/* Barcode Value with Copy */}
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {barcode.value}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyValue(barcode.value);
                        }}
                      >
                        {copiedValue === barcode.value ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Format: {barcode.format}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Render as dialog or inline based on mode
  if (mode === 'dialog') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5" />
              Product Barcode Generator
            </DialogTitle>
            <DialogDescription>
              Generate scannable barcodes for your products
            </DialogDescription>
          </DialogHeader>
          {content}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange?.(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return content;
}
