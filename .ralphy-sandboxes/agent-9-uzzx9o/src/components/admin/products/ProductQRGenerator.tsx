import { useRef, useState } from 'react';
import { logger } from '@/lib/logger';
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
import Download from "lucide-react/dist/esm/icons/download";
import Copy from "lucide-react/dist/esm/icons/copy";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Printer from "lucide-react/dist/esm/icons/printer";
import QrCode from "lucide-react/dist/esm/icons/qr-code";
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
export interface ProductQRGeneratorProps {
  open: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sku?: string | null;
    image_url?: string | null;
  };
  storeSlug: string;
}

/**
 * ProductQRGenerator creates QR codes that link to a product's storefront page.
 *
 * The QR code links to: /shop/{storeSlug}/products/{productId}
 *
 * Features:
 * - Download QR code as PNG
 * - Copy product link to clipboard
 * - Share via Web Share API (mobile)
 * - Print QR code with product details
 */
export function ProductQRGenerator({
  open,
  onClose,
  product,
  storeSlug,
}: ProductQRGeneratorProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Build the product URL for the QR code
  const productUrl = `${window.location.origin}/shop/${storeSlug}/products/${product.id}`;

  const downloadQRCode = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    // Create canvas from SVG
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    img.onload = () => {
      // Use higher resolution for better quality
      const scale = 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.scale(scale, scale);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);

      // Generate filename using product name or SKU
      const safeName = product.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const filename = product.sku
        ? `product-qr-${product.sku}.png`
        : `product-qr-${safeName}.png`;

      // Download
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success("Product QR code has been saved to your downloads");
    };

    img.onerror = () => {
      logger.error('Failed to load SVG for QR code download');
      toast.error("Failed to generate QR code image");
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
      setCopied(true);
      toast.success("Product link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.error('Failed to copy link:', error);
      toast.error("Failed to copy link to clipboard");
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name}`,
          url: productUrl,
        });
        toast.success("Product link has been shared");
      } catch (error) {
        // User cancelled share - don't show error
        if ((error as Error).name !== 'AbortError') {
          logger.error('Error sharing:', error);
        }
      }
    } else {
      // Fallback to copy
      copyLink();
    }
  };

  const printQRCode = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      toast.error("Please allow pop-ups to print the QR code");
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
            .sku {
              margin-bottom: 20px;
              font-size: 14px;
              color: #666;
              font-family: monospace;
            }
            .qr-container {
              margin: 40px 0;
              padding: 20px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              display: inline-block;
            }
            .url {
              margin-top: 20px;
              padding: 12px;
              background: #f3f4f6;
              border-radius: 6px;
              font-size: 12px;
              word-break: break-all;
              color: #666;
              max-width: 300px;
            }
            .instructions {
              margin-top: 16px;
              font-size: 14px;
              color: #888;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${product.name}</h1>
            ${product.sku ? `<div class="sku">SKU: ${product.sku}</div>` : ''}
            <div class="qr-container">
              ${svgData}
            </div>
            <div class="url">${productUrl}</div>
            <div class="instructions">Scan to view product details</div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Product QR Code
          </DialogTitle>
          <DialogDescription>
            Scan this QR code to view {product.name} on the storefront
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-12 h-12 rounded object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-muted-foreground/20 flex items-center justify-center">
                <QrCode className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{product.name}</p>
              {product.sku && (
                <p className="text-sm text-muted-foreground font-mono">
                  SKU: {product.sku}
                </p>
              )}
            </div>
          </div>

          {/* QR Code Display */}
          <div className="flex justify-center p-8 bg-muted rounded-lg" ref={qrRef}>
            <QRCodeSVG
              value={productUrl}
              size={240}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Product URL */}
          <div className="space-y-2">
            <Label>Product Link</Label>
            <div className="flex gap-2">
              <Input
                value={productUrl}
                readOnly
                className="flex-1 text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyLink}
                title="Copy link"
                aria-label="Copy link"
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={downloadQRCode}>
              <Download className="h-4 w-4 mr-2" />
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
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
