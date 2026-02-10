import { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Download from 'lucide-react/dist/esm/icons/download';
import Printer from 'lucide-react/dist/esm/icons/printer';
import QrCode from 'lucide-react/dist/esm/icons/qr-code';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Check from 'lucide-react/dist/esm/icons/check';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Package from 'lucide-react/dist/esm/icons/package';
import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical';

// Product type for QR generation
interface ProductForQR {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  retail_price: number | null;
  wholesale_price: number | null;
  lab_results_url: string | null;
  category: string | null;
}

// Disposable menu type
interface DisposableMenu {
  id: string;
  name: string;
  encrypted_url_token: string;
  status: string;
}

// Link destination type
type LinkDestination = 'storefront' | 'menu';

// Generated QR item
interface GeneratedQRItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string | null;
  productImage: string | null;
  url: string;
  includePrice: boolean;
  priceValue: number | null;
  includeLabResults: boolean;
  labResultsUrl: string | null;
}

interface ProductQRProps {
  /** Pre-selected product ID (optional) */
  productId?: string;
  /** Called when QR codes are generated */
  onGenerate?: (qrCodes: GeneratedQRItem[]) => void;
  /** Show as dialog instead of full page */
  asDialog?: boolean;
  /** Dialog open state */
  open?: boolean;
  /** Dialog close handler */
  onClose?: () => void;
}

/**
 * ProductQR - Generate QR codes for products
 *
 * Features:
 * - Link to storefront or specific disposable menu
 * - Optional price display on QR
 * - Optional lab results URL link
 * - Bulk QR generation for multiple products
 * - Download as PNG or print
 */
export function ProductQR({
  productId,
  onGenerate,
  asDialog = false,
  open = true,
  onClose,
}: ProductQRProps) {
  const { tenant, tenantSlug } = useTenantAdminAuth();

  // State
  const [selectedProducts, setSelectedProducts] = useState<string[]>(
    productId ? [productId] : []
  );
  const [linkDestination, setLinkDestination] = useState<LinkDestination>('storefront');
  const [selectedMenuId, setSelectedMenuId] = useState<string>('');
  const [includePrice, setIncludePrice] = useState(false);
  const [includeLabResults, setIncludeLabResults] = useState(false);
  const [generatedQRs, setGeneratedQRs] = useState<GeneratedQRItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  // Fetch products
  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery({
    queryKey: queryKeys.products.byTenant(tenant?.id ?? ''),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, image_url, retail_price, wholesale_price, lab_results_url, category')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for QR generator', { error });
        throw error;
      }

      return (data ?? []) as ProductForQR[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch disposable menus
  const { data: menus, isLoading: menusLoading } = useQuery({
    queryKey: queryKeys.menus.byTenant(tenant?.id ?? ''),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name, encrypted_url_token, status')
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .order('name');

      if (error) {
        logger.error('Failed to fetch menus for QR generator', { error });
        throw error;
      }

      return (data ?? []) as DisposableMenu[];
    },
    enabled: !!tenant?.id && linkDestination === 'menu',
  });

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!searchQuery.trim()) return products;

    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.category && p.category.toLowerCase().includes(query))
    );
  }, [products, searchQuery]);

  // Build QR URL based on destination
  const buildProductUrl = useCallback(
    (product: ProductForQR): string => {
      const baseUrl = window.location.origin;

      if (linkDestination === 'menu' && selectedMenuId) {
        // Link to product on specific menu
        const menu = menus?.find((m) => m.id === selectedMenuId);
        if (menu) {
          return `${baseUrl}/menu/${menu.encrypted_url_token}?product=${product.id}`;
        }
      }

      // Default: link to storefront product page
      if (tenantSlug) {
        return `${baseUrl}/shop/${tenantSlug}/products/${product.id}`;
      }

      // Fallback
      return `${baseUrl}/products/${product.id}`;
    },
    [linkDestination, selectedMenuId, menus, tenantSlug]
  );

  // Generate QR codes
  const handleGenerate = useCallback(async () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }

    if (linkDestination === 'menu' && !selectedMenuId) {
      toast.error('Please select a menu');
      return;
    }

    setIsGenerating(true);

    try {
      const selectedProductData =
        products?.filter((p) => selectedProducts.includes(p.id)) ?? [];

      const newQRs: GeneratedQRItem[] = selectedProductData.map((product) => ({
        id: `qr-${product.id}-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productImage: product.image_url,
        url: buildProductUrl(product),
        includePrice,
        priceValue: includePrice ? (product.retail_price ?? product.wholesale_price) : null,
        includeLabResults,
        labResultsUrl: includeLabResults ? product.lab_results_url : null,
      }));

      setGeneratedQRs(newQRs);
      onGenerate?.(newQRs);
      toast.success(`Generated ${newQRs.length} QR code(s)`);
    } catch (error) {
      logger.error('Failed to generate QR codes', { error });
      toast.error('Failed to generate QR codes');
    } finally {
      setIsGenerating(false);
    }
  }, [
    selectedProducts,
    products,
    linkDestination,
    selectedMenuId,
    includePrice,
    includeLabResults,
    buildProductUrl,
    onGenerate,
  ]);

  // Copy URL to clipboard
  const handleCopyUrl = useCallback(async (qr: GeneratedQRItem) => {
    try {
      await navigator.clipboard.writeText(qr.url);
      setCopiedId(qr.id);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy URL');
    }
  }, []);

  // Download single QR as PNG
  const downloadQRCode = useCallback((qr: GeneratedQRItem, qrElement: SVGSVGElement | null) => {
    if (!qrElement) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(qrElement);
    const img = new Image();

    img.onload = () => {
      const scale = 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.scale(scale, scale);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);

      const safeName = qr.productName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const filename = qr.productSku
        ? `product-qr-${qr.productSku}.png`
        : `product-qr-${safeName}.png`;

      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success('QR code downloaded');
    };

    img.onerror = () => {
      logger.error('Failed to load SVG for QR code download');
      toast.error('Failed to download QR code');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, []);

  // Download all QR codes as PNG files
  const handleBulkDownload = useCallback(async () => {
    if (generatedQRs.length === 0) {
      toast.error('No QR codes to download');
      return;
    }

    toast.info('Downloading QR codes...');

    const qrContainer = printRef.current;
    if (!qrContainer) return;

    const qrElements = qrContainer.querySelectorAll('[data-qr-svg]');

    for (let i = 0; i < generatedQRs.length; i++) {
      const qr = generatedQRs[i];
      const svgElement = qrElements[i]?.querySelector('svg') as SVGSVGElement | null;

      if (svgElement) {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            downloadQRCode(qr, svgElement);
            resolve();
          }, i * 200); // Stagger downloads to avoid browser blocking
        });
      }
    }

    toast.success(`Downloaded ${generatedQRs.length} QR codes`);
  }, [generatedQRs, downloadQRCode]);

  // Print QR codes
  const handlePrint = useCallback(() => {
    if (generatedQRs.length === 0) {
      toast.error('No QR codes to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print');
      return;
    }

    const qrContent = generatedQRs
      .map((qr) => {
        const qrContainer = printRef.current?.querySelector(`[data-qr-id="${qr.id}"]`);
        const svg = qrContainer?.querySelector('svg');
        const svgData = svg ? new XMLSerializer().serializeToString(svg) : '';

        return `
        <div class="qr-card">
          <h3>${qr.productName}</h3>
          ${qr.productSku ? `<p class="sku">SKU: ${qr.productSku}</p>` : ''}
          <div class="qr-container">${svgData}</div>
          ${qr.priceValue ? `<p class="price">$${qr.priceValue.toFixed(2)}</p>` : ''}
          ${qr.labResultsUrl ? `<p class="lab-results">Lab Results Available</p>` : ''}
          <p class="url">${qr.url}</p>
        </div>
      `;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Product QR Codes</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .qr-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
            }
            .qr-card {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 16px;
              text-align: center;
              break-inside: avoid;
            }
            h3 {
              margin: 0 0 4px;
              font-size: 14px;
              font-weight: 600;
            }
            .sku {
              margin: 0 0 12px;
              font-size: 12px;
              color: #666;
              font-family: monospace;
            }
            .qr-container {
              display: flex;
              justify-content: center;
              margin: 12px 0;
            }
            .qr-container svg {
              width: 150px;
              height: 150px;
            }
            .price {
              font-size: 16px;
              font-weight: 600;
              color: #16a34a;
              margin: 8px 0;
            }
            .lab-results {
              font-size: 11px;
              color: #7c3aed;
              margin: 4px 0;
            }
            .url {
              font-size: 9px;
              color: #888;
              word-break: break-all;
              margin-top: 8px;
            }
            @media print {
              .qr-grid { grid-template-columns: repeat(3, 1fr); }
              .qr-card { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="qr-grid">${qrContent}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }, [generatedQRs]);

  // Toggle product selection
  const handleProductToggle = useCallback((id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  // Select all filtered products
  const handleSelectAll = useCallback(() => {
    setSelectedProducts(filteredProducts.map((p) => p.id));
  }, [filteredProducts]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedProducts([]);
  }, []);

  // Loading state
  if (productsLoading) {
    const loadingContent = (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );

    if (asDialog) {
      return (
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
            {loadingContent}
          </DialogContent>
        </Dialog>
      );
    }

    return loadingContent;
  }

  // Error state
  if (productsError) {
    const errorContent = (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p>Failed to load products. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );

    if (asDialog) {
      return (
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent>{errorContent}</DialogContent>
        </Dialog>
      );
    }

    return errorContent;
  }

  // No tenant state
  if (!tenant) {
    const noTenantContent = (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">No tenant context available</p>
        </CardContent>
      </Card>
    );

    if (asDialog) {
      return (
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent>{noTenantContent}</DialogContent>
        </Dialog>
      );
    }

    return noTenantContent;
  }

  const mainContent = (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Product QR Code Generator
          </CardTitle>
          <CardDescription>
            Generate QR codes that link to your products on the storefront or menus
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Link Destination */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Link Destination</Label>
              <Select
                value={linkDestination}
                onValueChange={(v) => setLinkDestination(v as LinkDestination)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="storefront">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Storefront Product Page
                    </div>
                  </SelectItem>
                  <SelectItem value="menu">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Disposable Menu
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {linkDestination === 'menu' && (
              <div className="space-y-2">
                <Label>Select Menu</Label>
                <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a menu..." />
                  </SelectTrigger>
                  <SelectContent>
                    {menusLoading ? (
                      <SelectItem value="" disabled>
                        Loading menus...
                      </SelectItem>
                    ) : menus && menus.length > 0 ? (
                      menus.map((menu) => (
                        <SelectItem key={menu.id} value={menu.id}>
                          {menu.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        No active menus found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-6">
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeLabResults"
                checked={includeLabResults}
                onCheckedChange={(checked) => setIncludeLabResults(checked === true)}
              />
              <Label htmlFor="includeLabResults" className="cursor-pointer flex items-center gap-1">
                <FlaskConical className="h-4 w-4" />
                Include Lab Results URL
              </Label>
            </div>
          </div>

          {/* Product Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Products</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={filteredProducts.length === 0}
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

            <Input
              placeholder="Search products by name, SKU, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <ScrollArea className="h-64 border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                        selectedProducts.includes(product.id) ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleProductToggle(product.id)}
                    >
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => handleProductToggle(product.id)}
                      />
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {product.sku && <span className="font-mono">{product.sku}</span>}
                          {product.category && (
                            <Badge variant="secondary" className="text-xs">
                              {product.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {product.lab_results_url && (
                        <Badge variant="outline" className="text-xs">
                          <FlaskConical className="h-3 w-3 mr-1" />
                          Lab
                        </Badge>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    {searchQuery ? 'No products match your search' : 'No products available'}
                  </p>
                )}
              </div>
            </ScrollArea>

            {selectedProducts.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedProducts.length} product(s) selected
              </p>
            )}
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
                <QrCode className="h-4 w-4 mr-2" />
                Generate QR Codes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated QR Codes */}
      {generatedQRs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated QR Codes ({generatedQRs.length})</CardTitle>
                <CardDescription>
                  Download or print your product QR codes
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleBulkDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download All
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
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {generatedQRs.map((qr) => (
                <Card
                  key={qr.id}
                  data-qr-id={qr.id}
                  className="p-4 relative"
                >
                  <div className="space-y-3">
                    {/* Product Info */}
                    <div className="flex items-start gap-2">
                      {qr.productImage ? (
                        <img
                          src={qr.productImage}
                          alt={qr.productName}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{qr.productName}</p>
                        {qr.productSku && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {qr.productSku}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* QR Code */}
                    <div
                      data-qr-svg
                      className="flex justify-center p-4 bg-muted rounded-lg"
                    >
                      <QRCodeSVG
                        value={qr.url}
                        size={160}
                        level="H"
                        includeMargin={true}
                      />
                    </div>

                    {/* Price & Lab Results */}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {qr.priceValue && (
                        <Badge variant="secondary" className="text-sm">
                          ${qr.priceValue.toFixed(2)}
                        </Badge>
                      )}
                      {qr.labResultsUrl && (
                        <Badge variant="outline" className="text-xs">
                          <FlaskConical className="h-3 w-3 mr-1" />
                          Lab Results
                        </Badge>
                      )}
                    </div>

                    {/* URL */}
                    <div className="flex gap-2">
                      <Input
                        value={qr.url}
                        readOnly
                        className="flex-1 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyUrl(qr)}
                        className="shrink-0"
                      >
                        {copiedId === qr.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Download Single */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const container = printRef.current?.querySelector(
                          `[data-qr-id="${qr.id}"]`
                        );
                        const svg = container?.querySelector('svg') as SVGSVGElement | null;
                        downloadQRCode(qr, svg);
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download PNG
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  if (asDialog) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Generate Product QR Codes
            </DialogTitle>
            <DialogDescription>
              Create QR codes that link to your products
            </DialogDescription>
          </DialogHeader>
          {mainContent}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return mainContent;
}
