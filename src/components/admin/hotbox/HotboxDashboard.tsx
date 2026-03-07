/**
 * Hotbox Dashboard - Command Center
 *
 * Clean operational dashboard with:
 * - Personalized greeting + Live indicator
 * - 4 white KPI cards (Revenue, Profit, Orders, Needs Attention)
 * - Attention Queue kanban (3 columns)
 * - Quick Actions row (5 buttons with shortcuts)
 * - Two-column: Location Overview | Top Products Today
 */

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useAttentionQueue } from '@/hooks/useAttentionQueue';
import { useQuickActionShortcuts } from '@/hooks/useQuickActionShortcuts';
import {
  Package,
  RefreshCw,
  PlusCircle,
  MapPin,
  Truck,
  BarChart3,
  Star,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useFeatureTracking } from '@/hooks/useFeatureTracking';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

import { AttentionQueueKanban } from './AttentionQueueKanban';
import { LocationOverviewWidget } from './widgets/LocationOverviewWidget';
import { TopProductsTodayWidget } from './widgets/TopProductsWidget';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Pulse metric type
interface PulseMetric {
  id: string;
  label: string;
  value: string;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  subtext?: string;
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// Quick action config for Hotbox
interface HotboxAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  shortcut?: string;
}

const HOTBOX_ACTIONS: HotboxAction[] = [
  { id: 'new-order', label: 'New Order', icon: <PlusCircle className="h-5 w-5" />, path: '/admin/orders?new=true', shortcut: 'Alt+N' },
  { id: 'locations', label: 'Locations', icon: <MapPin className="h-5 w-5" />, path: '/admin/locations', shortcut: 'Alt+L' },
  { id: 'fleet', label: 'Fleet', icon: <Truck className="h-5 w-5" />, path: '/admin/fulfillment-hub', shortcut: 'Alt+F' },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-5 w-5" />, path: '/admin/analytics-hub', shortcut: 'Alt+A' },
  { id: 'pos', label: 'POS System', icon: <Star className="h-5 w-5" />, path: '/admin/pos' },
];

const HOTBOX_SHORTCUT_ACTIONS = [
  { key: 'n', path: '/admin/orders?new=true' },
  { key: 'l', path: '/admin/locations' },
  { key: 'f', path: '/admin/fulfillment-hub' },
  { key: 'a', path: '/admin/analytics-hub' },
];

export function HotboxDashboard() {
  const { tenant, admin } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { trackFeature } = useFeatureTracking();
  const navigate = useNavigate();

  // Keyboard shortcuts
  useQuickActionShortcuts(HOTBOX_SHORTCUT_ACTIONS);

  // Attention queue
  const { queue: attentionQueue, isLoading: attentionLoading, counts, refetch: refetchAttention } = useAttentionQueue();

  // Track Hotbox visit
  useEffect(() => {
    trackFeature('hotbox');
  }, [trackFeature]);

  const userName = admin?.name || admin?.email?.split('@')[0] || 'there';
  const formattedDate = format(new Date(), 'EEEE, MMMM d');

  // Fetch pulse metrics
  const { data: pulseData, isLoading: pulseLoading, dataUpdatedAt, refetch: refetchPulse } = useQuery({
    queryKey: queryKeys.hotbox.pulse(tenant?.id),
    queryFn: async (): Promise<{ pulseMetrics: PulseMetric[] }> => {
      if (!tenant?.id) throw new Error('No tenant');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Aggregate revenue from ALL order sources
      const results = await Promise.allSettled([
        supabase.from('orders').select('total_amount').eq('tenant_id', tenant.id).gte('created_at', today.toISOString()).not('status', 'in', '("cancelled","rejected","refunded")'),
        supabase.from('menu_orders').select('total_amount').eq('tenant_id', tenant.id).gte('created_at', today.toISOString()),
        supabase.from('wholesale_orders').select('total_amount').eq('tenant_id', tenant.id).gte('created_at', today.toISOString()),
        supabase.from('orders').select('total_amount').eq('tenant_id', tenant.id).gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()).not('status', 'in', '("cancelled","rejected","refunded")'),
        supabase.from('menu_orders').select('total_amount').eq('tenant_id', tenant.id).gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()),
        supabase.from('wholesale_orders').select('total_amount').eq('tenant_id', tenant.id).gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString()),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'pending'),
        supabase.from('menu_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'pending'),
        supabase.from('wholesale_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'pending'),
      ]);

      const getOrderData = (result: PromiseSettledResult<{ data: { total_amount: number }[] | null }>) =>
        result.status === 'fulfilled' && result.value.data ? result.value.data : [];

      const getCount = (result: PromiseSettledResult<{ count: number | null }>) =>
        result.status === 'fulfilled' && result.value.count !== null ? result.value.count : 0;

      const todayRetailOrders = getOrderData(results[0] as PromiseSettledResult<{ data: { total_amount: number }[] | null }>);
      const todayMenuOrders = getOrderData(results[1] as PromiseSettledResult<{ data: { total_amount: number }[] | null }>);
      const todayWholesaleOrders = getOrderData(results[2] as PromiseSettledResult<{ data: { total_amount: number }[] | null }>);

      const todayRevenue =
        todayRetailOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) +
        todayMenuOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) +
        todayWholesaleOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      const todayOrderCount = todayRetailOrders.length + todayMenuOrders.length + todayWholesaleOrders.length;

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

      const pendingOrders = getCount(results[6] as PromiseSettledResult<{ count: number | null }>);
      const pendingMenuOrders = getCount(results[7] as PromiseSettledResult<{ count: number | null }>);
      const pendingWholesaleOrders = getCount(results[8] as PromiseSettledResult<{ count: number | null }>);
      const totalPending = pendingOrders + pendingMenuOrders + pendingWholesaleOrders;
      const completedToday = todayOrderCount - totalPending;

      // Calculate profit with actual costs when available
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`quantity, price, product:products(cost), order:orders!inner(tenant_id, created_at)`)
        .eq('order.tenant_id', tenant.id)
        .gte('order.created_at', today.toISOString());

      let profit: number;
      let actualMargin: number | null = null;
      const ESTIMATED_PROFIT_MARGIN = 0.25;

      if (orderItems && orderItems.length > 0) {
        const totalCost = orderItems.reduce((sum, item) => {
          const productCost = (item.product as { cost?: number } | null)?.cost ?? 0;
          return sum + (productCost * (item.quantity ?? 0));
        }, 0);

        if (totalCost > 0 && todayRevenue > 0) {
          profit = todayRevenue - totalCost;
          actualMargin = profit / todayRevenue;
        } else {
          profit = todayRevenue * ESTIMATED_PROFIT_MARGIN;
        }
      } else {
        profit = todayRevenue * ESTIMATED_PROFIT_MARGIN;
      }

      const marginDisplay = actualMargin !== null
        ? `${Math.round(actualMargin * 100)}% margin`
        : '~25% est.';

      const pulseMetrics: PulseMetric[] = [
        {
          id: 'revenue',
          label: 'REVENUE TODAY',
          value: formatCurrency(todayRevenue),
          change: revenueChange !== 0 ? `${revenueChange > 0 ? '+' : ''}${revenueChange}% vs yesterday` : undefined,
          changeType: revenueChange > 0 ? 'increase' : revenueChange < 0 ? 'decrease' : 'neutral',
        },
        {
          id: 'profit',
          label: 'PROFIT',
          value: formatCurrency(profit),
          subtext: marginDisplay,
        },
        {
          id: 'orders',
          label: 'ORDERS TODAY',
          value: `${todayOrderCount}`,
          subtext: `${totalPending} pending / ${Math.max(0, completedToday)} completed`,
        },
        {
          id: 'attention',
          label: 'NEEDS ATTENTION',
          value: `${counts.total} items`,
          subtext: counts.critical > 0 ? `${counts.critical} urgent` : undefined,
        },
      ];

      return { pulseMetrics };
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const attentionItems = attentionQueue?.items ?? [];

  const isLoading = pulseLoading || attentionLoading;

  const lastUpdatedText = useMemo(() => {
    if (!dataUpdatedAt) return null;
    const seconds = Math.floor((Date.now() - dataUpdatedAt) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  }, [dataUpdatedAt]);

  const handleRefresh = () => {
    refetchPulse();
    refetchAttention();
  };

  if (isLoading) return <HotboxSkeleton />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header — Personalized greeting + Live indicator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Good {getTimeOfDay()}, {userName}
          </h1>
          <p className="text-muted-foreground">
            Daily operations summary.{' '}
            <span className="text-muted-foreground/40">|</span>{' '}
            {formattedDate}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
          {lastUpdatedText && <span>Updated {lastUpdatedText}</span>}
          <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-8 w-8">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 4 White KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {pulseData?.pulseMetrics.map((metric) => (
          <Card key={metric.id} className="p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {metric.label}
            </div>
            <div className="text-2xl md:text-3xl font-bold mt-2">{metric.value}</div>
            {metric.change && (
              <div className={cn(
                'text-sm font-medium mt-1',
                metric.changeType === 'increase' && 'text-emerald-600',
                metric.changeType === 'decrease' && 'text-red-500',
              )}>
                {metric.change}
              </div>
            )}
            {metric.subtext && !metric.change && (
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                {metric.id === 'attention' && counts.critical > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                )}
                {metric.subtext}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Attention Queue Kanban */}
      <AttentionQueueKanban items={attentionItems} />

      {/* Quick Actions */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {HOTBOX_ACTIONS.map((action) => (
          <Card
            key={action.id}
            className="p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/50 hover:shadow-sm transition-all text-center"
            onClick={() => {
              trackFeature(action.id);
              navigate(`/${tenantSlug}${action.path}`);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                trackFeature(action.id);
                navigate(`/${tenantSlug}${action.path}`);
              }
            }}
          >
            <span className="text-muted-foreground">{action.icon}</span>
            <span className="text-xs font-medium leading-tight">{action.label}</span>
            {action.shortcut && (
              <span className="text-[10px] text-muted-foreground/60">{action.shortcut}</span>
            )}
          </Card>
        ))}
      </div>

      {/* Two-column: Location Overview + Top Products */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ErrorBoundary>
          <LocationOverviewWidget />
        </ErrorBoundary>
        <ErrorBoundary>
          <TopProductsTodayWidget />
        </ErrorBoundary>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-32 mt-2" />
          </Card>
        ))}
      </div>
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
