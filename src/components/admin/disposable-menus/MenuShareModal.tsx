import { logger } from '@/lib/logger';
import { useRef, useState, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  Copy,
  Share2,
  CheckCircle2,
  Link,
  QrCode,
  Code,
  Printer,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '@/hooks/use-toast';

interface MenuShareModalProps {
  open: boolean;
  onClose: () => void;
  menuTitle: string;
  accessUrl: string;
  menuId: string;
}

export function MenuShareModal({
  open,
  onClose,
  menuTitle,
  accessUrl,
  menuId,
}: MenuShareModalProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [embedWidth, setEmbedWidth] = useState('100%');
  const [embedHeight, setEmbedHeight] = useState('600');

  // Generate embed code based on dimensions
  const embedCode = useMemo(() => {
    return `<iframe
  src="${accessUrl}"
  width="${embedWidth}"
  height="${embedHeight}px"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  title="${menuTitle}"
  allow="clipboard-write"
></iframe>`;
  }, [accessUrl, embedWidth, embedHeight, menuTitle]);

  const copyLink = () => {
    navigator.clipboard.writeText(accessUrl);
    setCopiedLink(true);
    toast({
      title: 'Link Copied',
      description: 'Access link copied to clipboard',
    });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    toast({
      title: 'Embed Code Copied',
      description: 'Embed code copied to clipboard',
    });
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

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

      toast({
        title: 'QR Code Downloaded',
        description: 'QR code has been saved to your downloads',
      });
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: menuTitle,
          text: `Check out ${menuTitle}`,
          url: accessUrl,
        });
        toast({
          title: 'Shared Successfully',
          description: 'Menu link has been shared',
        });
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
    const printWindow = window.open('', '_blank');
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

  const openInNewTab = () => {
    window.open(accessUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Menu</DialogTitle>
          <DialogDescription>
            Share {menuTitle} via link, QR code, or embed on your website
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              <span className="hidden sm:inline">Link</span>
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">QR Code</span>
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">Embed</span>
            </TabsTrigger>
          </TabsList>

          {/* Link Tab */}
          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="flex justify-center p-6 bg-muted rounded-lg" ref={qrRef}>
              <QRCodeSVG
                value={accessUrl}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

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
                  aria-label="Copy link"
                >
                  {copiedLink ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={openInNewTab}
                  aria-label="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={shareLink}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" onClick={downloadQRCode}>
                <Download className="h-4 w-4 mr-2" />
                Download QR
              </Button>
            </div>
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="space-y-4 mt-4">
            <div className="flex justify-center p-8 bg-muted rounded-lg">
              <QRCodeSVG
                value={accessUrl}
                size={280}
                level="H"
                includeMargin={true}
              />
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code to access {menuTitle}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={downloadQRCode}>
                <Download className="h-4 w-4 mr-2" />
                Download PNG
              </Button>
              <Button variant="outline" onClick={printQRCode}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </TabsContent>

          {/* Embed Tab */}
          <TabsContent value="embed" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="embed-width">Width</Label>
                  <Input
                    id="embed-width"
                    value={embedWidth}
                    onChange={(e) => setEmbedWidth(e.target.value)}
                    placeholder="100% or 800"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="embed-height">Height (px)</Label>
                  <Input
                    id="embed-height"
                    value={embedHeight}
                    onChange={(e) => setEmbedHeight(e.target.value)}
                    placeholder="600"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Embed Code</Label>
                <Textarea
                  value={embedCode}
                  readOnly
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>

              <Button onClick={copyEmbedCode} className="w-full">
                {copiedEmbed ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Embed Code
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Paste this code into your website&apos;s HTML to embed the menu.
                The iframe will display your menu with full functionality.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
