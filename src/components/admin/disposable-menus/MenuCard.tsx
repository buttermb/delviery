import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Eye, Users, ShoppingCart, Flame, Copy, ExternalLink,
  Share2, Shield, MapPin, Lock, Clock, QrCode, CopyPlus,
  MoreHorizontal, MessageSquare, DollarSign, CreditCard, Store,
  ArrowUpDown, Pencil, FileText
} from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
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
import { EditMenuDialog } from './EditMenuDialog';
import { BurnMenuDialog } from './BurnMenuDialog';
import { ManageAccessDialog } from './ManageAccessDialog';
import { MenuShareDialogEnhanced } from './MenuShareDialogEnhanced';
import { MenuAnalyticsDialog } from './MenuAnalyticsDialog';
import { QRCodeDialog } from './QRCodeDialog';
import { CloneMenuDialog } from './CloneMenuDialog';
import { MenuAccessDetails } from './MenuAccessDetails';
import { MenuPaymentSettingsDialog } from './MenuPaymentSettingsDialog';
import { MenuProductOrderingDialog } from './MenuProductOrderingDialog';
import { GenerateMenuPageDialog } from './GenerateMenuPageDialog';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { showSuccessToast } from '@/utils/toastHelpers';
import { jsonToString, extractSecuritySetting, jsonToBooleanSafe } from '@/utils/menuTypeHelpers';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import type { Json } from '@/integrations/supabase/types';
import type { DisposableMenu } from '@/types/admin';

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
  // Allow any additional DB fields
  [key: string]: unknown;
}

interface MenuCardProps {
  menu: Menu;
  compact?: boolean;
}

export const MenuCard = ({ menu, compact = false }: MenuCardProps) => {
  const navigate = useTenantNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [burnDialogOpen, setBurnDialogOpen] = useState(false);
  const [manageAccessOpen, setManageAccessOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [accessDetailsOpen, setAccessDetailsOpen] = useState(false);
  const [paymentSettingsOpen, setPaymentSettingsOpen] = useState(false);
  const [productOrderingOpen, setProductOrderingOpen] = useState(false);
  const [generatePageOpen, setGeneratePageOpen] = useState(false);

  const viewCount = menu.view_count ?? 0;
  const customerCount = menu.customer_count ?? 0;
  const orderCount = menu.order_count ?? 0;
  const totalRevenue = menu.total_revenue ?? 0;
  const productCount = menu.disposable_menu_products?.length ?? 0;

  const isBurned = menu.status === 'soft_burned' || menu.status === 'hard_burned';
  const isExpired = !isBurned && !menu.never_expires && menu.expiration_date
    ? isPast(new Date(menu.expiration_date))
    : false;
  const isActive = menu.status === 'active' && !isExpired;
  const isForumMenu = extractSecuritySetting(menu.security_settings, 'menu_type') === 'forum';

  const statusConfig = {
    active: { label: 'Active', color: 'bg-success text-success-foreground' },
    expired: { label: 'Expired', color: 'bg-warning text-warning-foreground' },
    soft_burned: { label: 'Soft Burned', color: 'bg-warning text-warning-foreground' },
    hard_burned: { label: 'Burned', color: 'bg-destructive text-destructive-foreground' },
  };
  const effectiveStatus = isExpired ? 'expired' : menu.status;
  const status = statusConfig[effectiveStatus as keyof typeof statusConfig] || statusConfig.active;

  const menuUrl = `${window.location.protocol}//${window.location.host}/m/${menu.encrypted_url_token}`;

  const copyUrl = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(menuUrl);
    showSuccessToast('Copied!', 'Menu link copied to clipboard');
  };

  const openMenu = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    window.open(`/m/${menu.encrypted_url_token}`, '_blank', 'noopener,noreferrer');
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
              {securityFeatures.map((feature) => (
                <Badge key={feature.label} variant="outline" className="text-xs gap-1 py-0">
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
                    aria-label="Copy link"
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

              {/* Open in new tab */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={openMenu}
                    aria-label="Preview menu"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Preview Menu</TooltipContent>
              </Tooltip>

              {/* Spacer */}
              <div className="flex-1" />

              {/* More Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {isActive && (
                    <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Menu
                    </DropdownMenuItem>
                  )}
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
                  {isActive && (
                    <DropdownMenuItem onClick={() => setGeneratePageOpen(true)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Page
                    </DropdownMenuItem>
                  )}
                  {!isForumMenu && productCount > 0 && (
                    <DropdownMenuItem onClick={() => setProductOrderingOpen(true)}>
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      Reorder Products
                    </DropdownMenuItem>
                  )}
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
                          navigate(`/${tenantSlug}/admin/storefront/builder?${params.toString()}`);
                        }}
                        className="text-violet-600 focus-visible:text-violet-700 focus-visible:bg-violet-50"
                      >
                        <Store className="h-4 w-4 mr-2" />
                        Turn Into Storefront
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setBurnDialogOpen(true)}
                        className="text-destructive focus-visible:text-destructive"
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
              {menu.expiration_date && !menu.never_expires && isExpired && (
                <span className="text-warning">
                  Expired {format(new Date(menu.expiration_date), 'MMM d')}
                </span>
              )}
              {menu.expiration_date && !menu.never_expires && isActive && (
                <span className="text-success">
                  {formatDistanceToNow(new Date(menu.expiration_date), { addSuffix: false })} left
                </span>
              )}
              {menu.never_expires && (
                <span className="text-success">Never expires</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Dialogs */}
      {isActive && (
        <EditMenuDialog
          menuId={menu.id}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}

      <BurnMenuDialog
        menu={menu as unknown as DisposableMenu}
        open={burnDialogOpen}
        onOpenChange={setBurnDialogOpen}
      />

      <ManageAccessDialog
        menu={menu as unknown as DisposableMenu}
        open={manageAccessOpen}
        onOpenChange={setManageAccessOpen}
      />

      <MenuShareDialogEnhanced
        menu={menu as unknown as Parameters<typeof MenuShareDialogEnhanced>[0]['menu']}
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
        menu={menu as unknown as DisposableMenu}
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
        menu={menu as unknown as DisposableMenu}
      />

      {!isForumMenu && (
        <MenuProductOrderingDialog
          open={productOrderingOpen}
          onOpenChange={setProductOrderingOpen}
          menuId={menu.id}
          menuName={menu.name}
        />
      )}

      <GenerateMenuPageDialog
        open={generatePageOpen}
        onOpenChange={setGeneratePageOpen}
        preselectedMenuName={menu.name}
      />
    </>
  );
};

export default MenuCard;
