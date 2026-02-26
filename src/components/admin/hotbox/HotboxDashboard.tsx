/**
 * Hotbox Dashboard - Command Center
 * 
 * The main dashboard component that provides a morning briefing experience
 * instead of a feature maze. Adapts to the 5 business tiers.
 * 
 * Enhanced with:
 * - Smart pattern detection for personalized quick actions
 * - Tier-specific views and data
 * - Real-time attention queue
 * - Kanban view option for attention items
 */

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useAttentionQueue } from '@/hooks/useAttentionQueue';
import {
  DollarSign,
  Package,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTierDashboard } from '@/hooks/useTierDashboard';
import { useFeatureTracking } from '@/hooks/useFeatureTracking';
import { cn } from '@/lib/utils';

import { formatCurrency } from '@/lib/formatters';
import { generateGreeting } from '@/lib/presets/businessTiers';

import {
  type QuickAction,
} from '@/types/hotbox';
import { TierUpgradeCard } from './TierUpgradeCard';
import { AttentionQueueKanban } from './AttentionQueueKanban';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Widgets
import { StreetTierTips } from './widgets/StreetTierTips';
import { TeamActivityWidget } from './widgets/TeamActivityWidget';
import { LocationOverviewWidget } from './widgets/LocationOverviewWidget';
import { ExecutiveSummaryWidget } from './widgets/ExecutiveSummaryWidget';
import { StrategicDecisionsWidget } from './widgets/StrategicDecisionsWidget';
import { WeeklyTrendsWidget } from './widgets/WeeklyTrendsWidget';
import { LiveOrdersWidget } from './widgets/LiveOrdersWidget';

// Type definitions
interface PulseMetric {
  id: string;
  label: string;
  value: string;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  subtext?: string;
}


// Get tier-specific motivational greeting - memoized to not change on re-render
function useTierGreeting(userName: string, tier: string) {
  // Use date as seed so greeting changes daily, not on every render
  const dateKey = format(new Date(), 'yyyy-MM-dd');

  return useMemo(() => {
    return generateGreeting(userName, tier as Parameters<typeof generateGreeting>[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dateKey is intentionally used to refresh greeting daily
  }, [userName, tier, dateKey]);
}

// Priority icon component - kept but prefixed as currently unused
function _PriorityIcon({ priority }: { priority: 'critical' | 'important' | 'info' }) {
  const colors = {
    critical: 'bg-red-500',
    important: 'bg-yellow-500',
    info: 'bg-green-500',
  };

  return (
    <span className={cn('inline-block w-3 h-3 rounded-full', colors[priority])} />
  );
}

// Use centralized icon map
import { iconMap } from '@/lib/icons/iconMap';
import { queryKeys } from '@/lib/queryKeys';

export function HotboxDashboard() {
  const { tenant, admin } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tier, preset, hasWidget, isLoading: tierLoading } = useTierDashboard();
  const {
    trackFeature,
    getPersonalizedQuickActions,
    isPowerUser,
  } = useFeatureTracking();
  const navigate = useNavigate();

  // Use centralized attention queue hook (single source of truth)
  const { queue: attentionQueue, isLoading: attentionLoading } = useAttentionQueue();

  // Track Hotbox visit
  useEffect(() => {
    trackFeature('hotbox');
  }, [trackFeature]);

  // Get tier-specific motivational message
  const userName = admin?.name || admin?.email?.split('@')[0] || 'there';
  const tierGreeting = useTierGreeting(userName, tier);

  // Fetch ONLY pulse metrics (attention queue comes from hook)
  const { data: pulseData, isLoading: pulseLoading } = useQuery({
    queryKey: queryKeys.hotbox.pulse(tenant?.id),
    queryFn: async (): Promise<{ pulseMetrics: PulseMetric[] }> => {
      if (!tenant?.id) throw new Error('No tenant');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Aggregate revenue from ALL order sources using Promise.allSettled for resilience
      const results = await Promise.allSettled([
        // Today's retail orders
        supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', today.toISOString())
          .not('status', 'in', '("cancelled","rejected","refunded")'),

        // Today's menu orders
        supabase
          .from('menu_orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', today.toISOString()),

        // Today's wholesale orders
        supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', today.toISOString()),

        // Yesterday's retail orders for comparison
        supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString())
          .not('status', 'in', '("cancelled","rejected","refunded")'),

        // Yesterday's menu orders for comparison
        supabase
          .from('menu_orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString()),

        // Yesterday's wholesale orders for comparison
        supabase
          .from('wholesale_orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', yesterday.toISOString())
          .lt('created_at', today.toISOString()),

        // Pending orders count
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('status', 'pending'),

        // Pending menu orders count
        supabase
          .from('menu_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('status', 'pending'),

        // Pending wholesale orders count
        supabase
          .from('wholesale_orders')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant.id)
          .eq('status', 'pending'),
      ]);

      // Helper to safely extract data from settled results
      const getOrderData = (result: PromiseSettledResult<{ data: { total_amount: number }[] | null }>) => {
        if (result.status === 'fulfilled' && result.value.data) {
          return result.value.data;
        }
        return [];
      };
      
      const getCount = (result: PromiseSettledResult<{ count: number | null }>) => {
        if (result.status === 'fulfilled' && result.value.count !== null) {
          return result.value.count;
        }
        return 0;
      };

      // Aggregate today's revenue from all sources
      const todayRetailOrders = getOrderData(results[0] as PromiseSettledResult<{ data: { total_amount: number }[] | null }>);
      const todayMenuOrders = getOrderData(results[1] as PromiseSettledResult<{ data: { total_amount: number }[] | null }>);
      const todayWholesaleOrders = getOrderData(results[2] as PromiseSettledResult<{ data: { total_amount: number }[] | null }>);
      
      const todayRevenue = 
        todayRetailOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) +
        todayMenuOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) +
        todayWholesaleOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      
      const todayOrderCount = todayRetailOrders.length + todayMenuOrders.length + todayWholesaleOrders.length;

      // Aggregate yesterday's revenue from all sources
      const yesterdayRetailOrders = getOrderData(results[3] as PromiseSettledResult<{ data: { total_amount: number }[] | null }>);
      const yesterdayMenuOrders = getOrderData(results[4] as PromiseSettledResult<{ data: { total_amount: number }[] | null }>);
      const yesterdayWholesaleOrders = getOrderData(results[5] as PromiseSettledResult<{ data: { total_amount: number }[] | null }>);
      
      const yesterdayRevenue = 
        yesterdayRetailOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) +
        yesterdayMenuOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) +
        yesterdayWholesaleOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      const revenueChange = yesterdayRevenue > 0
        ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
        : 0;

      // Get pending counts from all sources
      const pendingOrders = getCount(results[6] as PromiseSettledResult<{ count: number | null }>);
      const pendingMenuOrders = getCount(results[7] as PromiseSettledResult<{ count: number | null }>);
      const pendingWholesaleOrders = getCount(results[8] as PromiseSettledResult<{ count: number | null }>);
      const totalPending = pendingOrders + pendingMenuOrders + pendingWholesaleOrders;
      
      // Calculate profit using actual product costs when available
      // Fetch today's order items with product costs for accurate margin calculation
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          quantity,
          price,
          product_id,
          order:orders!inner(tenant_id, created_at),
          product:products(cost)
        `)
        .eq('order.tenant_id', tenant.id)
        .gte('order.created_at', today.toISOString());

      let profit: number;
      let actualMargin: number | null = null;
      const ESTIMATED_PROFIT_MARGIN = 0.25;
      
      if (orderItems && orderItems.length > 0) {
        // Calculate actual profit from product costs
        const totalCost = orderItems.reduce((sum, item) => {
          const productCost = (item.product as { cost?: number } | null)?.cost ?? 0;
          return sum + (productCost * (item.quantity ?? 0));
        }, 0);
        
        if (totalCost > 0 && todayRevenue > 0) {
          profit = todayRevenue - totalCost;
          actualMargin = profit / todayRevenue;
        } else {
          // Fall back to estimated margin if no cost data
          profit = todayRevenue * ESTIMATED_PROFIT_MARGIN;
        }
      } else {
        // Fall back to estimated margin if no order items
        profit = todayRevenue * ESTIMATED_PROFIT_MARGIN;
      }
      
      const marginDisplay = actualMargin !== null 
        ? `${Math.round(actualMargin * 100)}% margin` 
        : '~25% est.';

      const pulseMetrics: PulseMetric[] = [
        {
          id: 'revenue',
          label: 'Revenue',
          value: formatCurrency(todayRevenue),
          change: revenueChange !== 0 ? `${revenueChange > 0 ? '+' : ''}${revenueChange}%` : undefined,
          changeType: revenueChange > 0 ? 'increase' : revenueChange < 0 ? 'decrease' : 'neutral',
          subtext: 'today',
        },
        {
          id: 'profit',
          label: 'Profit',
          value: formatCurrency(profit),
          subtext: marginDisplay,
        },
        {
          id: 'orders',
          label: 'Orders',
          value: `${todayOrderCount}`,
          subtext: 'today',
        },
        {
          id: 'pending',
          label: 'Pending',
          value: `${totalPending}`,
          subtext: totalPending > 0 ? 'action needed' : 'none',
        },
      ];

      return { pulseMetrics };
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Get attention items from the centralized hook
  const attentionItems = attentionQueue?.items ?? [];

  // Build quick actions from tier preset + personalized suggestions
  const presetActions: QuickAction[] = useMemo(() =>
    preset.quickActions.map(action => ({
      id: action.id,
      label: action.label,
      icon: iconMap[action.icon] || <Package className="h-5 w-5" />,
      path: action.path,
      isPersonalized: false,
    })),
    [preset.quickActions]
  );

  // Add personalized actions based on user patterns
  const personalizedFeatures = useMemo(() => getPersonalizedQuickActions(), [getPersonalizedQuickActions]);
  const personalizedActions: QuickAction[] = useMemo(() =>
    personalizedFeatures
      .filter(featureId => !presetActions.some(a => a.id === featureId))
      .slice(0, 2) // Add up to 2 personalized actions
      .map(featureId => ({
        id: featureId,
        label: featureId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        icon: <Sparkles className="h-5 w-5 text-yellow-500" />,
        path: `/admin/${featureId}`,
        isPersonalized: true,
      })),
    [personalizedFeatures, presetActions]
  );

  const quickActions = useMemo(
    () => [...presetActions, ...personalizedActions],
    [presetActions, personalizedActions]
  );

  const isLoading = tierLoading || pulseLoading || attentionLoading;

  // Render logic
  return isLoading ? <HotboxSkeleton /> : (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header - Personalized Greeting with Tier-Specific Message */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {tierGreeting.timeGreeting}, {userName}!
          </h1>
          <p className="text-muted-foreground">
            {tierGreeting.tierMessage} • {format(new Date(), 'EEEE, MMMM d')}
          </p>
          {isPowerUser() && (
            <Badge variant="secondary" className="mt-1 text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Power User
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'text-sm font-medium',
              tier === 'street' && 'border-gray-500 text-gray-600',
              tier === 'trap' && 'border-blue-500 text-blue-600',
              tier === 'block' && 'border-purple-500 text-purple-600',
              tier === 'hood' && 'border-orange-500 text-orange-600',
              tier === 'empire' && 'border-yellow-500 text-yellow-600',
            )}
          >
            {preset.displayName} Tier
          </Badge>
        </div>
      </div>

      {/* Pulse Metrics - The 4 key numbers */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> TODAY'S PULSE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {pulseData?.pulseMetrics.map((metric) => (
              <div
                key={metric.id}
                className="bg-white/10 rounded-lg p-4 backdrop-blur-sm"
              >
                <div className="text-2xl md:text-3xl font-bold">{metric.value}</div>
                <div className="text-sm text-white/70">{metric.label}</div>
                {metric.change && (
                  <div className={cn(
                    'text-sm font-medium',
                    metric.changeType === 'increase' && 'text-green-400',
                    metric.changeType === 'decrease' && 'text-red-400',
                  )}>
                    {metric.change}
                  </div>
                )}
                {metric.subtext && !metric.change && (
                  <div className="text-xs text-white/50">{metric.subtext}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Attention Queue with View Toggle */}
      <AttentionQueueKanban items={attentionItems} />


      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> QUICK ACTIONS
            {personalizedActions.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Personalized
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.id}
                variant={action.isPersonalized ? 'secondary' : 'outline'}
                className={cn(
                  'flex items-center gap-2 h-auto py-2 px-3',
                  action.isPersonalized && 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20'
                )}
                onClick={() => {
                  trackFeature(action.id);
                  navigate(`/${tenantSlug}${action.path}`);
                }}
              >
                <span className="shrink-0">{action.icon}</span>
                <span>{action.label}</span>
                {action.isPersonalized && (
                  <span className="text-xs text-muted-foreground ml-1">(for you)</span>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tier Upgrade Progress */}
      <TierUpgradeCard />

      {/* Tier-specific sections - Dynamic Rendering */}

      <div className="space-y-6">
        {/* Live Orders Widget - Real-time order queue */}
        {hasWidget('live-orders') && (
          <ErrorBoundary>
            <LiveOrdersWidget />
          </ErrorBoundary>
        )}

        {/* Street Tier Tips */}
        {hasWidget('street-tips') && (
          <ErrorBoundary>
            <StreetTierTips />
          </ErrorBoundary>
        )}

        {/* Team Activity */}
        {hasWidget('team-activity') && (
          <ErrorBoundary>
            <TeamActivityWidget />
          </ErrorBoundary>
        )}

        {/* Network Overview */}
        {hasWidget('location-overview') && (
          <ErrorBoundary>
            <LocationOverviewWidget />
          </ErrorBoundary>
        )}

        {/* Executive Summary */}
        {hasWidget('executive-summary') && (
          <ErrorBoundary>
            <ExecutiveSummaryWidget />
          </ErrorBoundary>
        )}

        {/* Strategic Decisions */}
        {hasWidget('strategic-decisions') && (
          <ErrorBoundary>
            <StrategicDecisionsWidget />
          </ErrorBoundary>
        )}

        {/* Weekly Trends */}
        {hasWidget('weekly-trends') && (
          <ErrorBoundary>
            <WeeklyTrendsWidget />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

// Loading skeleton
function HotboxSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
