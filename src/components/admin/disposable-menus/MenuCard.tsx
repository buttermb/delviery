import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Eye from "lucide-react/dist/esm/icons/eye";
import Users from "lucide-react/dist/esm/icons/users";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Flame from "lucide-react/dist/esm/icons/flame";
import Copy from "lucide-react/dist/esm/icons/copy";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import Shield from "lucide-react/dist/esm/icons/shield";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Lock from "lucide-react/dist/esm/icons/lock";
import Clock from "lucide-react/dist/esm/icons/clock";
import QrCode from "lucide-react/dist/esm/icons/qr-code";
import CopyPlus from "lucide-react/dist/esm/icons/copy-plus";
import MoreHorizontal from "lucide-react/dist/esm/icons/more-horizontal";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Store from "lucide-react/dist/esm/icons/store";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Monitor from "lucide-react/dist/esm/icons/monitor";
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BurnMenuDialog } from './BurnMenuDialog';
import { ManageAccessDialog } from './ManageAccessDialog';
import { MenuShareDialogEnhanced } from './MenuShareDialogEnhanced';
import { MenuAnalyticsDialog } from './MenuAnalyticsDialog';
import { QRCodeDialog } from './QRCodeDialog';
import { CloneMenuDialog } from './CloneMenuDialog';
import { MenuAccessDetails } from './MenuAccessDetails';
import { MenuPaymentSettingsDialog } from './MenuPaymentSettingsDialog';
import { MenuPreview } from './MenuPreview';
import { format } from 'date-fns';
import { showSuccessToast } from '@/utils/toastHelpers';
import { jsonToString, extractSecuritySetting, jsonToBooleanSafe } from '@/utils/menuTypeHelpers';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import type { DisposableMenu } from '@/types/admin';
import type { Json } from '@/integrations/supabase/types';

// Extended Menu type with computed/joined fields from queries
// Simplified interface that accepts what the database actually returns
export interface Menu {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  encrypted_url_token: string;
  access_code: string | null;
  description: Json;
  is_encrypted: boolean;
  device_locking_enabled: boolean;
  security_settings: Json;
  expiration_date: string | null;
  never_expires: boolean;
  created_at: string;
  // Extended properties from joins/computed fields
  view_count?: number;
  customer_count?: number;
  order_count?: number;
  total_revenue?: number;
  disposable_menu_products?: Array<unknown>;
  max_views_per_period?: number;
  // Schedule fields
  is_scheduled?: boolean;
  scheduled_activation_time?: string | null;
  scheduled_deactivation_time?: string | null;
  schedule_timezone?: string | null;
  recurrence_pattern?: string | null;
  // Allow any additional DB fields
  [key: string]: unknown;
}

interface MenuCardProps {
  menu: Menu;
  compact?: boolean;
}

export const MenuCard = ({ menu, compact = false }: MenuCardProps) => {
  const [burnDialogOpen, setBurnDialogOpen] = useState(false);
  const [manageAccessOpen, setManageAccessOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [accessDetailsOpen, setAccessDetailsOpen] = useState(false);
  const [paymentSettingsOpen, setPaymentSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const viewCount = menu.view_count || 0;
  const customerCount = menu.customer_count || 0;
  const orderCount = menu.order_count || 0;
  const totalRevenue = menu.total_revenue || 0;
  const productCount = menu.disposable_menu_products?.length || 0;

  const isActive = menu.status === 'active';
  const isBurned = menu.status === 'soft_burned' || menu.status === 'hard_burned';
  const isForumMenu = extractSecuritySetting(menu.security_settings, 'menu_type') === 'forum';
  const isScheduled = menu.is_scheduled && menu.scheduled_activation_time;
  const scheduledTime = isScheduled ? new Date(menu.scheduled_activation_time as string) : null;
  const isUpcoming = scheduledTime && scheduledTime > new Date();

  const statusConfig = {
    active: { label: 'Active', color: 'bg-success text-success-foreground' },
    soft_burned: { label: 'Soft Burned', color: 'bg-warning text-warning-foreground' },
    hard_burned: { label: 'Burned', color: 'bg-destructive text-destructive-foreground' },
  };
  const status = statusConfig[menu.status as keyof typeof statusConfig] || statusConfig.active;

  const menuUrl = `${window.location.protocol}//${window.location.host}/m/${menu.encrypted_url_token}`;

  const copyUrl = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(menuUrl);
    showSuccessToast('Copied!', 'Menu link copied to clipboard');
  };

  const openMenu = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    window.open(`/m/${menu.encrypted_url_token}`, '_blank');
  };

  // Security badges
  const securityFeatures = [];
  if (menu.is_encrypted) securityFeatures.push({ icon: Lock, label: 'Encrypted' });
  if (jsonToBooleanSafe(extractSecuritySetting(menu.security_settings, 'require_geofence'))) {
    securityFeatures.push({ icon: MapPin, label: 'Geofenced' });
  }
  if (menu.device_locking_enabled) securityFeatures.push({ icon: Shield, label: 'Device Lock' });
  if (menu.max_views_per_period) {
    securityFeatures.push({ icon: Clock, label: `${menu.max_views_per_period} views` });
  }

  return (
    <>
      <Card className={cn(
        "group relative overflow-hidden transition-all duration-200",
        isActive && "hover:shadow-lg hover:border-violet-500/50",
        isBurned && "opacity-75"
      )}>
        {/* Status Banner */}
        <div className={cn(
          "absolute top-0 left-0 right-0 h-1",
          isActive ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-muted"
        )} />

        <div className="p-4 pt-5 space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate">{menu.name}</h3>
                {isForumMenu && (
                  <Badge variant="secondary" className="text-xs bg-success/10 text-success shrink-0">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Forum
                  </Badge>
                )}
                {isScheduled && isUpcoming && (
                  <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 shrink-0">
                    <Calendar className="h-3 w-3 mr-1" />
                    Scheduled
                  </Badge>
                )}
              </div>
              {!compact && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {jsonToString(menu.description) || `${productCount} products`}
                </p>
              )}
            </div>
            <Badge className={cn("shrink-0 text-xs", status.color)}>
              {status.label}
            </Badge>
          </div>

          {/* Quick Stats Row */}
          <div className="flex items-center gap-4 text-sm">
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">{viewCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Total Views</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">{customerCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Customers</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">{orderCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Orders</TooltipContent>
              </Tooltip>

              {totalRevenue > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-success ml-auto">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span className="font-semibold">{formatCurrency(totalRevenue)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Total Revenue</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>

          {/* Security Features */}
          {securityFeatures.length > 0 && !compact && (
            <div className="flex flex-wrap gap-1.5">
              {securityFeatures.map((feature, i) => (
                <Badge key={i} variant="outline" className="text-xs gap-1 py-0">
                  <feature.icon className="h-3 w-3" />
                  {feature.label}
                </Badge>
              ))}
            </div>
          )}

          {/* Quick Actions Row */}
          <div className="flex items-center gap-1.5 pt-2 border-t">
            <TooltipProvider delayDuration={0}>
              {/* Copy Link - Always visible */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={copyUrl}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy Link</TooltipContent>
              </Tooltip>

              {/* QR Code */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setQrCodeOpen(true)}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>QR Code</TooltipContent>
              </Tooltip>

              {/* Share */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setShareDialogOpen(true)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share</TooltipContent>
              </Tooltip>

              {/* Customer Preview */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Customer Preview</TooltipContent>
              </Tooltip>

              {/* Open in new tab */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={openMenu}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open in Browser</TooltipContent>
              </Tooltip>

              {/* Spacer */}
              <div className="flex-1" />

              {/* More Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                    <Monitor className="h-4 w-4 mr-2" />
                    Customer Preview
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setAccessDetailsOpen(true)}>
                    <Lock className="h-4 w-4 mr-2" />
                    Access Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAnalyticsOpen(true)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Analytics
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setManageAccessOpen(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Access
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPaymentSettingsOpen(true)}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Payment Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCloneDialogOpen(true)}>
                    <CopyPlus className="h-4 w-4 mr-2" />
                    Duplicate Menu
                  </DropdownMenuItem>
                  {isActive && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          // Navigate to StorefrontBuilder with menu pre-loaded
                          const params = new URLSearchParams({
                            from_menu: menu.id,
                            menu_name: menu.name || 'My Storefront',
                          });
                          window.location.href = `/admin/storefront/builder?${params.toString()}`;
                        }}
                        className="text-violet-600 focus:text-violet-700 focus:bg-violet-50"
                      >
                        <Store className="h-4 w-4 mr-2" />
                        Turn Into Storefront
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setBurnDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Flame className="h-4 w-4 mr-2" />
                        Burn Menu
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipProvider>
          </div>

          {/* Expiration/Created Info */}
          {!compact && (
            <div className="text-xs text-muted-foreground flex items-center justify-between">
              <span>Created {format(new Date(menu.created_at), 'MMM d, yyyy')}</span>
              {isScheduled && isUpcoming && scheduledTime && (
                <span className="text-blue-600 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Activates {format(scheduledTime, 'MMM d, h:mm a')}
                </span>
              )}
              {!isScheduled && menu.expiration_date && !menu.never_expires && (
                <span className="text-warning">
                  Expires {format(new Date(menu.expiration_date), 'MMM d')}
                </span>
              )}
              {!isScheduled && menu.never_expires && !isUpcoming && (
                <span className="text-success">Never expires</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Dialogs */}
      <BurnMenuDialog
        menu={menu as any}
        open={burnDialogOpen}
        onOpenChange={setBurnDialogOpen}
      />

      <ManageAccessDialog
        menu={menu as any}
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
        menu={menu as any}
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
        menu={menu as any}
        onComplete={() => window.location.reload()}
      />

      <MenuAccessDetails
        open={accessDetailsOpen}
        onOpenChange={setAccessDetailsOpen}
        accessCode={menu.access_code || 'N/A'}
        shareableUrl={menuUrl}
        menuName={menu.name || 'Menu'}
      />

      <MenuPaymentSettingsDialog
        open={paymentSettingsOpen}
        onOpenChange={setPaymentSettingsOpen}
        menu={menu as any}
      />

      <MenuPreview
        menu={menu as any}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
};

export default MenuCard;
