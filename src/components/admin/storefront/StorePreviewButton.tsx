/**
 * Store Preview Button
 * Opens storefront in preview mode with admin banner
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Eye from "lucide-react/dist/esm/icons/eye";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import Monitor from "lucide-react/dist/esm/icons/monitor";
import Tablet from "lucide-react/dist/esm/icons/tablet";
import Copy from "lucide-react/dist/esm/icons/copy";
import Check from "lucide-react/dist/esm/icons/check";
import { useToast } from '@/hooks/use-toast';

interface StorePreviewButtonProps {
  storeSlug: string;
  storeName: string;
}

export function StorePreviewButton({ storeSlug, storeName }: StorePreviewButtonProps) {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [viewportSize, setViewportSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [copied, setCopied] = useState(false);

  const storeUrl = `${window.location.origin}/shop/${storeSlug}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    toast({ title: 'Store link copied!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenNewTab = () => {
    window.open(`${storeUrl}?preview=true`, '_blank');
  };

  const viewportWidths = {
    mobile: 375,
    tablet: 768,
    desktop: 1280,
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Eye className="w-4 h-4" />
            Preview Store
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowPreview(true)}>
            <Monitor className="w-4 h-4 mr-2" />
            Preview in Modal
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleOpenNewTab}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink}>
            {copied ? (
              <Check className="w-4 h-4 mr-2 text-green-500" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            Copy Store Link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{storeName}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                    {storeUrl}
                  </span>
                  <Badge variant="secondary">Preview Mode</Badge>
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* Viewport Switcher */}
                <div className="flex items-center border rounded-lg p-1">
                  <Button
                    variant={viewportSize === 'mobile' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewportSize('mobile')}
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewportSize === 'tablet' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewportSize('tablet')}
                  >
                    <Tablet className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewportSize === 'desktop' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setViewportSize('desktop')}
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenNewTab}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div
            className="flex justify-center items-start bg-muted/50 overflow-auto"
            style={{ height: 'calc(95vh - 80px)' }}
          >
            <div
              className="bg-white shadow-2xl transition-all duration-300"
              style={{
                width: viewportWidths[viewportSize],
                height: '100%',
                maxWidth: '100%',
              }}
            >
              {/* Admin Preview Banner */}
              <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm text-center font-medium">
                ⚠️ Admin Preview Mode - Customer actions are disabled
              </div>
              <iframe
                src={`${storeUrl}?preview=true`}
                className="w-full border-0"
                style={{ height: 'calc(100% - 40px)' }}
                title="Store Preview"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default StorePreviewButton;

