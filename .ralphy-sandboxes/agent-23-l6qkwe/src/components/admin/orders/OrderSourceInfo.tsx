/**
 * Order Source Info Component
 *
 * Displays detailed information about the order source including:
 * - Source badge (admin, storefront, menu, pos, api)
 * - Link to source menu (if from disposable menu)
 * - Session tracking info (if from storefront)
 * - Customer journey insights
 */

import { useQuery } from '@tanstack/react-query';

import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Monitor from "lucide-react/dist/esm/icons/monitor";
import Utensils from "lucide-react/dist/esm/icons/utensils";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import Zap from "lucide-react/dist/esm/icons/zap";
import Store from "lucide-react/dist/esm/icons/store";
import Clock from "lucide-react/dist/esm/icons/clock";
import Eye from "lucide-react/dist/esm/icons/eye";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderSourceBadge } from '@/components/admin/orders/OrderSourceBadge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatSmartDate } from '@/lib/utils/formatDate';

interface OrderSourceInfoProps {
  /** The order source type */
  source: string | null | undefined;
  /** The source menu ID (if from disposable menu) */
  sourceMenuId?: string | null;
  /** The source session ID (if from storefront) */
  sourceSessionId?: string | null;
  /** Whether to show as a card or inline */
  variant?: 'card' | 'inline';
}

interface MenuInfo {
  id: string;
  name: string;
  created_at: string;
  expires_at: string | null;
  status: string;
}

interface SessionInfo {
  browsing_duration_seconds?: number;
  items_viewed?: number;
  started_at?: string;
}

/**
 * Hook to fetch source menu details
 */
function useSourceMenu(menuId: string | null | undefined, tenantId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.menus.byTenant(tenantId || ''), 'source', menuId],
    queryFn: async (): Promise<MenuInfo | null> => {
      if (!menuId || !tenantId) return null;

      const { data, error } = await supabase
        .from('disposable_menus')
        .select('id, name, created_at, expires_at, status')
        .eq('id', menuId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch source menu', error, { component: 'OrderSourceInfo', menuId });
        return null;
      }

      return data as unknown as MenuInfo | null;
    },
    enabled: !!menuId && !!tenantId,
    staleTime: 60000,
  });
}

/**
 * Hook to fetch storefront session details
 */
function useSourceSession(sessionId: string | null | undefined, tenantId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.storefrontSession.bySession(tenantId, sessionId),
    queryFn: async (): Promise<SessionInfo | null> => {
      if (!sessionId || !tenantId) return null;

      // Try to fetch from storefront_sessions if it exists
      const { data, error } = await supabase
        .from('storefront_sessions')
        .select('started_at, browsing_duration_seconds, items_viewed')
        .eq('id', sessionId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        // Table might not exist, which is fine
        logger.debug('Could not fetch storefront session', { sessionId, error: error.message });
        return null;
      }

      return data;
    },
    enabled: !!sessionId && !!tenantId,
    staleTime: 60000,
    retry: false,
  });
}

/**
 * Get source icon component
 */
function getSourceIcon(source: string | null | undefined) {
  const normalizedSource = source?.toLowerCase() || 'admin';
  switch (normalizedSource) {
    case 'pos':
      return ShoppingCart;
    case 'storefront':
      return Store;
    case 'menu':
      return Utensils;
    case 'api':
      return Zap;
    default:
      return Monitor;
  }
}

/**
 * Get source description
 */
function getSourceDescription(source: string | null | undefined): string {
  const normalizedSource = source?.toLowerCase() || 'admin';
  switch (normalizedSource) {
    case 'pos':
      return 'Created through the Point of Sale system';
    case 'storefront':
      return 'Customer placed order through online storefront';
    case 'menu':
      return 'Customer ordered from a disposable menu link';
    case 'api':
      return 'Order created via API integration';
    default:
      return 'Manually created by admin';
  }
}

export function OrderSourceInfo({
  source,
  sourceMenuId,
  sourceSessionId,
  variant = 'card',
}: OrderSourceInfoProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const tenantId = tenant?.id;

  const { data: menuInfo, isLoading: isLoadingMenu } = useSourceMenu(sourceMenuId, tenantId);
  const { data: sessionInfo, isLoading: isLoadingSession } = useSourceSession(sourceSessionId, tenantId);

  const SourceIcon = getSourceIcon(source);
  const sourceDescription = getSourceDescription(source);

  const content = (
    <div className="space-y-4">
      {/* Source Badge and Description */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <SourceIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <OrderSourceBadge source={source} />
          </div>
          <p className="text-sm text-muted-foreground">{sourceDescription}</p>
        </div>
      </div>

      {/* Source Menu Info */}
      {sourceMenuId && (
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Source Menu
          </p>
          {isLoadingMenu ? (
            <Skeleton className="h-10 w-full" />
          ) : menuInfo ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{menuInfo.name}</p>
                <p className="text-xs text-muted-foreground">
                  Created {formatSmartDate(menuInfo.created_at)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToAdmin(`menus/${menuInfo.id}`)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Menu
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Menu not found or deleted</p>
          )}
        </div>
      )}

      {/* Session Info */}
      {sourceSessionId && (
        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Customer Journey
          </p>
          {isLoadingSession ? (
            <Skeleton className="h-16 w-full" />
          ) : sessionInfo ? (
            <div className="grid grid-cols-2 gap-3">
              {sessionInfo.browsing_duration_seconds !== undefined && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {Math.floor(sessionInfo.browsing_duration_seconds / 60)}m{' '}
                      {sessionInfo.browsing_duration_seconds % 60}s
                    </p>
                    <p className="text-xs text-muted-foreground">Browsing time</p>
                  </div>
                </div>
              )}
              {sessionInfo.items_viewed !== undefined && (
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{sessionInfo.items_viewed}</p>
                    <p className="text-xs text-muted-foreground">Items viewed</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Session ID: <span className="font-mono text-xs">{sourceSessionId.slice(0, 8)}...</span>
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'inline') {
    return content;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <SourceIcon className="w-5 h-5" />
          Order Source
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

export default OrderSourceInfo;
