import { logger } from '@/lib/logger';
import { useRef } from 'react';
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
import { Download, Copy, Share2, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { useState } from 'react';

interface QRCodeDialogProps {
  open: boolean;
  onClose: () => void;
  menuTitle: string;
  accessUrl: string;
  menuId: string;
}

export function QRCodeDialog({ open, onClose, menuTitle, accessUrl, menuId }: QRCodeDialogProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

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
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Download
      const link = document.createElement('a');
      link.download = `menu-qr-${menuId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success("QR code has been saved to your downloads");
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(accessUrl);
    setCopied(true);
    toast.success("Access link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: menuTitle,
          text: `Check out ${menuTitle}`,
          url: accessUrl,
        });
        toast.success("Menu link has been shared");
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          logger.error('Error sharing:', error);
        }
      }
    } else {
      copyLink();
    }
  };

  const printQRCode = () => {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;

    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${menuTitle}</title>
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
              margin-bottom: 20px;
              font-size: 24px;
              color: #333;
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
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${menuTitle}</h1>
            <div class="qr-container">
              ${svgData}
            </div>
            <div class="url">${accessUrl}</div>
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
          <DialogTitle>Share Menu</DialogTitle>
          <DialogDescription>
            Scan this QR code or share the link to provide access to {menuTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* QR Code Display */}
          <div className="flex justify-center p-8 bg-muted rounded-lg" ref={qrRef}>
            <QRCodeSVG
              value={accessUrl}
              size={240}
              level="H"
              includeMargin={true}
            />
          </div>

          {/* Access URL */}
          <div className="space-y-2">
            <Label>Access Link</Label>
            <div className="flex gap-2">
              <Input
                value={accessUrl}
                readOnly
                className="flex-1 text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyLink}
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
              Download QR
            </Button>
            <Button variant="outline" onClick={printQRCode}>
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
