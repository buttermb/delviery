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
import { TierUpgradeCard } from './TierUpgradeCard';

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

      {/* Tier Upgrade Progress */}
      <TierUpgradeCard />

      {/* Tier-specific sections */}
      
      {/* Street tier: Quick Tips */}
      {tier === 'street' && <StreetTierTips />}
      
      {/* Trap+ tiers: Team Today */}
      {(tier === 'trap' || tier === 'block' || tier === 'hood' || tier === 'empire') && <TeamToday />}
      
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

// Location Overview for Block+ tiers - Real data
function LocationOverview() {
  const { tenant } = useTenantAdminAuth();

  const { data: locations, isLoading } = useQuery({
    queryKey: ['hotbox-locations', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Try to fetch locations from locations table
      const { data: locs } = await supabase
        .from('locations')
        .select('id, name, address')
        .eq('tenant_id', tenant.id)
        .limit(10);
      
      // If no locations table or empty, create a default "Main" location
      const locationList = locs && locs.length > 0 
        ? locs 
        : [{ id: 'main', name: 'Main', address: null }];
      
      // For each location, calculate metrics
      const locationsWithMetrics = await Promise.all(
        locationList.map(async (loc) => {
          // Get today's orders and revenue
          const { data: orders } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('tenant_id', tenant.id)
            .gte('created_at', today.toISOString())
            .not('status', 'in', '("cancelled","rejected","refunded")');
          
          const todayRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
          const orderCount = orders?.length || 0;
          
          // Estimate margin (simplified 25%)
          const margin = todayRevenue > 0 ? 25 : 0;
          
          // Check for issues (out of stock products)
          const { count: outOfStock } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .lte('stock_quantity', 0)
            .eq('status', 'active');
          
          // Check for low stock
          const { count: lowStock } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .gt('stock_quantity', 0)
            .lt('stock_quantity', 10)
            .eq('status', 'active');
          
          const issues = (outOfStock || 0) + Math.floor((lowStock || 0) / 5);
          
          return {
            id: loc.id,
            name: loc.name,
            revenue: Math.round(todayRevenue / Math.max(1, locationList.length)), // Split evenly for now
            margin,
            orders: Math.round(orderCount / Math.max(1, locationList.length)),
            issues: Math.min(issues, 5), // Cap at 5 for display
          };
        })
      );
      
      return locationsWithMetrics;
    },
    enabled: !!tenant?.id,
    staleTime: 60 * 1000, // 1 minute
  });

  if (isLoading || !locations || locations.length === 0) return null;

  const totalRevenue = locations.reduce((sum, loc) => sum + loc.revenue, 0);
  const totalOrders = locations.reduce((sum, loc) => sum + loc.orders, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">📍</span> NETWORK OVERVIEW
          <Badge variant="outline" className="text-xs ml-auto">
            ${totalRevenue.toLocaleString()} • {totalOrders} orders
          </Badge>
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
              {locations.map((loc) => (
                <tr key={loc.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{loc.name}</td>
                  <td className="text-right py-2">${loc.revenue.toLocaleString()}</td>
                  <td className="text-right py-2">{loc.margin}%</td>
                  <td className="text-right py-2">{loc.orders}</td>
                  <td className="text-right py-2">
                    {loc.issues === 0 ? (
                      <span className="text-green-500">0 ✓</span>
                    ) : loc.issues <= 2 ? (
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

// Executive Summary for Hood+ tiers - Real data
function ExecutiveSummary() {
  const { tenant } = useTenantAdminAuth();
  
  const { data: summary, isLoading } = useQuery({
    queryKey: ['hotbox-executive', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      
      // MTD Revenue (orders + POS)
      const [ordersResult, posResult, lastMonthOrders] = await Promise.all([
        supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', monthStart.toISOString())
          .not('status', 'in', '("cancelled","rejected","refunded")'),
        
        supabase
          .from('pos_transactions')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', monthStart.toISOString())
          .eq('payment_status', 'paid'),
        
        supabase
          .from('orders')
          .select('total_amount')
          .eq('tenant_id', tenant.id)
          .gte('created_at', lastMonthStart.toISOString())
          .lte('created_at', lastMonthEnd.toISOString())
          .not('status', 'in', '("cancelled","rejected","refunded")'),
      ]);
      
      const ordersRevenue = ordersResult.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
      const posRevenue = posResult.data?.reduce((sum, t) => sum + Number(t.total_amount || 0), 0) || 0;
      const mtdRevenue = ordersRevenue + posRevenue;
      
      const lastMonthRevenue = lastMonthOrders.data?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
      
      // Calculate change percentage
      const revenueChange = lastMonthRevenue > 0 
        ? Math.round(((mtdRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : 0;
      
      // Project end of month (simple linear projection)
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysPassed = now.getDate();
      const projectedClose = daysPassed > 0 
        ? Math.round((mtdRevenue / daysPassed) * daysInMonth)
        : mtdRevenue;
      
      // Estimate profit (25% margin)
      const profitMargin = 25;
      const netProfit = Math.round(mtdRevenue * (profitMargin / 100));
      
      // Cash position - sum of customer payments received
      const { data: payments } = await supabase
        .from('wholesale_payments')
        .select('amount')
        .eq('tenant_id', tenant.id)
        .eq('status', 'completed')
        .gte('created_at', monthStart.toISOString());
      
      const cashInflows = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
      const cashPosition = Math.round(mtdRevenue * 0.4) + cashInflows; // Estimate: 40% of revenue + payments
      
      return {
        mtdRevenue,
        revenueChange,
        projectedClose,
        netProfit,
        profitMargin,
        cashPosition,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <span className="text-xl">📈</span> EXECUTIVE SUMMARY
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">📈</span> EXECUTIVE SUMMARY
          <Badge variant="outline" className="text-xs ml-auto">
            {format(new Date(), 'MMMM yyyy')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">MTD Revenue</div>
            <div className="text-xl font-bold">${(summary?.mtdRevenue || 0).toLocaleString()}</div>
            {summary?.revenueChange !== undefined && summary.revenueChange !== 0 && (
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
            <div className="text-xs text-muted-foreground">at current pace</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Est. Profit</div>
            <div className="text-xl font-bold">${(summary?.netProfit || 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">~{summary?.profitMargin}% margin</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Cash Position</div>
            <div className="text-xl font-bold">${(summary?.cashPosition || 0).toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">estimated</div>
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

// Team Today for Trap+ tiers - Real data
function TeamToday() {
  const { tenant } = useTenantAdminAuth();
  
  const { data: team, isLoading } = useQuery({
    queryKey: ['hotbox-team', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Fetch team members with their activity
      const { data: members, error } = await supabase
        .from('tenant_users')
        .select(`
          id,
          email,
          name,
          role,
          status,
          user_id
        `)
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .limit(10);
      
      if (error || !members) return [];
      
      // For each team member, get their activity for today
      const teamWithActivity = await Promise.all(
        members.map(async (member) => {
          // Get deliveries count for drivers
          const { count: deliveries } = await supabase
            .from('deliveries')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .eq('courier_id', member.user_id || member.id)
            .gte('created_at', today.toISOString());
          
          // Get orders processed (for sales roles)
          const { count: ordersProcessed } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .gte('created_at', today.toISOString());
          
          return {
            id: member.id,
            name: member.name || member.email?.split('@')[0] || 'Team Member',
            role: member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : 'Member',
            status: 'active' as const, // We already filtered for active
            deliveries: deliveries || 0,
            sales: Math.floor((ordersProcessed || 0) / Math.max(1, members.length)),
            avatar: '👤',
          };
        })
      );
      
      return teamWithActivity;
    },
    enabled: !!tenant?.id,
    staleTime: 60 * 1000, // 1 minute
  });
  
  if (isLoading || !team || team.length === 0) return null;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">👥</span> TEAM TODAY
          <Badge variant="outline" className="text-xs ml-auto">
            {team.length} active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {team.slice(0, 5).map((member) => (
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
                  {member.status === 'active' ? '🟢 Active' : '🟡 Away'}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {member.deliveries > 0 && `${member.deliveries} deliveries`}
                  {member.deliveries === 0 && member.sales > 0 && `${member.sales} orders`}
                </div>
              </div>
            </div>
          ))}
          {team.length > 5 && (
            <div className="text-center text-sm text-muted-foreground pt-2">
              +{team.length - 5} more team members
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Strategic Decisions for Empire tier
// Strategic Decisions for Empire tier - Real data based on business state
function StrategicDecisions() {
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  
  const { data: decisions, isLoading } = useQuery({
    queryKey: ['hotbox-strategic', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const items: Array<{
        id: string;
        emoji: string;
        title: string;
        description: string;
        priority: 'critical' | 'high' | 'medium';
        action: string;
      }> = [];
      
      // Check wholesale pipeline value
      const { data: wholesalePending } = await supabase
        .from('wholesale_orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .eq('status', 'pending');
      
      const wholesalePipelineValue = wholesalePending?.reduce(
        (sum, o) => sum + Number(o.total_amount || 0), 0
      ) || 0;
      
      if (wholesalePipelineValue > 10000) {
        items.push({
          id: 'wholesale-pipeline',
          emoji: '💼',
          title: 'High-Value Wholesale Pipeline',
          description: `$${wholesalePipelineValue.toLocaleString()} in pending approvals`,
          priority: wholesalePipelineValue > 50000 ? 'critical' : 'high',
          action: '/admin/wholesale-orders',
        });
      }
      
      // Check inventory investment
      const { data: products } = await supabase
        .from('products')
        .select('price, stock_quantity')
        .eq('tenant_id', tenant.id)
        .gt('stock_quantity', 0);
      
      const inventoryValue = products?.reduce(
        (sum, p) => sum + (Number(p.price || 0) * Number(p.stock_quantity || 0)), 0
      ) || 0;
      
      if (inventoryValue > 50000) {
        items.push({
          id: 'inventory-investment',
          emoji: '📦',
          title: 'Inventory Investment Review',
          description: `$${inventoryValue.toLocaleString()} tied up in inventory`,
          priority: inventoryValue > 100000 ? 'high' : 'medium',
          action: '/admin/inventory-dashboard',
        });
      }
      
      // Check customer AR
      const { data: customerTabs } = await supabase
        .from('customers')
        .select('balance')
        .eq('tenant_id', tenant.id)
        .gt('balance', 0);
      
      const arOutstanding = customerTabs?.reduce(
        (sum, c) => sum + Number(c.balance || 0), 0
      ) || 0;
      
      if (arOutstanding > 5000) {
        items.push({
          id: 'ar-collection',
          emoji: '💳',
          title: 'Accounts Receivable',
          description: `$${arOutstanding.toLocaleString()} outstanding from customers`,
          priority: arOutstanding > 20000 ? 'critical' : 'high',
          action: '/admin/customer-tabs',
        });
      }
      
      // Check team growth
      const { count: teamSize } = await supabase
        .from('tenant_users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('status', 'active');
      
      if ((teamSize || 0) >= 30) {
        items.push({
          id: 'team-expansion',
          emoji: '👥',
          title: 'Team Scaling Review',
          description: `${teamSize} team members - consider organizational structure`,
          priority: 'medium',
          action: '/admin/team',
        });
      }
      
      // Check month-end approaching
      const now = new Date();
      const daysUntilMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
      
      if (daysUntilMonthEnd <= 5) {
        items.push({
          id: 'month-close',
          emoji: '📅',
          title: 'Month-End Close',
          description: `${daysUntilMonthEnd} days until month-end`,
          priority: daysUntilMonthEnd <= 2 ? 'critical' : 'high',
          action: '/admin/financial-center',
        });
      }
      
      // Always add expansion opportunity if profitable
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: monthlyOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .gte('created_at', monthStart.toISOString())
        .not('status', 'in', '("cancelled","rejected","refunded")');
      
      const monthlyRevenue = monthlyOrders?.reduce(
        (sum, o) => sum + Number(o.total_amount || 0), 0
      ) || 0;
      
      if (monthlyRevenue > 200000) {
        items.push({
          id: 'expansion',
          emoji: '🗺️',
          title: 'Expansion Opportunity',
          description: 'Revenue supports new market entry',
          priority: 'medium',
          action: '/admin/analytics',
        });
      }
      
      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2 };
      items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      
      return items.slice(0, 4); // Max 4 items
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  if (isLoading || !decisions || decisions.length === 0) return null;
  
  return (
    <Card className="border-yellow-500/50 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <span className="text-xl">🎯</span> STRATEGIC DECISIONS
          <Badge variant="outline" className="text-xs ml-auto">
            {decisions.length} items
          </Badge>
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
// Weekly Progress - Real data
function WeeklyProgress() {
  const { tenant } = useTenantAdminAuth();
  
  const { data: progress, isLoading } = useQuery({
    queryKey: ['hotbox-weekly', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(weekStart);
      lastWeekEnd.setMilliseconds(-1);
      
      // This week's orders and revenue
      const { data: thisWeekOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .gte('created_at', weekStart.toISOString())
        .not('status', 'in', '("cancelled","rejected","refunded")');
      
      // Last week's orders (for goal comparison)
      const { data: lastWeekOrders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('tenant_id', tenant.id)
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', weekStart.toISOString())
        .not('status', 'in', '("cancelled","rejected","refunded")');
      
      // New customers this week
      const { count: newCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .gte('created_at', weekStart.toISOString());
      
      // Last week's new customers (for goal)
      const { count: lastWeekNewCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .gte('created_at', lastWeekStart.toISOString())
        .lt('created_at', weekStart.toISOString());
      
      const thisWeekRevenue = thisWeekOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
      const lastWeekRevenue = lastWeekOrders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
      
      // Goals = last week's numbers + 10% growth target
      const revenueGoal = Math.round(lastWeekRevenue * 1.1) || 5000;
      const ordersGoal = Math.round((lastWeekOrders?.length || 10) * 1.1);
      const customersGoal = Math.round((lastWeekNewCustomers || 5) * 1.1);
      
      return {
        revenueGoal: Math.max(revenueGoal, 1000), // Minimum goals
        revenueCurrent: thisWeekRevenue,
        ordersGoal: Math.max(ordersGoal, 10),
        ordersCurrent: thisWeekOrders?.length || 0,
        customersGoal: Math.max(customersGoal, 5),
        customersCurrent: newCustomers || 0,
      };
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  if (isLoading || !progress) return null;
  
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
          <Badge variant="outline" className="text-xs ml-auto">
            vs last week +10%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric) => {
          const percent = metric.goal > 0 ? Math.min(100, Math.round((metric.current / metric.goal) * 100)) : 0;
          const isAhead = percent >= 100;
          return (
            <div key={metric.label} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{metric.label}</span>
                <span className="text-muted-foreground">
                  {metric.format(metric.current)} / {metric.format(metric.goal)}
                </span>
              </div>
              <Progress 
                value={percent} 
                className={cn('h-2', isAhead && 'bg-green-200 [&>div]:bg-green-500')} 
              />
              <div className={cn(
                'text-xs text-right',
                isAhead ? 'text-green-600 font-medium' : 'text-muted-foreground'
              )}>
                {percent}% of goal {isAhead && '🎉'}
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

