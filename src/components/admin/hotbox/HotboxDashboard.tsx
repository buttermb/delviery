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
import { Link, useNavigate } from 'react-router-dom';
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
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useBusinessTier } from '@/hooks/useBusinessTier';
import { useFeatureTracking } from '@/hooks/useFeatureTracking';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { generateGreeting } from '@/lib/presets/businessTiers';
import { 
  buildAttentionQueue, 
  getTopAttentionItems,
  type AttentionItem as HotboxAttentionItem,
  type AttentionQueue,
  type AlertCategory,
} from '@/lib/hotbox';

// Type definitions
interface PulseMetric {
  id: string;
  label: string;
  value: string;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  subtext?: string;
}

interface AttentionItem {
  id: string;
  priority: 'critical' | 'important' | 'info';
  category?: AlertCategory;
  title: string;
  description?: string;
  value?: string;
  score?: number;
  actionUrl: string;
  actionLabel: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

// Helper to get time-appropriate greeting with workflow context
// (Now enhanced with tier-specific messages from businessTiers.ts)
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
  // Use the enhanced greeting system with tier-specific messages
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
  const { tier, preset, metrics, isLoading: tierLoading } = useBusinessTier();
  const { 
    trackFeature, 
    detectPrimaryWorkflow, 
    getPersonalizedQuickActions,
    isPowerUser,
  } = useFeatureTracking();
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  
  // Track Hotbox visit
  useEffect(() => {
    trackFeature('hotbox');
  }, [trackFeature]);
  
  // Get personalized greeting based on workflow
  const workflow = detectPrimaryWorkflow();
  const { greeting, context } = getGreeting(workflow);
  
  // Get tier-specific motivational message
  const userName = admin?.firstName || admin?.email?.split('@')[0] || 'there';
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
        });
      }
      
      // Sort by weighted score algorithm
      // Score = Base Priority + Category Urgency + Age Factor + Value Factor
      const PRIORITY_WEIGHTS = { critical: 1000, important: 100, info: 10 };
      const CATEGORY_URGENCY: Record<string, number> = {
        orders: 50,      // Money waiting
        delivery: 45,    // Active operations
        compliance: 40,  // Legal risk
        system: 35,      // Technical issues
        inventory: 30,   // Can't sell without it
        customers: 25,   // Relationship management
        financial: 20,   // Money tracking
        team: 15,        // People management
      };
      
      // Calculate score for each item
      const scoredItems = attentionItems.map(item => {
        let score = PRIORITY_WEIGHTS[item.priority];
        score += CATEGORY_URGENCY[item.category || 'system'] || 0;
        
        // Value factor: log10(amount) * 20 for items with dollar values
        if (item.value) {
          const numericValue = parseFloat(item.value.replace(/[^0-9.]/g, ''));
          if (!isNaN(numericValue) && numericValue > 0) {
            score += Math.min(100, Math.log10(numericValue + 1) * 20);
          }
        }
        
        return { ...item, score: Math.round(score) };
      });
      
      // Sort by score (highest first)
      scoredItems.sort((a, b) => (b.score || 0) - (a.score || 0));

      return { pulseMetrics, attentionItems: scoredItems };
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  // Build quick actions from tier preset + personalized suggestions
  const presetActions = preset.quickActions.map(action => ({
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
                  <div className="font-medium">
                    {item.title}
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
                  'flex items-center gap-2',
                  action.isPersonalized && 'border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20'
                )}
                onClick={() => {
                  trackFeature(action.id);
                  navigate(action.path);
                }}
              >
                {action.icon}
                {action.label}
                {action.isPersonalized && (
                  <span className="text-xs text-muted-foreground">(for you)</span>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tier-specific sections */}
      
      {/* Street tier: Quick Tips */}
      {tier === 'street' && <StreetTierTips />}
      
      {/* Trap tier: Team Today */}
      {tier === 'trap' && <TeamToday />}
      
      {/* Block+ tiers: Network Overview */}
      {(tier === 'block' || tier === 'hood' || tier === 'empire') && (
        <LocationOverview />
      )}

      {/* Hood+ tiers: Executive Summary */}
      {(tier === 'hood' || tier === 'empire') && (
        <ExecutiveSummary />
      )}
      
      {/* Empire tier: Strategic Decisions */}
      {tier === 'empire' && <StrategicDecisions />}
      
      {/* Weekly Progress (all tiers except street) */}
      {tier !== 'street' && <WeeklyProgress />}
    </div>
  );
}

// Location Overview for Block+ tiers
function LocationOverview() {
  const { tenant } = useTenantAdminAuth();

  const { data: locations, isLoading } = useQuery({
    queryKey: ['hotbox-locations', tenant?.id],
    queryFn: async () => {
      // Placeholder - would fetch actual location data
      return [
        { id: '1', name: 'Main', revenue: 3200, margin: 28, orders: 18, issues: 0 },
        { id: '2', name: 'Downtown', revenue: 2100, margin: 24, orders: 12, issues: 1 },
        { id: '3', name: 'Heights', revenue: 1800, margin: 22, orders: 9, issues: 2 },
      ];
    },
    enabled: !!tenant?.id,
  });

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">📍</span> NETWORK OVERVIEW
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium">Location</th>
                <th className="text-right py-2 font-medium">Today</th>
                <th className="text-right py-2 font-medium">Margin</th>
                <th className="text-right py-2 font-medium">Orders</th>
                <th className="text-right py-2 font-medium">Issues</th>
              </tr>
            </thead>
            <tbody>
              {locations?.map((loc) => (
                <tr key={loc.id} className="border-b">
                  <td className="py-2 font-medium">{loc.name}</td>
                  <td className="text-right py-2">${loc.revenue.toLocaleString()}</td>
                  <td className="text-right py-2">{loc.margin}%</td>
                  <td className="text-right py-2">{loc.orders}</td>
                  <td className="text-right py-2">
                    {loc.issues === 0 ? (
                      <span className="text-green-500">0</span>
                    ) : loc.issues === 1 ? (
                      <span className="text-yellow-500">{loc.issues} 🟡</span>
                    ) : (
                      <span className="text-red-500">{loc.issues} 🔴</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// Executive Summary for Hood+ tiers
function ExecutiveSummary() {
  const { tenant } = useTenantAdminAuth();
  
  const { data: summary } = useQuery({
    queryKey: ['hotbox-executive', tenant?.id],
    queryFn: async () => {
      // TODO: Replace with actual data fetching
      return {
        mtdRevenue: 287000,
        revenueChange: 14,
        projectedClose: 340000,
        netProfit: 68000,
        profitMargin: 23.7,
        cashPosition: 124000,
      };
    },
    enabled: !!tenant?.id,
  });
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">📈</span> EXECUTIVE SUMMARY
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">MTD Revenue</div>
            <div className="text-xl font-bold">${(summary?.mtdRevenue || 0).toLocaleString()}</div>
            {summary?.revenueChange && (
              <div className={cn(
                'text-xs',
                summary.revenueChange > 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {summary.revenueChange > 0 ? '↑' : '↓'} {Math.abs(summary.revenueChange)}% vs last month
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Projected Close</div>
            <div className="text-xl font-bold">${(summary?.projectedClose || 0).toLocaleString()}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Net Profit</div>
            <div className="text-xl font-bold">${(summary?.netProfit || 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{summary?.profitMargin}% margin</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Cash Position</div>
            <div className="text-xl font-bold">${(summary?.cashPosition || 0).toLocaleString()}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Street Tier Tips - Help new users get started
function StreetTierTips() {
  const [dismissedTips, setDismissedTips] = useState<string[]>([]);
  
  const tips = [
    {
      id: 'add-products',
      emoji: '📦',
      title: 'Add your first products',
      description: 'Start by adding your inventory to the system',
      action: '/admin/products/new',
      actionLabel: 'Add Product',
    },
    {
      id: 'setup-menu',
      emoji: '📋',
      title: 'Create a Disposable Menu',
      description: 'Share product links with customers securely',
      action: '/admin/disposable-menus',
      actionLabel: 'Create Menu',
    },
    {
      id: 'first-sale',
      emoji: '💰',
      title: 'Make your first sale',
      description: 'Use the POS system for walk-in customers',
      action: '/admin/pos',
      actionLabel: 'Open POS',
    },
  ];
  
  const visibleTips = tips.filter(t => !dismissedTips.includes(t.id));
  
  if (visibleTips.length === 0) return null;
  
  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">💡</span> GETTING STARTED
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleTips.map((tip) => (
          <div
            key={tip.id}
            className="flex items-center justify-between p-3 bg-background rounded-lg border"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{tip.emoji}</span>
              <div>
                <div className="font-medium">{tip.title}</div>
                <div className="text-sm text-muted-foreground">{tip.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={tip.action}>{tip.actionLabel}</Link>
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setDismissedTips([...dismissedTips, tip.id])}
              >
                ✕
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Team Today for Trap tier
function TeamToday() {
  const { tenant } = useTenantAdminAuth();
  
  const { data: team } = useQuery({
    queryKey: ['hotbox-team', tenant?.id],
    queryFn: async () => {
      // TODO: Replace with actual team data
      return [
        { id: '1', name: 'Alex', role: 'Driver', status: 'active', deliveries: 5, avatar: '👤' },
        { id: '2', name: 'Jordan', role: 'Sales', status: 'active', sales: 12, avatar: '👤' },
        { id: '3', name: 'Sam', role: 'Driver', status: 'break', deliveries: 3, avatar: '👤' },
      ];
    },
    enabled: !!tenant?.id,
  });
  
  if (!team || team.length === 0) return null;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">👥</span> TEAM TODAY
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {team.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{member.avatar}</span>
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-sm text-muted-foreground">{member.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                  {member.status === 'active' ? '🟢 Active' : '🟡 Break'}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {member.deliveries !== undefined && `${member.deliveries} deliveries`}
                  {member.sales !== undefined && `${member.sales} sales`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Strategic Decisions for Empire tier
function StrategicDecisions() {
  const navigate = useNavigate();
  
  const decisions = [
    {
      id: 'new-market',
      emoji: '🗺️',
      title: 'New Market Analysis',
      description: 'Expansion opportunity in Northern region',
      priority: 'high' as const,
      action: '/admin/analytics/market',
    },
    {
      id: 'rfp',
      emoji: '📄',
      title: 'Enterprise RFP',
      description: 'City hospital network - $2.4M contract',
      priority: 'critical' as const,
      action: '/admin/wholesale/opportunities',
    },
    {
      id: 'q4-budget',
      emoji: '📊',
      title: 'Q4 Budget Review',
      description: 'Due in 5 days',
      priority: 'medium' as const,
      action: '/admin/financial-center/budget',
    },
  ];
  
  return (
    <Card className="border-yellow-500/50 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">🎯</span> STRATEGIC DECISIONS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {decisions.map((decision) => (
          <div
            key={decision.id}
            className="flex items-center justify-between p-3 bg-background rounded-lg border cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(decision.action)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{decision.emoji}</span>
              <div>
                <div className="font-medium">{decision.title}</div>
                <div className="text-sm text-muted-foreground">{decision.description}</div>
              </div>
            </div>
            <Badge 
              variant={
                decision.priority === 'critical' ? 'destructive' : 
                decision.priority === 'high' ? 'default' : 'secondary'
              }
            >
              {decision.priority}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Weekly Progress for all tiers except Street
function WeeklyProgress() {
  const { tenant } = useTenantAdminAuth();
  
  const { data: progress } = useQuery({
    queryKey: ['hotbox-weekly', tenant?.id],
    queryFn: async () => {
      // TODO: Replace with actual progress data
      return {
        revenueGoal: 25000,
        revenueCurrent: 18500,
        ordersGoal: 150,
        ordersCurrent: 98,
        customersGoal: 50,
        customersCurrent: 34,
      };
    },
    enabled: !!tenant?.id,
  });
  
  if (!progress) return null;
  
  const metrics = [
    { 
      label: 'Weekly Revenue', 
      current: progress.revenueCurrent, 
      goal: progress.revenueGoal,
      format: (v: number) => `$${v.toLocaleString()}`,
    },
    { 
      label: 'Orders', 
      current: progress.ordersCurrent, 
      goal: progress.ordersGoal,
      format: (v: number) => v.toString(),
    },
    { 
      label: 'New Customers', 
      current: progress.customersCurrent, 
      goal: progress.customersGoal,
      format: (v: number) => v.toString(),
    },
  ];
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">📊</span> WEEKLY PROGRESS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric) => {
          const percent = Math.round((metric.current / metric.goal) * 100);
          return (
            <div key={metric.label} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{metric.label}</span>
                <span className="text-muted-foreground">
                  {metric.format(metric.current)} / {metric.format(metric.goal)}
                </span>
              </div>
              <Progress value={percent} className="h-2" />
              <div className="text-xs text-muted-foreground text-right">
                {percent}% of goal
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
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

