/**
 * Storefront Session Link Component
 *
 * Shows detailed customer journey information when an order originated
 * from a storefront or disposable menu session. Displays:
 * - Browsing time and page views
 * - Products viewed before ordering
 * - Cart history (adds/removes)
 * - Source menu details
 * - Referrer and UTM tracking info
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import Clock from 'lucide-react/dist/esm/icons/clock';
import Eye from 'lucide-react/dist/esm/icons/eye';
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart';
import MousePointer from 'lucide-react/dist/esm/icons/mouse-pointer';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import Link2 from 'lucide-react/dist/esm/icons/link-2';
import Utensils from 'lucide-react/dist/esm/icons/utensils';
import Store from 'lucide-react/dist/esm/icons/store';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatSmartDate } from '@/lib/utils/formatDate';

interface ViewedProduct {
  product_id: string;
  name: string;
  viewed_at: string;
  duration_seconds?: number;
}

interface CartAction {
  action: 'add' | 'remove';
  product_id: string;
  product_name: string;
  quantity: number;
  timestamp: string;
}

interface MenuInfo {
  id: string;
  name: string;
  created_at: string;
  expires_at: string | null;
  status: string;
}

interface SessionDetails {
  id: string;
  session_token: string;
  source_type: 'storefront' | 'menu' | 'api';
  started_at: string;
  ended_at: string | null;
  browsing_duration_seconds: number;
  page_views: number;
  items_viewed: number;
  items_added_to_cart: number;
  viewed_products: ViewedProduct[];
  cart_history: CartAction[];
  converted_at: string | null;
  order_id: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  menu?: MenuInfo;
}

interface StorefrontSessionLinkProps {
  /** The session ID to display details for */
  sessionId: string | null | undefined;
  /** Optional menu ID if order came from a specific menu */
  menuId?: string | null;
  /** Compact mode shows less details */
  compact?: boolean;
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Hook to fetch session details from the database
 */
function useSessionDetails(sessionId: string | null | undefined, tenantId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.orders.lists(), 'session', sessionId],
    queryFn: async (): Promise<SessionDetails | null> => {
      if (!sessionId || !tenantId) return null;

      // Try the RPC function first
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_storefront_session_details',
        {
          p_session_id: sessionId,
          p_tenant_id: tenantId,
        }
      );

      if (rpcError) {
        logger.warn('get_storefront_session_details RPC failed, falling back to direct query', {
          component: 'StorefrontSessionLink',
          sessionId,
          error: rpcError,
        });
      }

      if (!rpcError && rpcData) {
        return rpcData as unknown as SessionDetails;
      }

      // Fallback to direct query
      const { data, error } = await supabase
        .from('storefront_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.debug('Could not fetch session details', {
          sessionId,
          error: error.message,
          component: 'StorefrontSessionLink',
        });
        return null;
      }

      if (!data) return null;

      // Fetch menu info if available
      let menuInfo: MenuInfo | undefined;
      if (data.menu_id) {
        const { data: menu } = await supabase
          .from('disposable_menus')
          .select('id, name, created_at, expires_at, status')
          .eq('id', data.menu_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (menu) {
          menuInfo = menu as MenuInfo;
        }
      }

      return {
        id: data.id,
        session_token: data.session_token,
        source_type: data.source_type || 'storefront',
        started_at: data.started_at,
        ended_at: data.ended_at,
        browsing_duration_seconds: data.browsing_duration_seconds ?? 0,
        page_views: data.page_views ?? 0,
        items_viewed: data.items_viewed ?? 0,
        items_added_to_cart: data.items_added_to_cart ?? 0,
        viewed_products: (data.viewed_products ?? []) as ViewedProduct[],
        cart_history: (data.cart_history ?? []) as CartAction[],
        converted_at: data.converted_at,
        order_id: data.order_id,
        referrer: data.referrer,
        utm_source: data.utm_source,
        utm_medium: data.utm_medium,
        utm_campaign: data.utm_campaign,
        menu: menuInfo,
      };
    },
    enabled: !!sessionId && !!tenantId,
    staleTime: 60000,
    retry: false,
  });
}

export function StorefrontSessionLink({
  sessionId,
  menuId: _menuId,
  compact = false,
}: StorefrontSessionLinkProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const tenantId = tenant?.id;

  const { data: session, isLoading, error: _error } = useSessionDetails(sessionId, tenantId);

  // Calculate conversion metrics
  const conversionMetrics = useMemo(() => {
    if (!session) return null;

    const viewToCartRate =
      session.items_viewed > 0
        ? Math.round((session.items_added_to_cart / session.items_viewed) * 100)
        : 0;

    return {
      viewToCartRate,
      converted: !!session.converted_at,
      timeToConvert: session.converted_at
        ? Math.round(
            (new Date(session.converted_at).getTime() -
              new Date(session.started_at).getTime()) /
              1000
          )
        : null,
    };
  }, [session]);

  // Don't render if no session ID
  if (!sessionId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Customer Journey
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Session not found - show minimal info
  if (!session) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Customer Journey
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Session ID: <span className="font-mono text-xs">{sessionId.slice(0, 8)}...</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Detailed session data not available
          </p>
        </CardContent>
      </Card>
    );
  }

  const SourceIcon = session.source_type === 'menu' ? Utensils : Store;

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{formatDuration(session.browsing_duration_seconds)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span>{session.items_viewed} viewed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MousePointer className="h-4 w-4 text-muted-foreground" />
          <span>{session.page_views} pages</span>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          Customer Journey
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session Source */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <SourceIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {session.source_type}
              </Badge>
              {conversionMetrics?.converted && (
                <Badge variant="default" className="bg-green-500">
                  Converted
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Started {formatSmartDate(session.started_at)}
            </p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {formatDuration(session.browsing_duration_seconds)}
                    </p>
                    <p className="text-xs text-muted-foreground">Browsing time</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total time spent browsing before placing the order</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Eye className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">{session.items_viewed}</p>
                    <p className="text-xs text-muted-foreground">Products viewed</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of unique products the customer looked at</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <MousePointer className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">{session.page_views}</p>
                    <p className="text-xs text-muted-foreground">Page views</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total pages visited during the session</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <ShoppingCart className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">{session.items_added_to_cart}</p>
                    <p className="text-xs text-muted-foreground">Cart additions</p>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Items added to cart during browsing</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Conversion Rate */}
        {conversionMetrics && conversionMetrics.viewToCartRate > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                {conversionMetrics.viewToCartRate}% view-to-cart rate
              </p>
              {conversionMetrics.timeToConvert && (
                <p className="text-xs text-green-600 dark:text-green-500">
                  Converted in {formatDuration(conversionMetrics.timeToConvert)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Menu Link */}
        {session.menu && (
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Source Menu
            </p>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session.menu.name}</p>
                <p className="text-xs text-muted-foreground">
                  Created {formatSmartDate(session.menu.created_at)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToAdmin(`menus/${session.menu?.id}`)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View
              </Button>
            </div>
          </div>
        )}

        {/* Products Viewed (Collapsible) */}
        {session.viewed_products.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Products Viewed ({session.viewed_products.length})
                </span>
                <ChevronRight className="h-4 w-4 transition-transform ui-expanded:rotate-90" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-32 mt-2">
                <div className="space-y-2 pr-4">
                  {session.viewed_products.map((product, index) => (
                    <div
                      key={`${product.product_id}-${index}`}
                      className="flex items-center justify-between text-sm p-2 rounded bg-muted/30"
                    >
                      <span className="truncate flex-1">{product.name}</span>
                      {product.duration_seconds && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {formatDuration(product.duration_seconds)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* UTM Tracking Info */}
        {(session.utm_source || session.utm_medium || session.utm_campaign) && (
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Traffic Source
            </p>
            <div className="flex flex-wrap gap-1">
              {session.utm_source && (
                <Badge variant="secondary" className="text-xs">
                  source: {session.utm_source}
                </Badge>
              )}
              {session.utm_medium && (
                <Badge variant="secondary" className="text-xs">
                  medium: {session.utm_medium}
                </Badge>
              )}
              {session.utm_campaign && (
                <Badge variant="secondary" className="text-xs">
                  campaign: {session.utm_campaign}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Referrer */}
        {session.referrer && (
          <div className="text-xs text-muted-foreground">
            Referrer: <span className="font-mono">{session.referrer}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StorefrontSessionLink;
