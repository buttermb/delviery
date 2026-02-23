/**
 * MenuShare Component
 * Tools for distributing disposable menus. Features:
 * - Generate shareable link with UTM parameters
 * - QR code generation and download
 * - Embed code for websites
 * - Track link clicks and conversions per channel
 * - Bulk QR code generation for all active menus
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Share2 from 'lucide-react/dist/esm/icons/share-2';
import Link2 from 'lucide-react/dist/esm/icons/link-2';
import QrCode from 'lucide-react/dist/esm/icons/qr-code';
import Code from 'lucide-react/dist/esm/icons/code';
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Download from 'lucide-react/dist/esm/icons/download';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Eye from 'lucide-react/dist/esm/icons/eye';
import MousePointer2 from 'lucide-react/dist/esm/icons/mouse-pointer-2';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import PackageOpen from 'lucide-react/dist/esm/icons/package-open';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  access_code?: string | null;
  expiration_date?: string | null;
  created_at: string;
}

interface DistributionChannel {
  id: string;
  name: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign?: string;
}

interface LinkClickStats {
  channel: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
}

interface MenuShareProps {
  menuId?: string;
  className?: string;
}

// ============================================
// Default Distribution Channels
// ============================================

const DEFAULT_CHANNELS: DistributionChannel[] = [
  { id: 'email', name: 'Email', utmSource: 'email', utmMedium: 'email' },
  { id: 'whatsapp', name: 'WhatsApp', utmSource: 'whatsapp', utmMedium: 'social' },
  { id: 'sms', name: 'SMS', utmSource: 'sms', utmMedium: 'sms' },
  { id: 'instagram', name: 'Instagram', utmSource: 'instagram', utmMedium: 'social' },
  { id: 'facebook', name: 'Facebook', utmSource: 'facebook', utmMedium: 'social' },
  { id: 'qr_print', name: 'QR (Print)', utmSource: 'qr', utmMedium: 'print' },
  { id: 'website', name: 'Website', utmSource: 'website', utmMedium: 'referral' },
];

// ============================================
// Helper Functions
// ============================================

function buildShareableUrl(
  baseUrl: string,
  channel?: DistributionChannel,
  customUtm?: { source?: string; medium?: string; campaign?: string }
): string {
  const url = new URL(baseUrl);

  if (channel) {
    url.searchParams.set('utm_source', channel.utmSource);
    url.searchParams.set('utm_medium', channel.utmMedium);
    if (channel.utmCampaign) {
      url.searchParams.set('utm_campaign', channel.utmCampaign);
    }
  } else if (customUtm) {
    if (customUtm.source) url.searchParams.set('utm_source', customUtm.source);
    if (customUtm.medium) url.searchParams.set('utm_medium', customUtm.medium);
    if (customUtm.campaign) url.searchParams.set('utm_campaign', customUtm.campaign);
  }

  return url.toString();
}

function generateEmbedCode(url: string, width = 400, height = 600): string {
  return `<iframe
  src="${url}"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border: 1px solid #e2e8f0; border-radius: 8px;"
  title="Menu"
></iframe>`;
}

// ============================================
// QR Code Display Component
// ============================================

function QRCodeDisplay({
  url,
  menuName,
  size = 200,
}: {
  url: string;
  menuName: string;
  size?: number;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) return;

    setLoading(true);
    generateQRCodeDataURL(url, { size })
      .then(setQrDataUrl)
      .catch((error) => {
        logger.error('Failed to generate QR code', error);
      })
      .finally(() => setLoading(false));
  }, [url, size]);

  const handleDownload = async () => {
    if (!url) return;
    try {
      await downloadQRCodePNG(url, `menu-qr-${menuName.replace(/\s+/g, '-').toLowerCase()}.png`, { size: 512 });
      showSuccessToast('QR Downloaded', 'QR code saved to downloads');
    } catch (error) {
      logger.error('Failed to download QR', error instanceof Error ? error : new Error(String(error)));
      showErrorToast('Download Failed', 'Failed to download QR code');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!qrDataUrl) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ width: size, height: size }}
      >
        <span className="text-sm text-muted-foreground">Failed to load</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <img
        src={qrDataUrl}
        alt={`QR Code for ${menuName}`}
        className="border rounded-lg"
        style={{ width: size, height: size }}
      />
      <Button variant="outline" size="sm" onClick={handleDownload} className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Download PNG
      </Button>
    </div>
  );
}

// ============================================
// Channel Stats Card
// ============================================

function ChannelStatsCard({ stats }: { stats: LinkClickStats }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div>
        <div className="font-medium text-sm">{stats.channel}</div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MousePointer2 className="h-3 w-3" />
            {stats.clicks} clicks
          </span>
          <span className="flex items-center gap-1">
            <ShoppingCart className="h-3 w-3" />
            {stats.conversions} orders
          </span>
        </div>
      </div>
      <Badge variant={stats.conversionRate >= 5 ? 'default' : 'secondary'}>
        {stats.conversionRate.toFixed(1)}%
      </Badge>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function MenuShare({ menuId: propMenuId, className }: MenuShareProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const [selectedMenuId, setSelectedMenuId] = useState<string | undefined>(propMenuId);
  const [selectedChannel, setSelectedChannel] = useState<DistributionChannel | undefined>();
  const [customUtm, setCustomUtm] = useState({ source: '', medium: '', campaign: '' });
  const [embedWidth, setEmbedWidth] = useState('400');
  const [embedHeight, setEmbedHeight] = useState('600');
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedMenusForBulk, setSelectedMenusForBulk] = useState<string[]>([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const currentMenuId = propMenuId || selectedMenuId;

  // Fetch all menus for selection
  const { data: menus = [], isLoading: menusLoading } = useQuery({
    queryKey: queryKeys.menus.list(tenantId),
    queryFn: async (): Promise<Menu[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name, encrypted_url_token, status, access_code, expiration_date, created_at')
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

  // Get active menus for bulk QR generation
  const activeMenus = useMemo(() => menus.filter((m) => m.status === 'active'), [menus]);

  // Get current menu data
  const currentMenu = useMemo(
    () => menus.find((m) => m.id === currentMenuId),
    [menus, currentMenuId]
  );

  // Fetch click/conversion stats per channel
  const { data: channelStats = [], isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: [...queryKeys.menus.analytics(tenantId || '', currentMenuId || ''), 'distribution'],
    queryFn: async (): Promise<LinkClickStats[]> => {
      if (!tenantId || !currentMenuId) return [];

      // Fetch access logs with utm parameters
      const { data: logs, error: logsError } = await (supabase as any)
        .from('menu_access_logs')
        .select('id, utm_source, utm_medium, utm_campaign')
        .eq('menu_id', currentMenuId);

      if (logsError) {
        logger.warn('Failed to fetch access logs for distribution stats', { error: logsError.message });
      }

      // Fetch orders
      const { data: orders, error: ordersError } = await (supabase as any)
        .from('menu_orders')
        .select('id, utm_source')
        .eq('menu_id', currentMenuId)
        .eq('tenant_id', tenantId);

      if (ordersError) {
        logger.warn('Failed to fetch orders for distribution stats', { error: ordersError.message });
      }

      // Aggregate by channel
      const channelMap: Record<string, { clicks: number; conversions: number }> = {};

      (logs || []).forEach((log) => {
        const source = (log.utm_source as string) || 'direct';
        if (!channelMap[source]) {
          channelMap[source] = { clicks: 0, conversions: 0 };
        }
        channelMap[source].clicks++;
      });

      (orders || []).forEach((order) => {
        const source = (order.utm_source as string) || 'direct';
        if (!channelMap[source]) {
          channelMap[source] = { clicks: 0, conversions: 0 };
        }
        channelMap[source].conversions++;
      });

      return Object.entries(channelMap).map(([channel, data]) => ({
        channel: channel.charAt(0).toUpperCase() + channel.slice(1),
        clicks: data.clicks,
        conversions: data.conversions,
        conversionRate: data.clicks > 0 ? (data.conversions / data.clicks) * 100 : 0,
      }));
    },
    enabled: !!tenantId && !!currentMenuId,
    staleTime: 60 * 1000,
  });

  // Build the shareable URL
  const shareableUrl = useMemo(() => {
    if (!currentMenu?.encrypted_url_token) return '';

    const baseUrl = formatMenuUrl(currentMenu.encrypted_url_token);

    if (selectedChannel) {
      return buildShareableUrl(baseUrl, selectedChannel);
    }

    if (customUtm.source || customUtm.medium || customUtm.campaign) {
      return buildShareableUrl(baseUrl, undefined, customUtm);
    }

    return baseUrl;
  }, [currentMenu, selectedChannel, customUtm]);

  // Build embed code
  const embedCode = useMemo(() => {
    if (!shareableUrl) return '';
    return generateEmbedCode(shareableUrl, parseInt(embedWidth, 10), parseInt(embedHeight, 10));
  }, [shareableUrl, embedWidth, embedHeight]);

  // Copy to clipboard handler
  const handleCopy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    showSuccessToast(`${label} Copied`, 'Copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  }, []);

  // Bulk QR download handler
  const handleBulkDownload = useCallback(async () => {
    if (selectedMenusForBulk.length === 0) {
      showErrorToast('No Menus Selected', 'Select at least one menu to generate QR codes');
      return;
    }

    setBulkDownloading(true);
    setBulkProgress(0);

    try {
      const menusToDownload = menus.filter((m) => selectedMenusForBulk.includes(m.id));
      let completed = 0;

      for (const menu of menusToDownload) {
        const url = formatMenuUrl(menu.encrypted_url_token);
        const filename = `qr-${menu.name.replace(/\s+/g, '-').toLowerCase()}.png`;

        await downloadQRCodePNG(url, filename, { size: 512 });

        completed++;
        setBulkProgress((completed / menusToDownload.length) * 100);

        // Small delay to prevent overwhelming the browser
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      showSuccessToast('Bulk Download Complete', `Downloaded ${completed} QR codes`);
    } catch (error) {
      logger.error('Bulk QR download failed', error instanceof Error ? error : new Error(String(error)));
      showErrorToast('Download Failed', 'Some QR codes failed to download');
    } finally {
      setBulkDownloading(false);
      setBulkProgress(0);
    }
  }, [selectedMenusForBulk, menus]);

  // Toggle menu selection for bulk
  const toggleMenuForBulk = (menuId: string) => {
    setSelectedMenusForBulk((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  };

  // Select all active menus
  const selectAllActive = () => {
    setSelectedMenusForBulk(activeMenus.map((m) => m.id));
  };

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Share2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Menu Distribution</h2>
            <p className="text-sm text-muted-foreground">
              Share and track your menu distribution across channels
            </p>
          </div>
        </div>

        {/* Menu Selector (if not provided via props) */}
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
            <Share2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a menu to share</p>
            <p className="text-sm mt-2">Choose a menu from the dropdown above to generate share links and QR codes</p>
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="share" className="w-full">
          <TabsList className="flex w-full overflow-x-auto max-w-lg">
            <TabsTrigger value="share" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Links</span>
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              <span className="hidden sm:inline">QR Code</span>
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">Embed</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
          </TabsList>

          {/* Share Links Tab */}
          <TabsContent value="share" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Link Generator */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-blue-500" />
                    Share Link
                  </CardTitle>
                  <CardDescription>
                    Generate tracked links for different distribution channels
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Base URL */}
                  <div className="space-y-2">
                    <Label className="text-xs">Menu URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={shareableUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(shareableUrl, 'Link')}
                      >
                        {copied === 'Link' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(shareableUrl, '_blank', 'noopener,noreferrer')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Channel Quick Select */}
                  <div className="space-y-2">
                    <Label className="text-xs">Distribution Channel</Label>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_CHANNELS.map((channel) => (
                        <Button
                          key={channel.id}
                          size="sm"
                          variant={selectedChannel?.id === channel.id ? 'default' : 'outline'}
                          onClick={() =>
                            setSelectedChannel(
                              selectedChannel?.id === channel.id ? undefined : channel
                            )
                          }
                        >
                          {channel.name}
                        </Button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Select a channel to add UTM tracking parameters automatically
                    </p>
                  </div>

                  {/* Custom UTM Parameters */}
                  <Accordion type="single" collapsible>
                    <AccordionItem value="custom-utm">
                      <AccordionTrigger className="text-sm">
                        Custom UTM Parameters
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pt-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Source</Label>
                            <Input
                              placeholder="e.g., newsletter"
                              value={customUtm.source}
                              onChange={(e) =>
                                setCustomUtm({ ...customUtm, source: e.target.value })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Medium</Label>
                            <Input
                              placeholder="e.g., email"
                              value={customUtm.medium}
                              onChange={(e) =>
                                setCustomUtm({ ...customUtm, medium: e.target.value })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Campaign</Label>
                            <Input
                              placeholder="e.g., summer_sale"
                              value={customUtm.campaign}
                              onChange={(e) =>
                                setCustomUtm({ ...customUtm, campaign: e.target.value })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              {/* Channel Stats Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Channel Performance
                  </CardTitle>
                  <CardDescription>
                    Click and conversion stats by distribution channel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : channelStats.length > 0 ? (
                    <ScrollArea className="h-[280px] pr-4">
                      <div className="space-y-2">
                        {channelStats.map((stats) => (
                          <ChannelStatsCard key={stats.channel} stats={stats} />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MousePointer2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No tracking data yet</p>
                      <p className="text-xs mt-1">Share links to start collecting analytics</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Single QR Code */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-violet-500" />
                    QR Code
                  </CardTitle>
                  <CardDescription>
                    Scannable QR code for {currentMenu?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  {currentMenu && (
                    <QRCodeDisplay
                      url={shareableUrl}
                      menuName={currentMenu.name}
                      size={256}
                    />
                  )}
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    QR code includes any UTM parameters you have selected
                  </p>
                </CardContent>
              </Card>

              {/* Bulk QR Download */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <PackageOpen className="h-4 w-4 text-amber-500" />
                    Bulk QR Download
                  </CardTitle>
                  <CardDescription>
                    Generate QR codes for multiple menus at once
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {activeMenus.length} active menus available
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAllActive}
                      >
                        Select All Active
                      </Button>
                    </div>

                    <ScrollArea className="h-[180px] border rounded-lg p-2">
                      <div className="space-y-1">
                        {menus.map((menu) => (
                          <div
                            key={menu.id}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted',
                              selectedMenusForBulk.includes(menu.id) && 'bg-primary/10'
                            )}
                            onClick={() => toggleMenuForBulk(menu.id)}
                          >
                            <Checkbox
                              checked={selectedMenusForBulk.includes(menu.id)}
                              onCheckedChange={() => toggleMenuForBulk(menu.id)}
                            />
                            <span className="flex-1 text-sm truncate">{menu.name}</span>
                            <Badge
                              variant={menu.status === 'active' ? 'default' : 'secondary'}
                              className="text-[10px]"
                            >
                              {menu.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    {bulkDownloading && (
                      <div className="space-y-2">
                        <Progress value={bulkProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-center">
                          Downloading... {Math.round(bulkProgress)}%
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={handleBulkDownload}
                      disabled={selectedMenusForBulk.length === 0 || bulkDownloading}
                      className="w-full"
                    >
                      {bulkDownloading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Download {selectedMenusForBulk.length} QR Codes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Embed Code Tab */}
          <TabsContent value="embed" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Code className="h-4 w-4 text-emerald-500" />
                  Embed Code
                </CardTitle>
                <CardDescription>
                  Add your menu to any website with an iframe embed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Width (px)</Label>
                    <Input
                      type="number"
                      value={embedWidth}
                      onChange={(e) => setEmbedWidth(e.target.value)}
                      min="200"
                      max="1200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Height (px)</Label>
                    <Input
                      type="number"
                      value={embedHeight}
                      onChange={(e) => setEmbedHeight(e.target.value)}
                      min="300"
                      max="2000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Embed Code</Label>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(embedCode, 'Embed')}
                    >
                      {copied === 'Embed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      Copy
                    </Button>
                  </div>
                  <Textarea
                    value={embedCode}
                    readOnly
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-medium mb-2">Preview</p>
                  <div
                    className="border rounded-lg bg-white dark:bg-zinc-950 overflow-hidden"
                    style={{ width: '100%', maxWidth: parseInt(embedWidth, 10) }}
                  >
                    <div
                      className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center text-muted-foreground text-sm"
                      style={{ height: Math.min(parseInt(embedHeight, 10), 200) }}
                    >
                      <Eye className="h-6 w-6 mr-2 opacity-50" />
                      Menu preview will appear here
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-indigo-500" />
                      Distribution Analytics
                    </CardTitle>
                    <CardDescription>
                      Track clicks and conversions across all distribution channels
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchStats()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : channelStats.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Conversions</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {channelStats.map((stats) => (
                        <TableRow key={stats.channel}>
                          <TableCell className="font-medium">{stats.channel}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <MousePointer2 className="h-3 w-3 text-muted-foreground" />
                              {stats.clicks.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                              {stats.conversions.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={stats.conversionRate >= 5 ? 'default' : 'secondary'}
                            >
                              {stats.conversionRate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No analytics data yet</p>
                    <p className="text-sm mt-2">
                      Share your menu using the tracked links to start collecting data
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default MenuShare;
