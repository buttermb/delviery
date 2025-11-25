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
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  DollarSign,
  TrendingUp,
  Package,
  AlertCircle,
  ChevronRight,
  Users,
  Store,
  Menu,
  Box,
  MapPin,
  BarChart3,
  Shield,
  Building,
  CheckCircle,
  Plus,
  Clock,
  Truck,
  ArrowRightLeft,
  FileText,
  Globe,
  Sparkles,
  CreditCard,
  Wallet,
  Calendar,
  MessageSquare,
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
import { generateGreeting } from '@/lib/presets/businessTiers';
import {
  type AlertCategory,
  type AttentionItem,
  type QuickAction,
} from '@/types/hotbox';
import {
  sortAttentionQueue,
  getCategoryColor,
  calculateAttentionScore
} from '@/lib/hotbox/attentionQueue';
import { TierUpgradeCard } from './TierUpgradeCard';

// Widgets
import { StreetTierTips } from './widgets/StreetTierTips';
import { TeamActivityWidget } from './widgets/TeamActivityWidget';
import { LocationOverviewWidget } from './widgets/LocationOverviewWidget';
import { ExecutiveSummaryWidget } from './widgets/ExecutiveSummaryWidget';
import { StrategicDecisionsWidget } from './widgets/StrategicDecisionsWidget';
import { WeeklyTrendsWidget } from './widgets/WeeklyTrendsWidget';

// Type definitions
interface PulseMetric {
  id: string;
  label: string;
  value: string;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  subtext?: string;
}

// Helper to get time-appropriate greeting with workflow context
function getGreeting(workflow?: string): { greeting: string; context: string } {
  const hour = new Date().getHours();
  let greeting = 'Hello';

  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else if (hour < 21) greeting = 'Good evening';
  else greeting = 'Working late';

  // Context based on workflow
  const contextMap: Record<string, string> = {
    retail: 'Ready to serve customers?',
    delivery: "Let's get those orders moving!",
    wholesale: 'Time to close some deals!',
    management: "Let's check the numbers.",
    operations: 'Your team is counting on you!',
    general: 'What would you like to do today?',
  };

  return {
    greeting,
    context: contextMap[workflow || 'general'] || contextMap.general,
  };
}

// Get tier-specific motivational greeting
function useTierGreeting(userName: string, tier: string) {
  const tierGreeting = generateGreeting(userName, tier as Parameters<typeof generateGreeting>[1]);
  return tierGreeting;
}

// Priority icon component
function PriorityIcon({ priority }: { priority: 'critical' | 'important' | 'info' }) {
  const colors = {
    critical: 'text-red-500',
    important: 'text-yellow-500',
    info: 'text-green-500',
  };

  return (
    <span className={cn('text-lg', colors[priority])}>
      {priority === 'critical' ? '🔴' : priority === 'important' ? '🟡' : '🟢'}
    </span>
  );
}

// Icon mapping for quick actions
const iconMap: Record<string, React.ReactNode> = {
  DollarSign: <DollarSign className="h-5 w-5" />,
  Plus: <Plus className="h-5 w-5" />,
  Package: <Package className="h-5 w-5" />,
  Store: <Store className="h-5 w-5" />,
  Menu: <Menu className="h-5 w-5" />,
  Box: <Box className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  MapPin: <MapPin className="h-5 w-5" />,
  BarChart3: <BarChart3 className="h-5 w-5" />,
  CheckCircle: <CheckCircle className="h-5 w-5" />,
  ArrowRightLeft: <ArrowRightLeft className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  Shield: <Shield className="h-5 w-5" />,
  Building: <Building className="h-5 w-5" />,
  Globe: <Globe className="h-5 w-5" />,
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  CreditCard: <CreditCard className="h-5 w-5" />,
  Wallet: <Wallet className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  MessageSquare: <MessageSquare className="h-5 w-5" />,
  Truck: <Truck className="h-5 w-5" />,
  Clock: <Clock className="h-5 w-5" />,
  AlertCircle: <AlertCircle className="h-5 w-5" />,
};

export function HotboxDashboard() {
  const { tenant, admin } = useTenantAdminAuth();
  const { tier, preset, hasWidget, isLoading: tierLoading } = useTierDashboard();
  const {
    trackFeature,
    getPersonalizedQuickActions,
    isPowerUser,
  } = useFeatureTracking();
  const navigate = useNavigate();

  // Track Hotbox visit
  useEffect(() => {
    trackFeature('hotbox');
  }, [trackFeature]);

  // Get tier-specific motivational message
  const userName = admin?.name || admin?.email?.split('@')[0] || 'there';
  const tierGreeting = useTierGreeting(userName, tier);

  // Fetch dashboard pulse data
  const { data: pulseData, isLoading: pulseLoading } = useQuery({
    queryKey: ['hotbox-pulse', tenant?.id],
    queryFn: async (): Promise<{
      pulseMetrics: PulseMetric[];
      attentionItems: AttentionItem[];
    }> => {
      if (!tenant?.id) throw new Error('No tenant');

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Fetch today's revenue
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .gte('created_at', today.toISOString())
        .not('status', 'in', '("cancelled","rejected","refunded")');

      const todayRevenue = todayOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

      // Fetch yesterday's revenue for comparison
      const { data: yesterdayOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString())
        .not('status', 'in', '("cancelled","rejected","refunded")');

      const yesterdayRevenue = yesterdayOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
      const revenueChange = yesterdayRevenue > 0
        ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
        : 0;

      // Fetch pending orders count
      const { count: pendingOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'pending');

      // Fetch pending menu orders
      const { count: pendingMenuOrders, data: menuOrdersData } = await supabase
        .from('menu_orders')
        .select('total_amount', { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .eq('status', 'pending');

      const menuOrdersValue = menuOrdersData?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

      // Fetch low stock items
      const { count: lowStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .lt('stock_quantity', 10)
        .gt('stock_quantity', 0);

      // Fetch out of stock items
      const { count: outOfStockCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .lte('stock_quantity', 0);

      // Fetch customer tabs (unpaid balances)
      const { data: customerTabs } = await supabase
        .from('customers')
        .select('id, balance')
        .eq('tenant_id', tenant.id)
        .gt('balance', 0);

      const totalTabsOwed = customerTabs?.reduce((sum, c) => sum + Number(c.balance || 0), 0) || 0;
      const overdueTabsCount = customerTabs?.length || 0;

      // Fetch deliveries in progress
      // @ts-expect-error - Deep type instantiation from Supabase query
      const { count: deliveriesInProgress } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'in_transit');

      // Fetch late deliveries (ETA passed)
      const { count: lateDeliveries } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'in_transit')
        .lt('estimated_delivery_time', new Date().toISOString());

      // Fetch wholesale orders pending approval
      const { count: wholesalePending, data: wholesaleData } = await supabase
        .from('wholesale_orders')
        .select('total_amount', { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .eq('status', 'pending');

      const wholesaleValue = wholesaleData?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;

      // Calculate profit margin (simplified - 25% assumed margin)
      const profit = todayRevenue * 0.25;

      // Build pulse metrics based on tier
      const pulseMetrics: PulseMetric[] = [
        {
          id: 'revenue',
          label: 'Revenue',
          value: `$${todayRevenue.toLocaleString()}`,
          change: revenueChange !== 0 ? `${revenueChange > 0 ? '+' : ''}${revenueChange}%` : undefined,
          changeType: revenueChange > 0 ? 'increase' : revenueChange < 0 ? 'decrease' : 'neutral',
          subtext: 'today',
        },
        {
          id: 'profit',
          label: 'Profit',
          value: `$${profit.toLocaleString()}`,
          subtext: '~25% margin',
        },
        {
          id: 'orders',
          label: 'Orders',
          value: `${todayOrders?.length || 0}`,
          subtext: 'today',
        },
        {
          id: 'pending',
          label: 'Pending',
          value: `${(pendingOrders || 0) + (pendingMenuOrders || 0)}`,
          subtext: pendingOrders || pendingMenuOrders ? '🔴 action' : 'none',
        },
      ];

      // Build attention items with category + priority scoring
      const attentionItems: AttentionItem[] = [];

      // CRITICAL ITEMS (🔴)

      // Pending menu orders - highest priority (money waiting!)
      if (pendingMenuOrders && pendingMenuOrders > 0) {
        attentionItems.push({
          id: 'menu-orders',
          priority: 'critical',
          category: 'orders' as AlertCategory,
          title: `${pendingMenuOrders} Disposable Menu orders waiting`,
          value: `$${menuOrdersValue.toLocaleString()}`,
          actionUrl: '/admin/disposable-menu-orders',
          actionLabel: 'Process',
          timestamp: new Date().toISOString(), // In real app, use oldest order date
        });
      }

      // Late deliveries - customer experience at risk
      if (lateDeliveries && lateDeliveries > 0) {
        attentionItems.push({
          id: 'late-deliveries',
          priority: 'critical',
          category: 'delivery' as AlertCategory,
          title: `${lateDeliveries} deliveries running late`,
          description: 'Customer waiting - check in with driver',
          actionUrl: '/admin/deliveries',
          actionLabel: 'Track',
          timestamp: new Date().toISOString(),
        });
      }

      // Out of stock items - can't sell what you don't have
      if (outOfStockCount && outOfStockCount > 0) {
        attentionItems.push({
          id: 'out-of-stock',
          priority: 'critical',
          category: 'inventory' as AlertCategory,
          title: `${outOfStockCount} products out of stock`,
          description: 'Customers can\'t order these items',
          actionUrl: '/admin/inventory-dashboard?filter=out_of_stock',
          actionLabel: 'Restock',
          timestamp: new Date().toISOString(),
        });
      }

      // IMPORTANT ITEMS (🟡)

      // Regular pending orders
      if (pendingOrders && pendingOrders > 0) {
        attentionItems.push({
          id: 'pending-orders',
          priority: pendingOrders > 5 ? 'critical' : 'important',
          category: 'orders' as AlertCategory,
          title: `${pendingOrders} orders waiting to be processed`,
          actionUrl: '/admin/orders?status=pending',
          actionLabel: 'View',
          timestamp: new Date().toISOString(),
        });
      }

      // Wholesale orders pending
      if (wholesalePending && wholesalePending > 0) {
        attentionItems.push({
          id: 'wholesale-pending',
          priority: 'important',
          category: 'orders' as AlertCategory,
          title: `${wholesalePending} wholesale orders need approval`,
          value: `$${wholesaleValue.toLocaleString()}`,
          actionUrl: '/admin/wholesale-orders',
          actionLabel: 'Review',
          timestamp: new Date().toISOString(),
        });
      }

      // Low stock items
      if (lowStockCount && lowStockCount > 0) {
        attentionItems.push({
          id: 'low-stock',
          priority: 'important',
          category: 'inventory' as AlertCategory,
          title: `${lowStockCount} items low on stock`,
          description: 'Reorder to avoid running out',
          actionUrl: '/admin/inventory-dashboard',
          actionLabel: 'Reorder',
          timestamp: new Date().toISOString(),
        });
      }

      // Customer tabs overdue
      if (overdueTabsCount > 0 && totalTabsOwed > 100) {
        attentionItems.push({
          id: 'customer-tabs',
          priority: 'important',
          category: 'customers' as AlertCategory,
          title: `${overdueTabsCount} customers with open tabs`,
          value: `$${totalTabsOwed.toLocaleString()} owed`,
          actionUrl: '/admin/customer-tabs',
          actionLabel: 'Collect',
          timestamp: new Date().toISOString(),
        });
      }

      // INFO ITEMS (🟢)

      // Deliveries in progress - good to know
      if (deliveriesInProgress && deliveriesInProgress > 0 && !lateDeliveries) {
        attentionItems.push({
          id: 'deliveries-active',
          priority: 'info',
          category: 'delivery' as AlertCategory,
          title: `${deliveriesInProgress} deliveries in progress`,
          description: 'All on schedule',
          actionUrl: '/admin/deliveries',
          actionLabel: 'Track',
          timestamp: new Date().toISOString(),
        });
      }

      // Add "all good" message if nothing else
      if (attentionItems.length === 0) {
        attentionItems.push({
          id: 'all-good',
          priority: 'info',
          category: 'system' as AlertCategory,
          title: 'All caught up!',
          description: 'No urgent items need your attention',
          actionUrl: '/admin/orders',
          actionLabel: 'View Orders',
          timestamp: new Date().toISOString(),
        });
      }

      // Sort by weighted score algorithm
      const scoredItems = attentionItems.map(item => ({
        ...item,
        score: calculateAttentionScore(item)
      }));

      // Sort by score (highest first)
      const sortedItems = sortAttentionQueue(scoredItems);

      return { pulseMetrics, attentionItems: sortedItems };
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  // Build quick actions from tier preset + personalized suggestions
  const presetActions: QuickAction[] = preset.quickActions.map(action => ({
    id: action.id,
    label: action.label,
    icon: iconMap[action.icon] || <Package className="h-5 w-5" />,
    path: action.path,
    isPersonalized: false,
  }));

  // Add personalized actions based on user patterns
  const personalizedFeatures = getPersonalizedQuickActions();
  const personalizedActions: QuickAction[] = personalizedFeatures
    .filter(featureId => !presetActions.some(a => a.id === featureId))
    .slice(0, 2) // Add up to 2 personalized actions
    .map(featureId => ({
      id: featureId,
      label: featureId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      icon: <Sparkles className="h-5 w-5 text-yellow-500" />,
      path: `/admin/${featureId}`,
      isPersonalized: true,
    }));

  const quickActions = [...presetActions, ...personalizedActions];

  const isLoading = tierLoading || pulseLoading;

  if (isLoading) {
    return <HotboxSkeleton />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header - Personalized Greeting with Tier-Specific Message */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {preset.emoji} {tierGreeting.timeGreeting}, {userName}!
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
            <span className="text-xl">💰</span> TODAY'S PULSE
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

      {/* Attention Queue */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <span className="text-xl">⚡</span> NEEDS YOUR ATTENTION
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pulseData?.attentionItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg border transition-colors',
                item.priority === 'critical' && 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
                item.priority === 'important' && 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
                item.priority === 'info' && 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
              )}
            >
              <div className="flex items-center gap-3">
                <PriorityIcon priority={item.priority} />
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {item.title}
                    {item.category && (
                      <Badge variant="outline" className={cn("text-[10px] px-1 h-4", getCategoryColor(item.category))}>
                        {item.category}
                      </Badge>
                    )}
                    {item.value && (
                      <span className="ml-2 text-muted-foreground">({item.value})</span>
                    )}
                  </div>
                  {item.description && (
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(item.actionUrl)}
                className="shrink-0"
              >
                {item.actionLabel}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <span className="text-xl">⚡</span> QUICK ACTIONS
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
                  navigate(action.path);
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

      {/* Street Tier Tips */}
      {hasWidget('street-tips') && <StreetTierTips />}

      {/* Team Activity */}
      {hasWidget('team-activity') && <TeamActivityWidget />}

      {/* Network Overview */}
      {hasWidget('location-overview') && <LocationOverviewWidget />}

      {/* Executive Summary */}
      {hasWidget('executive-summary') && <ExecutiveSummaryWidget />}

      {/* Strategic Decisions */}
      {hasWidget('strategic-decisions') && <StrategicDecisionsWidget />}

      {/* Weekly Trends */}
      {hasWidget('weekly-trends') && <WeeklyTrendsWidget />}
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
