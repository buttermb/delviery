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
import { Copy, ExternalLink, MessageCircle, Mail, QrCode } from 'lucide-react';
import { showSuccessToast } from '@/utils/toastHelpers';
import { formatMenuUrl, generateWhatsAppMessage } from '@/utils/menuHelpers';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface MenuShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu: any;
  whitelistEntry?: any;
}

export const MenuShareDialog = ({
  open,
  onOpenChange,
  menu,
  whitelistEntry
}: MenuShareDialogProps) => {
  const [copied, setCopied] = useState(false);
  
  const menuUrl = formatMenuUrl(
    menu.encrypted_url_token,
    whitelistEntry?.unique_access_token
  );
  
  const accessCode = menu.access_code || 'N/A';

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showSuccessToast(`${label} Copied`, 'Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const message = generateWhatsAppMessage(
      whitelistEntry?.customer_name || 'Customer',
      menuUrl,
      accessCode
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Access to ${menu.name}`);
    const body = encodeURIComponent(
      `Hi ${whitelistEntry?.customer_name || 'there'},\n\n` +
      `You've been granted access to our wholesale catalog.\n\n` +
      `Access URL: ${menuUrl}\n` +
      `Access Code: ${accessCode}\n\n` +
      `Important: This link is confidential and expires ${menu.expiration_date ? `on ${new Date(menu.expiration_date).toLocaleDateString()}` : 'after use'}.\n\n` +
      `Best regards`
    );
    window.open(`mailto:${whitelistEntry?.customer_email}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Menu Access</DialogTitle>
          <DialogDescription>
            Share this encrypted menu with {whitelistEntry?.customer_name || 'customer'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Menu URL */}
          <div className="space-y-2">
            <Label>Access URL</Label>
            <div className="flex gap-2">
              <Input
                value={menuUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(menuUrl, 'URL')}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(menuUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Access Code */}
          <div className="space-y-2">
            <Label>Access Code</Label>
            <div className="flex gap-2">
              <Input
                value={accessCode}
                readOnly
                className="font-mono text-2xl text-center tracking-widest font-bold"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(accessCode, 'Code')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Security Info */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant={menu.status === 'active' ? 'default' : 'destructive'}>
                {menu.status}
              </Badge>
            </div>
            {menu.expiration_date && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expires:</span>
                <span className="font-medium">
                  {new Date(menu.expiration_date).toLocaleDateString()}
                </span>
              </div>
            )}
            {menu.security_settings?.max_views && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">View Limit:</span>
                <span className="font-medium">
                  {menu.security_settings.max_views} views
                </span>
              </div>
            )}
          </div>

          {/* Share Actions */}
          <div className="space-y-2">
            <Label>Quick Share</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleWhatsApp}
                className="w-full"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={handleEmail}
                className="w-full"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
          </div>

          {/* Security Warning */}
          <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
            <div className="text-sm font-semibold text-destructive mb-1">
              ⚠️ Security Notice
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Only share with authorized customers</li>
              <li>• Links may self-destruct after use</li>
              <li>• Access is logged and monitored</li>
              <li>• Never post publicly or screenshot</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
