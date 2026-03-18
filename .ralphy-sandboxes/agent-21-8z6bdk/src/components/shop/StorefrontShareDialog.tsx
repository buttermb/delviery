/**
 * Storefront Share Dialog
 * Customer-facing dialog for sharing a store via URL copy, QR code, and social buttons
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  Copy,
  CheckCircle2,
  QrCode,
  Download,
  Loader2,
  Link,
  MessageCircle,
  Mail,
  Smartphone,
  Share2,
} from 'lucide-react';
import { generateQRCodeDataURL, downloadQRCodePNG } from '@/lib/utils/qrCode';
import { humanizeError } from '@/lib/humanizeError';

interface StorefrontShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName: string;
  storeSlug: string;
  storeUrl?: string;
}

export function StorefrontShareDialog({
  open,
  onOpenChange,
  storeName,
  storeSlug,
  storeUrl,
}: StorefrontShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('link');

  const shareUrl = storeUrl || (typeof window !== 'undefined' ? `${window.location.origin}/shop/${storeSlug}` : '');
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(`Check out ${storeName}!`);

  // Generate QR code when dialog opens or URL changes
  useEffect(() => {
    if (open && shareUrl) {
      setQrLoading(true);
      generateQRCodeDataURL(shareUrl, { size: 256 })
        .then(setQrCodeDataUrl)
        .catch((error) => {
          logger.error('Failed to generate QR code', error, { component: 'StorefrontShareDialog' });
        })
        .finally(() => setQrLoading(false));
    }
  }, [open, shareUrl]);

  // Reset copied state when dialog closes
  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied!', { description: 'Share it with your friends' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  const handleDownloadQR = async () => {
    if (!shareUrl) return;
    try {
      await downloadQRCodePNG(shareUrl, `${storeSlug}-qr.png`, { size: 512 });
      toast.success('QR Code downloaded!');
    } catch (error) {
      toast.error('Download failed', { description: humanizeError(error) });
    }
  };

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(
      `Check out ${storeName}!\n\nShop here: ${shareUrl}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const shareViaSMS = () => {
    const message = encodeURIComponent(
      `Check out ${storeName}! Shop here: ${shareUrl}`
    );
    window.open(`sms:?body=${message}`, '_blank', 'noopener,noreferrer');
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Check out ${storeName}`);
    const body = encodeURIComponent(
      `Hey!\n\nI wanted to share this store with you:\n\n${storeName}\n${shareUrl}\n\nCheck out their products!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
  };

  const shareViaTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      '_blank',
      'noopener,noreferrer,width=600,height=400'
    );
  };

  const shareViaFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      '_blank',
      'noopener,noreferrer,width=600,height=400'
    );
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: storeName,
          text: `Check out ${storeName}!`,
          url: shareUrl,
        });
      } catch {
        // User cancelled — not an error
      }
    }
  };

  const hasNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Store
          </DialogTitle>
          <DialogDescription>
            Share {storeName} with friends and family
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">
              <Link className="w-4 h-4 mr-1.5" />
              Link
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="w-4 h-4 mr-1.5" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="social">
              <MessageCircle className="w-4 h-4 mr-1.5" />
              Social
            </TabsTrigger>
          </TabsList>

          {/* Link Tab */}
          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant={copied ? 'default' : 'outline'}
                size="icon"
                onClick={handleCopy}
                aria-label="Copy link"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Copy the link above and send it to anyone
            </p>
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="space-y-4 mt-4">
            <div className="flex flex-col items-center gap-4">
              <div className="w-56 h-56 bg-white rounded-lg flex items-center justify-center border">
                {qrLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                ) : qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt={`QR code for ${storeName}`}
                    className="w-full h-full p-2"
                    loading="lazy"
                  />
                ) : (
                  <QrCode className="w-16 h-16 text-muted-foreground" />
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Scan to visit the store instantly
              </p>
            </div>
          </TabsContent>

          {/* Social Tab */}
          <TabsContent value="social" className="space-y-3 mt-4">
            <Button
              variant="outline"
              className="justify-start w-full h-12"
              onClick={shareViaWhatsApp}
            >
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center mr-3">
                <MessageCircle className="w-4 h-4 text-green-600" />
              </div>
              <span className="font-medium">WhatsApp</span>
            </Button>

            <Button
              variant="outline"
              className="justify-start w-full h-12"
              onClick={shareViaSMS}
            >
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mr-3">
                <Smartphone className="w-4 h-4 text-blue-600" />
              </div>
              <span className="font-medium">SMS</span>
            </Button>

            <Button
              variant="outline"
              className="justify-start w-full h-12"
              onClick={shareViaEmail}
            >
              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center mr-3">
                <Mail className="w-4 h-4 text-purple-600" />
              </div>
              <span className="font-medium">Email</span>
            </Button>

            <Button
              variant="outline"
              className="justify-start w-full h-12"
              onClick={shareViaTwitter}
            >
              <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-sky-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <span className="font-medium">X (Twitter)</span>
            </Button>

            <Button
              variant="outline"
              className="justify-start w-full h-12"
              onClick={shareViaFacebook}
            >
              <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-blue-700" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 7.834 7.834 0 0 0-.733-.009c-.707 0-1.259.096-1.675.345a1.783 1.783 0 0 0-.832.928c-.142.38-.213.862-.213 1.462v1.245h3.992l-.519 3.667H13.63v7.98z" />
                </svg>
              </div>
              <span className="font-medium">Facebook</span>
            </Button>

            {hasNativeShare && (
              <Button
                variant="outline"
                className="justify-start w-full h-12"
                onClick={handleNativeShare}
              >
                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center mr-3">
                  <Share2 className="w-4 h-4 text-orange-600" />
                </div>
                <span className="font-medium">More Options</span>
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
