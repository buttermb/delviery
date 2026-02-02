/**
 * Product QR Code Generator Component
 * Generates QR codes that link to product pages in the storefront
 */

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Download from "lucide-react/dist/esm/icons/download";
import Copy from "lucide-react/dist/esm/icons/copy";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Printer from "lucide-react/dist/esm/icons/printer";
import QrCode from "lucide-react/dist/esm/icons/qr-code";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'];

interface MarketplaceStore {
  id: string;
  store_name: string;
  slug: string;
  is_active: boolean;
}

interface ProductQRGeneratorProps {
  product: Pick<Product, 'id' | 'name' | 'sku' | 'category' | 'strain_name'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type QRSize = 'small' | 'medium' | 'large';

const QR_SIZES: Record<QRSize, { size: number; label: string }> = {
  small: { size: 160, label: 'Small (160px)' },
  medium: { size: 240, label: 'Medium (240px)' },
  large: { size: 320, label: 'Large (320px)' },
};

export function ProductQRGenerator({ product, open, onOpenChange }: ProductQRGeneratorProps) {
  const { tenant } = useTenantAdminAuth();
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [qrSize, setQrSize] = useState<QRSize>('medium');
  const [downloading, setDownloading] = useState(false);

  // Fetch available stores for the tenant
  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['marketplace-stores-for-qr', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, store_name, slug, is_active')
        .eq('tenant_id', tenant.id)
        .order('store_name', { ascending: true });

      if (error) {
        logger.error('Failed to fetch stores for QR generator', error, {
          component: 'ProductQRGenerator',
        });
        return [];
      }

      return data as MarketplaceStore[];
    },
    enabled: !!tenant?.id && open,
  });

  // Auto-select first store when stores load
  const selectedStore = stores.find(s => s.id === selectedStoreId) || (stores.length > 0 ? stores[0] : null);

  // Generate the product URL
  const productUrl = selectedStore
    ? `${window.location.origin}/shop/${selectedStore.slug}/products/${product.id}`
    : '';

  const downloadQRCode = async () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    try {
      setDownloading(true);

      // Create canvas from SVG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve();
        };
        img.onerror = reject;
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
      });

      // Download
      const link = document.createElement('a');
      const safeName = (product.sku || product.name || 'product').replace(/[^a-zA-Z0-9-_]/g, '_');
      link.download = `qr-${safeName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success('QR code downloaded successfully');

      logger.info('Product QR code downloaded', {
        component: 'ProductQRGenerator',
        productId: product.id,
        storeSlug: selectedStore?.slug,
      });
    } catch (error) {
      logger.error('Failed to download QR code', error, {
        component: 'ProductQRGenerator',
      });
      toast.error('Failed to download QR code');
    } finally {
      setDownloading(false);
    }
  };

  const copyLink = () => {
    if (!productUrl) {
      toast.error('Please select a store first');
      return;
    }

    navigator.clipboard.writeText(productUrl);
    setCopied(true);
    toast.success('Product link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (!productUrl) {
      toast.error('Please select a store first');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name}`,
          url: productUrl,
        });
        toast.success('Link shared successfully');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          logger.error('Error sharing product link:', error, {
            component: 'ProductQRGenerator',
          });
          copyLink(); // Fallback to copy
        }
      }
    } else {
      copyLink();
    }
  };

  const printQRCode = () => {
    if (!selectedStore) {
      toast.error('Please select a store first');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Failed to open print window. Please check your popup blocker.');
      return;
    }

    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${product.name}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
            }
            .container {
              text-align: center;
              padding: 40px;
            }
            h1 {
              margin-bottom: 8px;
              font-size: 24px;
              color: #333;
            }
            .subtitle {
              margin-bottom: 24px;
              font-size: 14px;
              color: #666;
            }
            .qr-container {
              margin: 32px 0;
              padding: 24px;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              display: inline-block;
              background: white;
            }
            .url {
              margin-top: 24px;
              padding: 12px 16px;
              background: #f3f4f6;
              border-radius: 8px;
              font-size: 11px;
              word-break: break-all;
              color: #666;
              max-width: 400px;
            }
            .product-info {
              margin-top: 16px;
              font-size: 12px;
              color: #888;
            }
            @media print {
              body { margin: 0; }
              .container { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${product.name}</h1>
            <div class="subtitle">Scan to view product details</div>
            <div class="qr-container">
              ${svgData}
            </div>
            <div class="url">${productUrl}</div>
            ${product.sku ? `<div class="product-info">SKU: ${product.sku}</div>` : ''}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const openProductPage = () => {
    if (!productUrl) {
      toast.error('Please select a store first');
      return;
    }
    window.open(productUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Product QR Code
          </DialogTitle>
          <DialogDescription>
            Generate a QR code that links directly to {product.name} in your storefront
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Store Selector */}
          <div className="space-y-2">
            <Label>Select Store</Label>
            {storesLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : stores.length === 0 ? (
              <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                No stores found. Please create a store first.
              </div>
            ) : (
              <Select
                value={selectedStore?.id || ''}
                onValueChange={(value) => setSelectedStoreId(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a store..." />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      <span className="flex items-center gap-2">
                        {store.store_name}
                        {!store.is_active && (
                          <span className="text-xs text-muted-foreground">(Inactive)</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* QR Size Selector */}
          <div className="space-y-2">
            <Label>QR Code Size</Label>
            <Select value={qrSize} onValueChange={(v) => setQrSize(v as QRSize)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(QR_SIZES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* QR Code Display */}
          {selectedStore ? (
            <div className="flex justify-center p-6 bg-muted rounded-lg" ref={qrRef}>
              <QRCodeSVG
                value={productUrl}
                size={QR_SIZES[qrSize].size}
                level="H"
                includeMargin={true}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center p-12 bg-muted/50 rounded-lg border-2 border-dashed">
              <p className="text-sm text-muted-foreground">
                Select a store to generate QR code
              </p>
            </div>
          )}

          {/* Product URL */}
          {selectedStore && (
            <div className="space-y-2">
              <Label>Product Link</Label>
              <div className="flex gap-2">
                <Input
                  value={productUrl}
                  readOnly
                  className="flex-1 text-sm font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  title="Copy link"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={openProductPage}
                  title="Open product page"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {selectedStore && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={downloadQRCode}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download
              </Button>
              <Button variant="outline" onClick={printQRCode}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" onClick={shareLink} className="col-span-2">
                <Share2 className="h-4 w-4 mr-2" />
                Share Link
              </Button>
            </div>
          )}
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
