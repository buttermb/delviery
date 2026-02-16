/**
 * MenuDeepLinks Component
 * Generate deep links to specific products on a menu.
 * Features:
 * - Deep link URL generation with menu ID and product ID
 * - Product highlighting/scroll-to on menu open
 * - QR code generation per product-menu combination
 * - Deep link click tracking
 * - Bulk deep link generation for all products on a menu
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link2 from 'lucide-react/dist/esm/icons/link-2';
import QrCode from 'lucide-react/dist/esm/icons/qr-code';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Download from 'lucide-react/dist/esm/icons/download';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import MousePointer2 from 'lucide-react/dist/esm/icons/mouse-pointer-2';
import Search from 'lucide-react/dist/esm/icons/search';
import Package from 'lucide-react/dist/esm/icons/package';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Share2 from 'lucide-react/dist/esm/icons/share-2';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { formatMenuUrl } from '@/utils/menuHelpers';
import { generateQRCodeDataURL, downloadQRCodePNG } from '@/lib/utils/qrCode';

// ============================================
// Types
// ============================================

interface Menu {
  id: string;
  name: string;
  encrypted_url_token: string;
  status: string;
}

interface MenuProduct {
  id: string;
  product_id: string;
  display_order: number;
  product: {
    id: string;
    product_name: string;
    image_url: string | null;
    category: string | null;
  } | null;
}

interface DeepLinkClickStats {
  product_id: string;
  product_name: string;
  clicks: number;
  last_clicked: string | null;
}

interface MenuDeepLinksProps {
  menuId?: string;
  className?: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a deep link URL for a specific product on a menu
 */
function generateProductDeepLink(menuToken: string, productId: string): string {
  const baseUrl = formatMenuUrl(menuToken);
  const url = new URL(baseUrl);
  url.searchParams.set('product', productId);
  url.searchParams.set('highlight', 'true');
  return url.toString();
}

// ============================================
// QR Code Preview Dialog
// ============================================

interface QRPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
  productName: string;
  menuName: string;
}

function QRPreviewDialog({ open, onClose, url, productName, menuName }: QRPreviewDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !url) return;

    setLoading(true);
    generateQRCodeDataURL(url, { size: 300 })
      .then(setQrDataUrl)
      .catch((error) => {
        logger.error('Failed to generate QR code', error);
      })
      .finally(() => setLoading(false));
  }, [open, url]);

  const handleDownload = async () => {
    if (!url) return;
    try {
      const filename = `qr-${menuName}-${productName}`.replace(/\s+/g, '-').toLowerCase() + '.png';
      await downloadQRCodePNG(url, filename, { size: 512 });
      showSuccessToast('QR Downloaded', 'QR code saved to downloads');
    } catch (error) {
      logger.error('Failed to download QR', error instanceof Error ? error : new Error(String(error)));
      showErrorToast('Download Failed', 'Failed to download QR code');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    showSuccessToast('Link Copied', 'Deep link copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Product Deep Link QR Code</DialogTitle>
          <DialogDescription>
            Scan this QR code to open the menu and jump directly to {productName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-[300px] w-[300px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${productName}`}
              className="border rounded-lg"
              style={{ width: 300, height: 300 }}
            />
          ) : (
            <div className="flex items-center justify-center h-[300px] w-[300px] bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Failed to load QR code</span>
            </div>
          )}

          <div className="w-full space-y-2">
            <Label className="text-xs">Deep Link URL</Label>
            <div className="flex gap-2">
              <Input value={url} readOnly className="text-xs font-mono" />
              <Button size="icon" variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download QR
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Main Component
// ============================================

export function MenuDeepLinks({ menuId: propMenuId, className }: MenuDeepLinksProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [selectedMenuId, setSelectedMenuId] = useState<string | undefined>(propMenuId);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
    url: string;
  } | null>(null);

  const currentMenuId = propMenuId || selectedMenuId;

  // Fetch all menus for selection
  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: queryKeys.menus.list(tenantId),
    queryFn: async (): Promise<Menu[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name, encrypted_url_token, status')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch menus', error);
        throw error;
      }

      return (data || []) as Menu[];
    },
    enabled: !!tenantId,
  });

  // Get current menu
  const currentMenu = useMemo(
    () => menus.find((m) => m.id === currentMenuId),
    [menus, currentMenuId]
  );

  // Fetch products on the current menu
  const { data: menuProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: [...queryKeys.menus.products(tenantId || '', currentMenuId || ''), 'deep-links'],
    queryFn: async (): Promise<MenuProduct[]> => {
      if (!tenantId || !currentMenuId) return [];

      const { data, error } = await supabase
        .from('disposable_menu_products')
        .select(`
          id,
          product_id,
          display_order,
          wholesale_inventory!product_id (
            id,
            product_name,
            image_url,
            category
          )
        `)
        .eq('menu_id', currentMenuId)
        .order('display_order', { ascending: true });

      if (error) {
        logger.error('Failed to fetch menu products', error);
        throw error;
      }

      return (data || []).map((item) => ({
        id: item.id,
        product_id: item.product_id,
        display_order: item.display_order ?? 0,
        product: item.wholesale_inventory ? {
          id: (item.wholesale_inventory as { id: string }).id,
          product_name: (item.wholesale_inventory as { product_name: string }).product_name,
          image_url: (item.wholesale_inventory as { image_url: string | null }).image_url,
          category: (item.wholesale_inventory as { category: string | null }).category,
        } : null,
      }));
    },
    enabled: !!tenantId && !!currentMenuId,
  });

  // Fetch deep link click stats
  const { data: clickStats = [], isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: [...queryKeys.menus.analytics(tenantId || '', currentMenuId || ''), 'deep-link-clicks'],
    queryFn: async (): Promise<DeepLinkClickStats[]> => {
      if (!tenantId || !currentMenuId) return [];

      // Query menu_access_logs for deep link clicks (where product param is present)
      const { data: logs, error } = await (supabase as any)
        .from('menu_access_logs')
        .select('id, product_id, created_at')
        .eq('menu_id', currentMenuId)
        .not('product_id', 'is', null);

      if (error) {
        logger.warn('Failed to fetch deep link click stats', { error: error.message });
        return [];
      }

      // Aggregate clicks by product
      const productClickMap: Record<string, { clicks: number; lastClicked: string | null }> = {};

      (logs || []).forEach((log) => {
        const productId = log.product_id as string;
        if (!productClickMap[productId]) {
          productClickMap[productId] = { clicks: 0, lastClicked: null };
        }
        productClickMap[productId].clicks++;
        const logDate = log.created_at as string;
        if (!productClickMap[productId].lastClicked || logDate > productClickMap[productId].lastClicked!) {
          productClickMap[productId].lastClicked = logDate;
        }
      });

      // Map to product names
      return menuProducts
        .filter((mp) => mp.product)
        .map((mp) => ({
          product_id: mp.product_id,
          product_name: mp.product?.product_name || 'Unknown',
          clicks: productClickMap[mp.product_id]?.clicks || 0,
          last_clicked: productClickMap[mp.product_id]?.lastClicked || null,
        }))
        .sort((a, b) => b.clicks - a.clicks);
    },
    enabled: !!tenantId && !!currentMenuId && menuProducts.length > 0,
    staleTime: 60 * 1000,
  });

  // Track deep link click mutation
  const trackClickMutation = useMutation({
    mutationFn: async ({ menuId, productId }: { menuId: string; productId: string }) => {
      if (!tenantId) throw new Error('No tenant');

      const { error } = await supabase
        .from('menu_access_logs')
        .insert({
          menu_id: menuId,
          product_id: productId,
          tenant_id: tenantId,
          access_type: 'deep_link_preview',
          ip_address: null,
          user_agent: navigator.userAgent,
        });

      if (error) {
        logger.warn('Failed to track deep link click', { error: error.message });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.menus.analytics(tenantId || '', currentMenuId || ''),
      });
    },
  });

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return menuProducts;
    const query = searchQuery.toLowerCase();
    return menuProducts.filter(
      (mp) =>
        mp.product?.product_name.toLowerCase().includes(query) ||
        mp.product?.category?.toLowerCase().includes(query)
    );
  }, [menuProducts, searchQuery]);

  // Copy deep link to clipboard
  const handleCopyLink = useCallback((productId: string, productName: string) => {
    if (!currentMenu) return;

    const deepLink = generateProductDeepLink(currentMenu.encrypted_url_token, productId);
    navigator.clipboard.writeText(deepLink);
    setCopied(productId);
    showSuccessToast('Link Copied', `Deep link for ${productName} copied to clipboard`);
    setTimeout(() => setCopied(null), 2000);
  }, [currentMenu]);

  // Open deep link in new tab (with tracking)
  const handleOpenLink = useCallback((productId: string) => {
    if (!currentMenu || !currentMenuId) return;

    const deepLink = generateProductDeepLink(currentMenu.encrypted_url_token, productId);
    trackClickMutation.mutate({ menuId: currentMenuId, productId });
    window.open(deepLink, '_blank');
  }, [currentMenu, currentMenuId, trackClickMutation]);

  // Open QR dialog
  const handleShowQR = useCallback((productId: string, productName: string) => {
    if (!currentMenu) return;

    const deepLink = generateProductDeepLink(currentMenu.encrypted_url_token, productId);
    setSelectedProduct({ id: productId, name: productName, url: deepLink });
    setQrDialogOpen(true);
  }, [currentMenu]);

  // Bulk download all QR codes
  const handleBulkDownloadQR = useCallback(async () => {
    if (!currentMenu || filteredProducts.length === 0) return;

    const toastId = showSuccessToast('Downloading...', `Generating ${filteredProducts.length} QR codes`);

    try {
      for (const mp of filteredProducts) {
        if (!mp.product) continue;

        const deepLink = generateProductDeepLink(currentMenu.encrypted_url_token, mp.product_id);
        const filename = `qr-${currentMenu.name}-${mp.product.product_name}`.replace(/\s+/g, '-').toLowerCase() + '.png';

        await downloadQRCodePNG(deepLink, filename, { size: 512 });

        // Small delay to prevent overwhelming the browser
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      showSuccessToast('Download Complete', `Downloaded ${filteredProducts.length} QR codes`);
    } catch (error) {
      logger.error('Bulk QR download failed', error instanceof Error ? error : new Error(String(error)));
      showErrorToast('Download Failed', 'Some QR codes failed to download');
    }
  }, [currentMenu, filteredProducts]);

  // Loading state
  if (menusLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Product Deep Links</h2>
            <p className="text-sm text-muted-foreground">
              Generate shareable links to specific products on your menus
            </p>
          </div>
        </div>

        {/* Menu Selector */}
        {!propMenuId && (
          <Select value={selectedMenuId} onValueChange={setSelectedMenuId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a menu" />
            </SelectTrigger>
            <SelectContent>
              {menus.map((menu) => (
                <SelectItem key={menu.id} value={menu.id}>
                  <div className="flex items-center gap-2">
                    <span>{menu.name}</span>
                    <Badge variant={menu.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                      {menu.status}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!currentMenuId ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <Link2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a menu</p>
            <p className="text-sm mt-2">Choose a menu to generate product deep links</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Links */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-500" />
                      Product Links
                    </CardTitle>
                    <CardDescription>
                      {menuProducts.length} products on {currentMenu?.name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-48"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDownloadQR}
                      disabled={filteredProducts.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      All QR
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-2">
                      {filteredProducts.map((mp) => {
                        if (!mp.product) return null;
                        const productStats = clickStats.find((s) => s.product_id === mp.product_id);

                        return (
                          <div
                            key={mp.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {mp.product.image_url ? (
                                <img
                                  src={mp.product.image_url}
                                  alt={mp.product.product_name}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{mp.product.product_name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {mp.product.category && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {mp.product.category}
                                    </Badge>
                                  )}
                                  {productStats && productStats.clicks > 0 && (
                                    <span className="flex items-center gap-1">
                                      <MousePointer2 className="h-3 w-3" />
                                      {productStats.clicks} clicks
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleCopyLink(mp.product_id, mp.product!.product_name)}
                                title="Copy deep link"
                              >
                                {copied === mp.product_id ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleShowQR(mp.product_id, mp.product!.product_name)}
                                title="Show QR code"
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleOpenLink(mp.product_id)}
                                title="Open deep link"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No products found</p>
                    <p className="text-sm mt-2">
                      {searchQuery
                        ? 'Try a different search term'
                        : 'Add products to this menu to generate deep links'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Click Stats */}
          <div>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-indigo-500" />
                      Deep Link Analytics
                    </CardTitle>
                    <CardDescription>
                      Track which products get the most deep link clicks
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => refetchStats()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : clickStats.length > 0 ? (
                  <ScrollArea className="h-[320px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clickStats.slice(0, 10).map((stat) => (
                          <TableRow key={stat.product_id}>
                            <TableCell className="font-medium text-sm truncate max-w-[150px]">
                              {stat.product_name}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={stat.clicks > 10 ? 'default' : 'secondary'}>
                                {stat.clicks}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <MousePointer2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No clicks tracked yet</p>
                    <p className="text-xs mt-1">Share deep links to start tracking</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* How Deep Links Work */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-emerald-500" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong className="text-foreground">1.</strong> Copy or scan the deep link for a product
                </p>
                <p>
                  <strong className="text-foreground">2.</strong> When opened, the menu scrolls to and highlights the product
                </p>
                <p>
                  <strong className="text-foreground">3.</strong> Perfect for promotions and targeted marketing
                </p>
                <p>
                  <strong className="text-foreground">4.</strong> Track which products get the most engagement
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* QR Preview Dialog */}
      {selectedProduct && currentMenu && (
        <QRPreviewDialog
          open={qrDialogOpen}
          onClose={() => {
            setQrDialogOpen(false);
            setSelectedProduct(null);
          }}
          url={selectedProduct.url}
          productName={selectedProduct.name}
          menuName={currentMenu.name}
        />
      )}
    </div>
  );
}

export default MenuDeepLinks;
