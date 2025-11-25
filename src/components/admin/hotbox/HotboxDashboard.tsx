/**
 * Hotbox Dashboard - Command Center
 * 
 * The main dashboard component that provides a morning briefing experience
 * instead of a feature maze. Adapts to the 5 business tiers.
 */

import { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useBusinessTier } from '@/hooks/useBusinessTier';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

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
  title: string;
  description?: string;
  value?: string;
  actionUrl: string;
  actionLabel: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

// Helper to get time-appropriate greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
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
};

export function HotboxDashboard() {
  const { tenant, admin } = useTenantAdminAuth();
  const { tier, preset, metrics, isLoading: tierLoading } = useBusinessTier();
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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

      // Build attention items
      const attentionItems: AttentionItem[] = [];

      if (pendingMenuOrders && pendingMenuOrders > 0) {
        attentionItems.push({
          id: 'menu-orders',
          priority: 'critical',
          title: `${pendingMenuOrders} Disposable Menu orders waiting`,
          value: `$${menuOrdersValue.toLocaleString()}`,
          actionUrl: '/admin/disposable-menu-orders',
          actionLabel: 'Process',
        });
      }

      if (pendingOrders && pendingOrders > 0) {
        attentionItems.push({
          id: 'pending-orders',
          priority: pendingOrders > 5 ? 'critical' : 'important',
          title: `${pendingOrders} orders waiting to be processed`,
          actionUrl: '/admin/orders?status=pending',
          actionLabel: 'View',
        });
      }

      if (lowStockCount && lowStockCount > 0) {
        attentionItems.push({
          id: 'low-stock',
          priority: 'important',
          title: `${lowStockCount} items low on stock`,
          description: 'Reorder to avoid running out',
          actionUrl: '/admin/inventory-dashboard',
          actionLabel: 'Reorder',
        });
      }

      // Add info items if nothing critical
      if (attentionItems.length === 0) {
        attentionItems.push({
          id: 'all-good',
          priority: 'info',
          title: 'All caught up!',
          description: 'No urgent items need your attention',
          actionUrl: '/admin/orders',
          actionLabel: 'View Orders',
        });
      }

      return { pulseMetrics, attentionItems };
    },
    enabled: !!tenant?.id,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute
  });

  // Build quick actions from tier preset
  const quickActions: QuickAction[] = preset.quickActions.map(action => ({
    id: action.id,
    label: action.label,
    icon: iconMap[action.icon] || <Package className="h-5 w-5" />,
    path: action.path,
  }));

  const isLoading = tierLoading || pulseLoading;

  if (isLoading) {
    return <HotboxSkeleton />;
  }

  const userName = admin?.firstName || admin?.email?.split('@')[0] || 'there';

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header - Greeting */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            {preset.emoji} {getGreeting()}, {userName}
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy • h:mm a')}
          </p>
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => navigate(action.path)}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tier-specific additional sections */}
      {(tier === 'block' || tier === 'hood' || tier === 'empire') && (
        <LocationOverview />
      )}

      {(tier === 'hood' || tier === 'empire') && (
        <ExecutiveSummary />
      )}
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
            <div className="text-xl font-bold">$287,000</div>
            <div className="text-xs text-green-600">↑ 14% vs last month</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Projected Close</div>
            <div className="text-xl font-bold">$340,000</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Net Profit</div>
            <div className="text-xl font-bold">$68,000</div>
            <div className="text-xs text-muted-foreground">23.7% margin</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Cash Position</div>
            <div className="text-xl font-bold">$124,000</div>
          </div>
        </div>
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

