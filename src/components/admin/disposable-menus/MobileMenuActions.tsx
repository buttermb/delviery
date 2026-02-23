/**
 * Mobile-optimized menu actions using bottom sheet
 * Touch-friendly with larger tap targets
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetTrigger 
} from '@/components/ui/sheet';
import { 
  Copy, ExternalLink, Share2, QrCode, Users, 
  BarChart3, CopyPlus, Flame, Lock, MoreHorizontal 
} from 'lucide-react';
import { showSuccessToast } from '@/utils/toastHelpers';
import type { DisposableMenu } from '@/types/admin';
import { BurnMenuDialog } from './BurnMenuDialog';
import { ManageAccessDialog } from './ManageAccessDialog';
import { MenuShareDialogEnhanced } from './MenuShareDialogEnhanced';
import { MenuAnalyticsDialog } from './MenuAnalyticsDialog';
import { QRCodeDialog } from './QRCodeDialog';
import { CloneMenuDialog } from './CloneMenuDialog';
import { MenuAccessDetails } from './MenuAccessDetails';

interface MobileMenuActionsProps {
  menu: DisposableMenu;
  trigger?: React.ReactNode;
}

export function MobileMenuActions({ menu, trigger }: MobileMenuActionsProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [burnDialogOpen, setBurnDialogOpen] = useState(false);
  const [manageAccessOpen, setManageAccessOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [accessDetailsOpen, setAccessDetailsOpen] = useState(false);

  const menuUrl = `${window.location.protocol}//${window.location.host}/m/${menu.encrypted_url_token}`;
  const isActive = menu.status === 'active';

  const copyUrl = () => {
    navigator.clipboard.writeText(menuUrl);
    showSuccessToast('Copied!', 'Menu link copied to clipboard');
    setSheetOpen(false);
  };

  const openMenu = () => {
    window.open(`/m/${menu.encrypted_url_token}`, '_blank', 'noopener,noreferrer');
    setSheetOpen(false);
  };

  const handleAction = (action: () => void) => {
    setSheetOpen(false);
    // Small delay to let sheet close animation complete
    setTimeout(action, 150);
  };

  const actions = [
    {
      icon: Copy,
      label: 'Copy Link',
      description: 'Copy menu URL to clipboard',
      onClick: copyUrl,
      show: true,
    },
    {
      icon: QrCode,
      label: 'QR Code',
      description: 'Generate scannable QR code',
      onClick: () => handleAction(() => setQrCodeOpen(true)),
      show: true,
    },
    {
      icon: Share2,
      label: 'Share Menu',
      description: 'Send via WhatsApp, SMS, or email',
      onClick: () => handleAction(() => setShareDialogOpen(true)),
      show: true,
    },
    {
      icon: ExternalLink,
      label: 'Preview Menu',
      description: 'Open menu in new tab',
      onClick: openMenu,
      show: true,
    },
    {
      icon: Lock,
      label: 'Access Details',
      description: 'View access code and settings',
      onClick: () => handleAction(() => setAccessDetailsOpen(true)),
      show: true,
    },
    {
      icon: BarChart3,
      label: 'Analytics',
      description: 'View menu performance stats',
      onClick: () => handleAction(() => setAnalyticsOpen(true)),
      show: true,
    },
    {
      icon: Users,
      label: 'Manage Access',
      description: 'Control who can view this menu',
      onClick: () => handleAction(() => setManageAccessOpen(true)),
      show: true,
    },
    {
      icon: CopyPlus,
      label: 'Duplicate Menu',
      description: 'Create a copy of this menu',
      onClick: () => handleAction(() => setCloneDialogOpen(true)),
      show: true,
    },
    {
      icon: Flame,
      label: 'Burn Menu',
      description: 'Permanently disable access',
      onClick: () => handleAction(() => setBurnDialogOpen(true)),
      show: isActive,
      destructive: true,
    },
  ];

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          {trigger || (
            <Button variant="ghost" size="sm" className="h-11 w-11 p-0" aria-label="Menu actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        </SheetTrigger>
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          <SheetHeader className="text-left pb-4">
            <SheetTitle className="truncate">{menu.name}</SheetTitle>
          </SheetHeader>
          
          <div className="grid grid-cols-1 gap-1 pb-6">
            {actions.filter(a => a.show).map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className={`
                  flex items-center gap-4 p-4 rounded-lg text-left w-full
                  transition-colors active:scale-[0.98]
                  ${action.destructive 
                    ? 'text-destructive hover:bg-destructive/10' 
                    : 'hover:bg-muted'
                  }
                `}
              >
                <div className={`
                  p-2 rounded-full 
                  ${action.destructive ? 'bg-destructive/10' : 'bg-muted'}
                `}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{action.label}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {action.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <BurnMenuDialog 
        menu={menu}
        open={burnDialogOpen}
        onOpenChange={setBurnDialogOpen}
      />
      
      <ManageAccessDialog
        menu={menu}
        open={manageAccessOpen}
        onOpenChange={setManageAccessOpen}
      />

      <MenuShareDialogEnhanced
        menu={menu as any}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        whitelistEntry={undefined}
      />

      <MenuAnalyticsDialog
        menu={menu}
        open={analyticsOpen}
        onOpenChange={setAnalyticsOpen}
      />

      <QRCodeDialog
        open={qrCodeOpen}
        onClose={() => setQrCodeOpen(false)}
        menuTitle={menu.name}
        accessUrl={menuUrl}
        menuId={menu.id}
      />

      <CloneMenuDialog
        open={cloneDialogOpen}
        onClose={() => setCloneDialogOpen(false)}
        menu={menu}
        onComplete={() => window.location.reload()}
      />

      <MenuAccessDetails
        open={accessDetailsOpen}
        onOpenChange={setAccessDetailsOpen}
        accessCode={menu.access_code || 'N/A'}
        shareableUrl={menuUrl}
        menuName={menu.name}
      />
    </>
  );
}

export default MobileMenuActions;

