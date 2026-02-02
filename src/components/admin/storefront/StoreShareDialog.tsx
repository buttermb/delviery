// @ts-nocheck
/**
 * Store Share Dialog
 * Generate and share encrypted storefront links
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import Copy from "lucide-react/dist/esm/icons/copy";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import QrCode from "lucide-react/dist/esm/icons/qr-code";
import Download from "lucide-react/dist/esm/icons/download";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Link from "lucide-react/dist/esm/icons/link";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import Mail from "lucide-react/dist/esm/icons/mail";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import Eye from "lucide-react/dist/esm/icons/eye";
import Lock from "lucide-react/dist/esm/icons/lock";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import { generateQRCodeDataURL, downloadQRCodePNG } from '@/lib/utils/qrCode';

interface Store {
  id: string;
  store_name: string;
  slug: string;
  encrypted_url_token?: string | null;
  is_active: boolean;
  is_public: boolean;
}

interface StoreShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: Store;
  onRegenerateToken?: () => Promise<void>;
}

export function StoreShareDialog({
  open,
  onOpenChange,
  store,
  onRegenerateToken,
}: StoreShareDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('link');
  const [useEncryptedLink, setUseEncryptedLink] = useState(!!store.encrypted_url_token);
  const [regenerating, setRegenerating] = useState(false);

  // Generate the store URL
  const baseUrl = window.location.origin;
  const publicUrl = `${baseUrl}/shop/${store.slug}`;
  const encryptedUrl = store.encrypted_url_token
    ? `${baseUrl}/s/${store.encrypted_url_token}`
    : null;
  
  const shareUrl = useEncryptedLink && encryptedUrl ? encryptedUrl : publicUrl;

  // Generate QR code when dialog opens
  useEffect(() => {
    if (open && shareUrl) {
      setQrLoading(true);
      generateQRCodeDataURL(shareUrl, { size: 256 })
        .then(setQrCodeDataUrl)
        .catch((error) => {
          logger.error('Failed to generate QR code', error, { component: 'StoreShareDialog' });
        })
        .finally(() => setQrLoading(false));
    }
  }, [open, shareUrl]);

  // Regenerate QR when URL type changes
  useEffect(() => {
    if (open && shareUrl) {
      setQrLoading(true);
      generateQRCodeDataURL(shareUrl, { size: 256 })
        .then(setQrCodeDataUrl)
        .catch(() => {})
        .finally(() => setQrLoading(false));
    }
  }, [useEncryptedLink]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: 'Link copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = async () => {
    if (!shareUrl) return;
    try {
      await downloadQRCodePNG(shareUrl, `store-qr-${store.slug}.png`, { size: 512 });
      toast({ title: 'QR Code downloaded!' });
    } catch (error) {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const handleRegenerateToken = async () => {
    if (!onRegenerateToken) return;
    setRegenerating(true);
    try {
      await onRegenerateToken();
      toast({ title: 'New link generated!', description: 'Previous links will no longer work.' });
    } catch (error) {
      toast({ title: 'Failed to generate new link', variant: 'destructive' });
    } finally {
      setRegenerating(false);
    }
  };

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(
      `Check out ${store.store_name}! 🛒\n\n` +
      `Shop here: ${shareUrl}\n\n` +
      `Browse our products and place your order online.`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareViaSMS = () => {
    const message = encodeURIComponent(
      `Check out ${store.store_name}! Shop here: ${shareUrl}`
    );
    window.open(`sms:?body=${message}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Check out ${store.store_name}`);
    const body = encodeURIComponent(
      `Hey!\n\n` +
      `I wanted to share this store with you:\n\n` +
      `${store.store_name}\n` +
      `${shareUrl}\n\n` +
      `Check out their products and place an order online!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Your Store
          </DialogTitle>
          <DialogDescription>
            Share your storefront link with customers
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">
              <Link className="w-4 h-4 mr-2" />
              Link
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="w-4 h-4 mr-2" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="share">
              <MessageCircle className="w-4 h-4 mr-2" />
              Share
            </TabsTrigger>
          </TabsList>

          {/* Link Tab */}
          <TabsContent value="link" className="space-y-4 mt-4">
            {/* Link Type Toggle */}
            {store.encrypted_url_token && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  {useEncryptedLink ? (
                    <Lock className="w-4 h-4 text-green-600" />
                  ) : (
                    <Eye className="w-4 h-4 text-blue-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {useEncryptedLink ? 'Private Link' : 'Public Link'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {useEncryptedLink
                        ? 'Encrypted URL hides your store slug'
                        : 'Uses your store slug in URL'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={useEncryptedLink}
                  onCheckedChange={setUseEncryptedLink}
                />
              </div>
            )}

            {/* Store URL */}
            <div className="space-y-2">
              <Label>Store URL</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant={copied ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => handleCopy(shareUrl)}
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(shareUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <Badge variant={store.is_active ? 'default' : 'secondary'}>
                {store.is_active ? 'Live' : 'Draft'}
              </Badge>
              <Badge variant={store.is_public ? 'outline' : 'secondary'}>
                {store.is_public ? 'Public' : 'Private'}
              </Badge>
            </div>

            {/* Regenerate Encrypted Link */}
            {onRegenerateToken && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Generate a new private link (invalidates previous one)
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateToken}
                    disabled={regenerating}
                  >
                    {regenerating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4 mr-2" />
                    )}
                    Generate New Private Link
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="space-y-4 mt-4">
            <div className="flex flex-col items-center gap-4">
              <div className="w-64 h-64 bg-white rounded-lg flex items-center justify-center border">
                {qrLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                ) : qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Store QR Code"
                    className="w-full h-full p-2"
                  />
                ) : (
                  <QrCode className="w-16 h-16 text-muted-foreground" />
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadQR}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG
                </Button>
                <Button variant="outline" onClick={() => handleCopy(shareUrl)}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Customers can scan this QR code to visit your store instantly
              </p>
            </div>
          </TabsContent>

          {/* Share Tab */}
          <TabsContent value="share" className="space-y-4 mt-4">
            <div className="grid gap-3">
              <Button
                variant="outline"
                className="justify-start h-14"
                onClick={shareViaWhatsApp}
              >
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mr-3">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">Share via WhatsApp message</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="justify-start h-14"
                onClick={shareViaSMS}
              >
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mr-3">
                  <Smartphone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">SMS</p>
                  <p className="text-xs text-muted-foreground">Share via text message</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="justify-start h-14"
                onClick={shareViaEmail}
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mr-3">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Email</p>
                  <p className="text-xs text-muted-foreground">Share via email</p>
                </div>
              </Button>

              {navigator.share && (
                <Button
                  variant="outline"
                  className="justify-start h-14"
                  onClick={() => {
                    navigator.share({
                      title: store.store_name,
                      text: `Check out ${store.store_name}!`,
                      url: shareUrl,
                    });
                  }}
                >
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mr-3">
                    <Share2 className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">More Options</p>
                    <p className="text-xs text-muted-foreground">Use system share menu</p>
                  </div>
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
