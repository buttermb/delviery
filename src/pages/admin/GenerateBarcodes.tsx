/**
 * Advanced Barcode & QR Code Generator
 * Generate barcodes for products, packages, batches, and custom labels
 */

import { useState } from 'react';
import { logger } from '@/lib/logger';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { BarcodeGenerator } from '@/components/inventory/BarcodeGenerator';
import { QRCodeSVG } from 'qrcode.react';
import {
  Download,
  Printer,
  Barcode,
  Package,
  Layers,
  FileText,
  Settings,
  Eye,
  Grid3x3
} from 'lucide-react';
import { toast } from 'sonner';
import {
  createPackageQRData,
  type QRCodeData
} from '@/utils/barcodeService';
import jsPDF from 'jspdf';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { queryKeys } from '@/lib/queryKeys';

type BarcodeType = 'CODE128' | 'EAN13' | 'CODE39' | 'QR';
type LabelType = 'product' | 'small_package' | 'batch' | 'custom';
type GenerationMode = 'product' | 'package' | 'batch' | 'custom';

interface GeneratedBarcode {
  id: string;
  value: string;
  type: BarcodeType;
  label?: string;
  qrData?: QRCodeData;
}

export default function GenerateBarcodes() {
  const { tenant, loading: tenantLoading } = useTenantAdminAuth();
  // Generation mode
  const [mode, setMode] = useState<GenerationMode>('product');
  const [barcodeType, setBarcodeType] = useState<BarcodeType>('CODE128');
  const [labelType, setLabelType] = useState<LabelType>('product');

  // Product mode
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [productQuantity, setProductQuantity] = useState(10);
  const [includeQR, setIncludeQR] = useState(true);

  // Package mode
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [packageSizes, setPackageSizes] = useState<string>('10,8,5,2'); // comma-separated lbs

  // Custom mode
  const [customPrefix, setCustomPrefix] = useState('');
  const [customQuantity, setCustomQuantity] = useState(10);
  const [customLabel, setCustomLabel] = useState('');

  // Generated barcodes
  const [generatedBarcodes, setGeneratedBarcodes] = useState<GeneratedBarcode[]>([]);
  const [loading, setLoading] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [previewMode, setPreviewMode] = useState<'grid' | 'list'>('grid');

  // Fetch products
  const { data: products } = useQuery({
    queryKey: queryKeys.productsForBarcode.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, wholesale_price')
        .order('name');
      return data ?? [];
    },
    enabled: !!tenant?.id && !tenantLoading && mode === 'product',
  });

  // Fetch batches
  // Temporarily disabled - inventory_batches table not yet created
  const batches: Array<{ id: string;[key: string]: unknown }> = [];

  // Generate barcodes based on mode
  const handleGenerate = async () => {
    if (!tenant) {
      toast.error("Tenant not found");
      return;
    }

    setLoading(true);
    try {
      const newBarcodes: GeneratedBarcode[] = [];

      if (mode === 'product' && selectedProduct) {
        const product = products?.find(p => p.id === selectedProduct);
        if (!product) throw new Error('Product not found');

        // Generate barcodes for product
        for (let i = 1; i <= productQuantity; i++) {
          const barcodeValue = product.sku
            ? `${product.sku}-${String(i).padStart(4, '0')}`
            : `PRD-${selectedProduct.substring(0, 8).toUpperCase()}-${String(i).padStart(4, '0')}`;

          newBarcodes.push({
            id: `barcode-${i}`,
            value: barcodeValue,
            type: barcodeType,
            label: product.name,
          });
        }
      } else if (mode === 'package' && selectedBatch) {
        const batch = batches?.find(b => b.id === selectedBatch);
        if (!batch) throw new Error('Batch not found');

        const sizes = packageSizes.split(',').map(s => parseFloat(s.trim())).filter(n => n > 0);
        if (sizes.length === 0) throw new Error('Invalid package sizes');

        // Generate package numbers and barcodes
        for (let i = 0; i < sizes.length; i++) {
          const batchNumber = String(batch.batch_number || '');
          const productId = String(batch.product_id || '');
          const productName = (batch.products as { name?: string })?.name || 'Unknown';
          const packageNumber = `PKG-${batchNumber}-${String(i + 1).padStart(3, '0')}`;

          // Create QR data for package
          const qrData = createPackageQRData({
            packageId: `temp-${i}`,
            packageNumber,
            productId,
            productName,
            batchId: batch.id,
            batchNumber,
            weight: sizes[i],
            unit: 'lbs',
            packagedDate: new Date().toISOString(),
            locationId: 'temp',
            locationName: 'Warehouse',
            chainOfCustody: [],
          });

          newBarcodes.push({
            id: `package-${i}`,
            value: packageNumber,
            type: barcodeType,
            label: `${((batch.products as { name?: string })?.name) || 'Product'} - ${sizes[i]} lbs`,
            qrData,
          });
        }
      } else if (mode === 'custom') {
        if (!customPrefix) throw new Error('Prefix required');

        for (let i = 1; i <= customQuantity; i++) {
          const barcodeValue = `${customPrefix}-${String(i).padStart(6, '0')}`;
          newBarcodes.push({
            id: `custom-${i}`,
            value: barcodeValue,
            type: barcodeType,
            label: customLabel || barcodeValue,
          });
        }
      } else {
        throw new Error('Invalid generation mode or missing data');
      }

      setGeneratedBarcodes(newBarcodes);
      toast.success("Generated ${newBarcodes.length} ${mode === ");
    } catch (error: unknown) {
      logger.error('Error generating barcodes', error, { component: 'GenerateBarcodes' });
      const _errorMessage = error instanceof Error ? error.message : 'Failed to generate barcodes';
      toast.error("Error");
    } finally {
      setLoading(false);
    }
  };

  // Print all labels as PDF
  const handlePrintAll = async () => {
    if (generatedBarcodes.length === 0) return;

    setPdfGenerating(true);
    toast.success("Please wait while we create your label sheet");

    try {
      // Defer heavy operation to avoid blocking UI
      await new Promise(resolve => setTimeout(resolve, 100));

      // For now, use print sheet for all labels
      // Individual label printing can be added later with proper QR code rendering
      await handlePrintSheet();
    } catch (error: unknown) {
      const _errorMessage = error instanceof Error ? error.message : 'Failed to generate PDFs';
      toast.error("Error");
    } finally {
      setPdfGenerating(false);
    }
  };

  // Print single barcode sheet
  const handlePrintSheet = async () => {
    if (generatedBarcodes.length === 0) return;

    setPdfGenerating(true);

    try {
      // Process in chunks to avoid blocking
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
      const spacing = 0.2;

      let index = 0;
      let page = 0;

      // Process in batches to keep UI responsive
      const chunkSize = 10;
      for (let i = 0; i < generatedBarcodes.length; i += chunkSize) {
        const chunk = generatedBarcodes.slice(i, i + chunkSize);

        // Yield to browser between chunks
        await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

        for (const barcode of chunk) {
          if (index >= rows * cols) {
            pdf.addPage();
            index = 0;
            page++;
          }

          const col = index % cols;
          const row = Math.floor(index / cols);

          const x = margin + col * (cardWidth + spacing);
          const y = margin + row * (cardHeight + spacing) + (page * 11);

          // Draw border
          pdf.setDrawColor(200, 200, 200);
          pdf.rect(x, y, cardWidth, cardHeight);

          // Add barcode data
          pdf.setFontSize(8);
          pdf.text(barcode.label || barcode.value, x + 0.1, y + 0.15, { maxWidth: cardWidth - 0.2 });
          pdf.setFontSize(7);
          pdf.text(barcode.value, x + 0.1, y + 0.8, { maxWidth: cardWidth - 0.2 });

          index++;
        }
      }

      pdf.save(`barcode_sheet_${Date.now()}.pdf`);
      toast.success("Barcode sheet downloaded");
    } finally {
      setPdfGenerating(false);
    }
  };

  // Handle print preview with async loading
  const handlePrintPreview = async () => {
    setPdfGenerating(true);
    toast.success("Please wait");

    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 100));
      window.print();
    } finally {
      setPdfGenerating(false);
    }
  };

  if (tenantLoading) {
    return <EnhancedLoadingState variant="card" message="Loading barcode generator..." />;
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No tenant found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold">Barcode & QR Code Generator</h1>
          <p className="text-muted-foreground">
            Generate professional barcodes and QR codes for inventory tracking
          </p>
        </div>
      </div>

      <Tabs defaultValue={mode} onValueChange={(v) => setMode(v as GenerationMode)} className="space-y-6 print:hidden">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="product">
            <Package className="h-4 w-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="package">
            <Layers className="h-4 w-4 mr-2" />
            Packages
          </TabsTrigger>
          <TabsTrigger value="batch">
            <FileText className="h-4 w-4 mr-2" />
            Batches
          </TabsTrigger>
          <TabsTrigger value="custom">
            <Settings className="h-4 w-4 mr-2" />
            Custom
          </TabsTrigger>
        </TabsList>

        {/* Product Mode */}
        <TabsContent value="product" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Product Barcodes</CardTitle>
              <CardDescription>
                Generate barcodes for existing products
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Product</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} {product.sku && `(${product.sku})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={productQuantity}
                    onChange={(e) => setProductQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Barcode Type</Label>
                  <Select value={barcodeType} onValueChange={(v) => setBarcodeType(v as BarcodeType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select barcode type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CODE128">CODE128 (Recommended)</SelectItem>
                      <SelectItem value="EAN13">EAN13</SelectItem>
                      <SelectItem value="CODE39">CODE39</SelectItem>
                      <SelectItem value="QR">QR Code</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Label Type</Label>
                  <Select value={labelType} onValueChange={(v) => setLabelType(v as LabelType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select label type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product Label (4x6)</SelectItem>
                      <SelectItem value="small_package">Small Package (2x1)</SelectItem>
                      <SelectItem value="batch">Batch Label (4x6)</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeQR"
                  checked={includeQR}
                  onCheckedChange={(checked) => setIncludeQR(checked === true)}
                />
                <Label htmlFor="includeQR" className="cursor-pointer">
                  Include QR code with full product data
                </Label>
              </div>

              <Button onClick={handleGenerate} disabled={loading || !selectedProduct} className="w-full" size="lg">
                {loading ? 'Generating...' : 'Generate Barcodes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Package Mode */}
        <TabsContent value="package" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Package Barcodes</CardTitle>
              <CardDescription>
                Create packages from batches with automatic barcode/QR generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Batch</Label>
                  <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches?.map(batch => {
                        const batchNumber = String(batch.batch_number || '');
                        const productName = (batch.products as { name?: string })?.name || 'Unknown';
                        const remainingQty = String(batch.remaining_quantity_lbs ?? 0);
                        return (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batchNumber} - {productName} ({remainingQty} lbs remaining)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Package Sizes (lbs, comma-separated)</Label>
                  <Input
                    placeholder="10,8,5,2"
                    value={packageSizes}
                    onChange={(e) => setPackageSizes(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: 10,8,5,2 creates 4 packages
                  </p>
                </div>
              </div>

              <Button onClick={handleGenerate} disabled={loading || !selectedBatch} className="w-full" size="lg">
                {loading ? 'Generating Packages...' : 'Generate Packages'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Mode */}
        <TabsContent value="batch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Batch QR Codes</CardTitle>
              <CardDescription>
                Create QR codes for inventory batches with full tracking data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Batch QR codes are automatically generated when you create a batch in the inventory system.
                Use the "Packages" tab to create packages from existing batches.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Mode */}
        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Barcode Generator</CardTitle>
              <CardDescription>
                Generate barcodes with custom prefix and numbering
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prefix</Label>
                  <Input
                    placeholder="CUST-2024"
                    value={customPrefix}
                    onChange={(e) => setCustomPrefix(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10000"
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Label Text (optional)</Label>
                  <Input
                    placeholder="Custom Label"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Barcode Type</Label>
                  <Select value={barcodeType} onValueChange={(v) => setBarcodeType(v as BarcodeType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select barcode type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CODE128">CODE128</SelectItem>
                      <SelectItem value="EAN13">EAN13</SelectItem>
                      <SelectItem value="CODE39">CODE39</SelectItem>
                      <SelectItem value="QR">QR Code</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleGenerate} disabled={loading || !customPrefix} className="w-full" size="lg">
                {loading ? 'Generating...' : 'Generate Barcodes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generated Barcodes Preview */}
      {/* Generated Barcodes Preview */}
      {generatedBarcodes.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated Barcodes ({generatedBarcodes.length})</CardTitle>
                <CardDescription>
                  Preview and print your barcodes
                </CardDescription>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewMode(previewMode === 'grid' ? 'list' : 'grid')}
                  disabled={pdfGenerating}
                >
                  {previewMode === 'grid' ? <Grid3x3 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrintSheet}
                  disabled={pdfGenerating}
                >
                  {pdfGenerating ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Sheet
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrintAll}
                  disabled={pdfGenerating}
                >
                  {pdfGenerating ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4 mr-2" />
                      Print All Labels
                    </>
                  )}
                </Button>
                <Button
                  onClick={handlePrintPreview}
                  disabled={pdfGenerating}
                >
                  {pdfGenerating ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Preparing...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4 mr-2" />
                      Print Preview
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {previewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedBarcodes.map((barcode) => (
                  <Card key={barcode.id} className="p-4">
                    <div className="text-center space-y-3">
                      <p className="font-semibold text-sm">{barcode.label || barcode.value}</p>

                      {barcode.type === 'QR' ? (
                        <div className="flex justify-center">
                          <QRCodeSVG
                            value={barcode.value}
                            size={150}
                            level="M"
                          />
                        </div>
                      ) : (
                        <>
                          <BarcodeGenerator
                            value={barcode.value}
                            format={barcode.type as 'CODE128' | 'EAN13' | 'CODE39'}
                            height={60}
                            width={2}
                          />
                          {barcode.qrData && (
                            <div className="pt-2 border-t">
                              <p className="text-xs text-muted-foreground mb-1">Package QR Code</p>
                              <QRCodeSVG
                                value={JSON.stringify(barcode.qrData)}
                                size={100}
                                level="M"
                              />
                            </div>
                          )}
                        </>
                      )}

                      <p className="text-xs font-mono text-muted-foreground break-all">
                        {barcode.value}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {generatedBarcodes.map((barcode) => (
                  <div key={barcode.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{barcode.label || barcode.value}</p>
                      <p className="text-xs text-muted-foreground font-mono">{barcode.value}</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      {barcode.type === 'QR' ? (
                        <QRCodeSVG
                          value={barcode.value}
                          size={80}
                          level="M"
                        />
                      ) : (
                        <div className="w-32">
                          <BarcodeGenerator
                            value={barcode.value}
                            format={barcode.type as 'CODE128' | 'EAN13' | 'CODE39'}
                            height={50}
                            width={1.5}
                          />
                        </div>
                      )}
                      {barcode.qrData && barcode.type !== 'QR' && (
                        <QRCodeSVG
                          value={JSON.stringify(barcode.qrData)}
                          size={80}
                          level="M"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <EnhancedEmptyState
          icon={Barcode}
          title="No Barcodes Generated"
          description="Use the forms above to generate products, packages, batches, or custom barcodes."
        />
      )}
    </div>
  );
}
