import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Share2, QrCode, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface MenuAccessDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessCode: string;
  shareableUrl: string;
  menuName: string;
}

export const MenuAccessDetails = ({
  open,
  onOpenChange,
  accessCode,
  shareableUrl,
  menuName,
}: MenuAccessDetailsProps) => {
  const [showQR, setShowQR] = useState(false);

  const copyAccessCode = () => {
    navigator.clipboard.writeText(accessCode);
    toast.success("Access code copied to clipboard");
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(shareableUrl);
    toast.success("URL copied to clipboard");
  };

  const shareViaWhatsApp = () => {
    const message = `Access your private catalog: ${menuName}\n\nURL: ${shareableUrl}\nAccess Code: ${accessCode}\n\nThis link is secure and confidential.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const shareViaSMS = () => {
    const message = `Access your private catalog: ${menuName}\n\nURL: ${shareableUrl}\nAccess Code: ${accessCode}`;
    window.open(`sms:?body=${encodeURIComponent(message)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Menu Access Details</DialogTitle>
          <DialogDescription>
            Share these details with your customers to grant access
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Access Code */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Access Code</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted p-4 rounded-lg text-center">
                <div className="text-3xl font-bold tracking-wider font-mono">
                  {accessCode}
                </div>
              </div>
              <Button size="icon" variant="outline" onClick={copyAccessCode} aria-label="Copy access code">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Shareable URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Shareable URL</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted p-3 rounded-lg text-sm break-all">
                {shareableUrl}
              </div>
              <Button size="icon" variant="outline" onClick={copyUrl} aria-label="Copy shareable URL">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* QR Code */}
          {showQR ? (
            <div className="flex justify-center p-4 bg-background rounded-lg">
              <QRCodeSVG value={shareableUrl} size={200} />
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowQR(true)}
            >
              <QrCode className="h-4 w-4 mr-2" />
              Show QR Code
            </Button>
          )}

          {/* Share Options */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quick Share</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={shareViaWhatsApp}
                className="w-full"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                onClick={shareViaSMS}
                className="w-full"
              >
                <Share2 className="h-4 w-4 mr-2" />
                SMS
              </Button>
            </div>
          </div>

          {/* Security Notice */}
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            Keep this access code secure. Anyone with this code can access the menu.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
