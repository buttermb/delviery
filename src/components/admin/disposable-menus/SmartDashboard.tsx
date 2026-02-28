import { logger } from '@/lib/logger';
import { useState, useMemo, Suspense, lazy, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Settings, LayoutGrid, ShoppingBag, Users, DollarSign,
  RefreshCw, Filter, TrendingUp, Flame, Clock, Shield, ChevronRight,
  Zap, Target, AlertCircle, CheckCircle, BarChart3,
  Download, Activity, Link, Loader2, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MenuCreationWizard } from './MenuCreationWizard';
import { GenerateMenuPageDialog } from './GenerateMenuPageDialog';
import { StaticMenuPagesList } from './StaticMenuPagesList';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useDisposableMenus, useMenuOrders, useUpdateOrderStatus } from '@/hooks/useDisposableMenus';
import { MenuCard } from './MenuCard';
import { PanicModeButton } from './PanicModeButton';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { format, formatDistanceToNow } from 'date-fns';
import { ResponsiveGrid } from '@/components/shared/ResponsiveGrid';
import { SearchInput } from '@/components/shared/SearchInput';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// Analytics Types (exported)
// ============================================

export interface MenuAnalytics {
  totalMenus: number;
  activeMenus: number;
  burnedMenus: number;
  totalViews: number;
  totalOrders: number;
  conversionRate: number;
  avgViewsPerMenu: number;
  avgTimeToFirstView: number;
  burnReasons: Record<string, number>;
  viewsByHour: Array<{ hour: number; views: number }>;
  topProducts: Array<{ id: string; name: string; orders: number; revenue: number }>;
}

export interface TopProduct {
  id: string;
  name: string;
  orders: number;
  revenue: number;
}

export interface BurnReasonEntry {
  name: string;
  value: number;
}

export interface ViewsByHourEntry {
  hour: number;
  views: number;
}

// ============================================
// CSV Export Utility
// ============================================

function exportAnalyticsCsv(analytics: MenuAnalytics, filename: string): void {
  const rows: string[][] = [
    ['Metric', 'Value'],
    ['Total Menus', String(analytics.totalMenus)],
    ['Active Menus', String(analytics.activeMenus)],
    ['Burned Menus', String(analytics.burnedMenus)],
    ['Total Views', String(analytics.totalViews)],
    ['Total Orders', String(analytics.totalOrders)],
    ['Conversion Rate', `${analytics.conversionRate.toFixed(2)}%`],
    ['Avg Views Per Menu', analytics.avgViewsPerMenu.toFixed(2)],
    ['Avg Time To First View (min)', analytics.avgTimeToFirstView.toFixed(2)],
    [],
    ['Burn Reason', 'Count'],
    ...Object.entries(analytics.burnReasons).map(([reason, count]) => [reason, String(count)]),
    [],
    ['Hour', 'Views'],
    ...analytics.viewsByHour.map((h) => [String(h.hour), String(h.views)]),
    [],
    ['Product', 'Orders', 'Revenue'],
    ...analytics.topProducts.map((p) => [p.name, String(p.orders), formatCurrency(p.revenue)]),
  ];

  const csvContent = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ============================================
// Real-time Viewer Count Hook
// ============================================

function useRealtimeViewerCount(tenantId: string | undefined): number {
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!tenantId) return;

    // Subscribe to menu_access_logs inserts for this tenant
    const channel = supabase
      .channel(`realtime-viewers-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'menu_access_logs',
        },
        () => {
          setViewerCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId]);

  return viewerCount;
}

// Lazy load heavy components
const SecurityAlertsPanel = lazy(() => import('./SecurityAlertsPanel').then(m => ({ default: m.SecurityAlertsPanel })));
const AutomatedSecuritySettings = lazy(() => import('./AutomatedSecuritySettings').then(m => ({ default: m.AutomatedSecuritySettings })));
const NotificationSettings = lazy(() => import('./NotificationSettings').then(m => ({ default: m.NotificationSettings })));
const CustomerMessaging = lazy(() => import('./CustomerMessaging').then(m => ({ default: m.CustomerMessaging })));
const EncryptionMigrationTool = lazy(() => import('./EncryptionMigrationTool').then(m => ({ default: m.EncryptionMigrationTool })));
const MenuAnalyticsDashboard = lazy(() => import('./MenuAnalyticsDashboard').then(m => ({ default: m.MenuAnalyticsDashboard })));

// Order type for this component
interface OrderData {
  id: string;
  status: string;
  total_amount?: number | string | null;
  contact_phone?: string | null;
  created_at?: string | null;
  order_data?: unknown;
  whitelist?: { customer_name?: string | null } | null;
  menu?: { name?: string | null } | null;
}

// Enhanced Order Card with more details
function OrderCard({ order, onStatusChange, isUpdating }: { order: OrderData; onStatusChange?: (id: string, status: string) => void; isUpdating?: boolean }) {
  const customerName = order.whitelist?.customer_name ?? order.contact_phone ?? 'Unknown';
  const menuName = order.menu?.name ?? 'Menu';
  const total = Number(order.total_amount || 0);
  const parsedData = order.order_data as Record<string, unknown> | null;
  const orderItems = (parsedData?.items as unknown[]) ?? [];
  const itemCount = Array.isArray(orderItems) ? orderItems.length : 0;
  const createdAt = order.created_at ? new Date(order.created_at) : new Date();

  const statusColors: Record<string, string> = {
    pending: 'bg-warning',
    confirmed: 'bg-info',
    completed: 'bg-success',
    delivered: 'bg-success',
    rejected: 'bg-destructive',
  };

  return (
    <Card className="p-4 cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50 group">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate group-hover:text-primary transition-colors">
              {customerName}
            </div>
            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <span>{menuName}</span>
              <span>•</span>
              <span>{formatDistanceToNow(createdAt, { addSuffix: true })}</span>
            </div>
          </div>
          <div className={cn(
            "w-2 h-2 rounded-full shrink-0 mt-2",
            statusColors[order.status] ?? 'bg-gray-400'
          )} />
        </div>

        {/* Details */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShoppingBag className="h-3.5 w-3.5" />
              {itemCount} items
            </span>
          </div>
          <div className="font-bold text-success">{formatCurrency(total)}</div>
        </div>

        {/* Quick Actions */}
        {order.status === 'pending' && onStatusChange && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              disabled={isUpdating}
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(order.id, 'confirmed');
              }}
            >
              {isUpdating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive hover:text-destructive"
              disabled={isUpdating}
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(order.id, 'rejected');
              }}
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// Enhanced Orders Tab with better Kanban
function OrdersTab() {
  const { data: orders = [], isLoading, refetch } = useMenuOrders();
  const updateOrderStatus = useUpdateOrderStatus();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [listLimit, setListLimit] = useState(20);

  const ordersByStatus = useMemo(() => ({
    pending: orders.filter((o: OrderData) => o.status === 'pending'),
    confirmed: orders.filter((o: OrderData) => o.status === 'confirmed'),
    completed: orders.filter((o: OrderData) => o.status === 'completed' || o.status === 'delivered'),
    rejected: orders.filter((o: OrderData) => o.status === 'rejected'),
  }), [orders]);

  const stats = useMemo(() => ({
    total: orders.length,
    pending: ordersByStatus.pending.length,
    revenue: orders.reduce((sum: number, o: OrderData) => sum + Number(o.total_amount || 0), 0),
    avgOrder: orders.length > 0
      ? orders.reduce((sum: number, o: OrderData) => sum + Number(o.total_amount || 0), 0) / orders.length
      : 0,
    todayOrders: orders.filter((o: OrderData) => {
      const orderDate = new Date(o.created_at ?? '');
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    }).length,
  }), [orders, ordersByStatus]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-to-br from-info/10 to-info/20 dark:from-info/10 dark:to-info/5 border-info/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-info/20 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-info" />
            </div>
            <div>
              <div className="text-2xl font-bold text-info">{stats.total}</div>
              <div className="text-xs text-info/70">Total Orders</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-warning/10 to-warning/20 dark:from-warning/10 dark:to-warning/5 border-warning/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <div className="text-2xl font-bold text-warning">{stats.pending}</div>
              <div className="text-xs text-warning/70">Pending</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-success/10 to-success/20 dark:from-success/10 dark:to-success/5 border-success/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold text-success">{formatCurrency(stats.revenue)}</div>
              <div className="text-xs text-success/70">Revenue</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/20 dark:from-primary/10 dark:to-primary/5 border-primary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{formatCurrency(stats.avgOrder)}</div>
              <div className="text-xs text-primary/70">Avg Order</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-destructive/10 to-destructive/20 dark:from-destructive/10 dark:to-destructive/5 border-destructive/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">{stats.todayOrders}</div>
              <div className="text-xs text-destructive/70">Today</div>
            </div>
          </div>
        </Card>
      </div>

      {/* View Toggle & Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            List
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Kanban Columns */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pending Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-warning/10 rounded-lg border border-warning/20">
              <h3 className="font-semibold text-warning flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending
              </h3>
              <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                {ordersByStatus.pending.length}
              </Badge>
            </div>
            <div className="space-y-3 min-h-[200px] p-3 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
              {ordersByStatus.pending.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No pending orders</p>
                  <p className="text-xs mt-1">Orders appear here when customers place new orders</p>
                </div>
              ) : (
                ordersByStatus.pending.map((order: OrderData) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    isUpdating={updateOrderStatus.isPending}
                    onStatusChange={(id, status) => {
                      updateOrderStatus.mutate({ orderId: id, status });
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Confirmed Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-info/10 rounded-lg border border-info/20">
              <h3 className="font-semibold text-info flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Confirmed
              </h3>
              <Badge variant="outline" className="bg-info/20 text-info border-info/30">
                {ordersByStatus.confirmed.length}
              </Badge>
            </div>
            <div className="space-y-3 min-h-[200px] p-3 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
              {ordersByStatus.confirmed.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No confirmed orders</p>
                </div>
              ) : (
                ordersByStatus.confirmed.map((order: OrderData) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </div>
          </div>

          {/* Completed Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20">
              <h3 className="font-semibold text-success flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Completed
              </h3>
              <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                {ordersByStatus.completed.length}
              </Badge>
            </div>
            <div className="space-y-3 min-h-[200px] max-h-[400px] overflow-y-auto p-3 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
              {ordersByStatus.completed.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No completed orders</p>
                </div>
              ) : (
                <>
                  {ordersByStatus.completed.slice(0, 8).map((order: OrderData) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                  {ordersByStatus.completed.length > 8 && (
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                      View all {ordersByStatus.completed.length} completed
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No orders yet</p>
                <p className="text-sm mt-1">Share your menus with clients to receive orders</p>
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {orders.slice(0, listLimit).map((order: OrderData) => (
                    <div key={order.id} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            order.status === 'pending' && 'bg-warning',
                            order.status === 'confirmed' && 'bg-info',
                            (order.status === 'completed' || order.status === 'delivered') && 'bg-success',
                            order.status === 'rejected' && 'bg-destructive'
                          )} />
                          <div>
                            <div className="font-medium">
                              {order.whitelist?.customer_name ?? order.contact_phone ?? 'Unknown'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {order.menu?.name} • {Array.isArray((order.order_data as Record<string, unknown> | null)?.items) ? ((order.order_data as Record<string, unknown>).items as unknown[]).length : 0} items
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-success">
                            {formatCurrency(Number(order.total_amount || 0))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.created_at && format(new Date(order.created_at), 'MMM d, h:mm a')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {orders.length > listLimit && (
                  <div className="p-4 border-t">
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => setListLimit(prev => prev + 20)}
                    >
                      Show more ({orders.length - listLimit} remaining)
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Setup Tab with collapsible sections
function SetupTab() {
  const { tenant } = useTenantAdminAuth();
  const [openSection, setOpenSection] = useState<string | null>('security');
  const [migrationOpen, setMigrationOpen] = useState(false);

  const sections = [
    { id: 'security', label: 'Security Rules', icon: Shield, component: AutomatedSecuritySettings },
    { id: 'notifications', label: 'Notifications', icon: AlertCircle, component: NotificationSettings },
    { id: 'messaging', label: 'Customer Messaging', icon: Users, component: CustomerMessaging },
    { id: 'alerts', label: 'Security Alerts', icon: Flame, component: SecurityAlertsPanel },
  ];

  return (
    <div className="space-y-4">
      {/* Migration Tool Card */}
      <Card className="overflow-hidden border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <RefreshCw className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <span className="font-medium">Menu Migration</span>
              <p className="text-xs text-muted-foreground">Encrypt unencrypted menus for security</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
            onClick={() => setMigrationOpen(true)}
          >
            Open Migration Tool
          </Button>
        </div>
      </Card>

      {sections.map((section) => (
        <Card key={section.id} className="overflow-hidden">
          <button
            onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <section.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">{section.label}</span>
            </div>
            <ChevronRight className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              openSection === section.id && "rotate-90"
            )} />
          </button>
          {openSection === section.id && (
            <div className="p-4 pt-0 border-t">
              <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                <section.component />
              </Suspense>
            </div>
          )}
        </Card>
      ))}

      {/* Migration Tool Dialog */}
      <Suspense fallback={null}>
        <EncryptionMigrationTool
          open={migrationOpen}
          onOpenChange={setMigrationOpen}
          tenantId={tenant?.id ?? ''}
        />
      </Suspense>
    </div>
  );
}

// Menu type for the SmartDashboard - uses index signature to accept any DB fields
interface MenuData {
  id: string;
  name?: string | null;
  status: string;
  view_count?: number | null;
  total_revenue?: number | null;
  order_count?: number | null;
  [key: string]: unknown;
}

// SmartDashboard Component
export function SmartDashboard() {
  const { tenant } = useTenantAdminAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('menus');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'burned'>('all');

  const { data: menus = [], isLoading, refetch } = useDisposableMenus(tenant?.id);
  const { data: orders = [] } = useMenuOrders(undefined, tenant?.id);
  const realtimeViewerCount = useRealtimeViewerCount(tenant?.id);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [generatePageOpen, setGeneratePageOpen] = useState(false);
  const [regenerateMenuName, setRegenerateMenuName] = useState<string | undefined>();

  // Auto-open wizard if query param present
  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setWizardOpen(true);
      // Optional: clear param so it doesn't reopen on refresh, 
      // but keeping it allows bookmarking "Create Menu" page.
    }
  }, [searchParams]);

  // Calculate quick stats
  const stats = useMemo(() => {
    const activeMenus = menus.filter((m: MenuData) => m.status === 'active');
    const burnedMenus = menus.filter((m: MenuData) => m.status === 'soft_burned' || m.status === 'hard_burned');
    const totalViews = menus.reduce((sum: number, m: MenuData) => sum + (m.view_count ?? 0), 0);
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum: number, o: OrderData) => sum + Number(o.total_amount || 0), 0);
    const pendingOrders = orders.filter((o: OrderData) => o.status === 'pending').length;
    const conversionRate = totalViews > 0 ? ((totalOrders / totalViews) * 100).toFixed(1) : '0';

    return {
      activeMenus: activeMenus.length,
      burnedMenus: burnedMenus.length,
      totalViews,
      totalOrders,
      totalRevenue,
      pendingOrders,
      conversionRate
    };
  }, [menus, orders]);

  // Filter menus
  const filteredMenus = useMemo(() => {
    return menus.filter((menu: MenuData) => {
      const matchesSearch = !searchQuery ||
        menu.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && menu.status === 'active') ||
        (statusFilter === 'burned' && (menu.status === 'soft_burned' || menu.status === 'hard_burned'));
      return matchesSearch && matchesStatus;
    });
  }, [menus, searchQuery, statusFilter]);

  // Build MenuAnalytics for CSV export
  const analyticsForExport = useMemo((): MenuAnalytics => ({
    totalMenus: menus.length,
    activeMenus: stats.activeMenus,
    burnedMenus: stats.burnedMenus,
    totalViews: stats.totalViews,
    totalOrders: stats.totalOrders,
    conversionRate: parseFloat(stats.conversionRate),
    avgViewsPerMenu: menus.length > 0 ? stats.totalViews / menus.length : 0,
    avgTimeToFirstView: 0,
    burnReasons: {},
    viewsByHour: [],
    topProducts: [],
  }), [menus, stats]);

  const handleExportCsv = useCallback(() => {
    exportAnalyticsCsv(
      analyticsForExport,
      `menu-analytics-${new Date().toISOString().split('T')[0]}`
    );
    logger.info('Analytics CSV exported', { component: 'SmartDashboard' });
  }, [analyticsForExport]);

  // Top performing menu
  const topMenu = useMemo(() => {
    if (menus.length === 0) return null;
    return menus.reduce((top: MenuData, current: MenuData) => {
      const currentRevenue = Number(current.total_revenue || 0);
      const topRevenue = Number(top?.total_revenue || 0);
      return currentRevenue > topRevenue ? current : top;
    }, menus[0] as MenuData);
  }, [menus]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/20">
      {/* Enhanced Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Title & Description */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  Disposable Menus
                </h1>
                <p className="text-sm text-muted-foreground">
                  Secure, time-limited catalogs for your clients
                </p>
              </div>
            </div>

            {/* Quick Stats - Desktop */}
            <div className="hidden lg:flex items-center gap-6 px-6 py-3 bg-muted/50 rounded-xl">
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-600">{stats.activeMenus}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <div className="text-xl font-bold">{stats.totalViews}</div>
                <div className="text-xs text-muted-foreground">Views</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalRevenue)}</div>
                <div className="text-xs text-muted-foreground">Revenue</div>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <div className="text-xl font-bold text-violet-600">{stats.conversionRate}%</div>
                <div className="text-xs text-muted-foreground">Conversion</div>
              </div>
              {stats.pendingOrders > 0 && (
                <>
                  <div className="w-px h-8 bg-border" />
                  <Badge variant="destructive" className="animate-pulse px-3 py-1">
                    {stats.pendingOrders} pending
                  </Badge>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {realtimeViewerCount > 0 && (
                <Badge variant="outline" className="animate-pulse border-green-500 text-green-600 gap-1">
                  <Activity className="h-3 w-3" />
                  {realtimeViewerCount} live
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                title="Export analytics to CSV"
                aria-label="Export analytics to CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
              <PanicModeButton />

              {/* Generate Menu Page Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGeneratePageOpen(true)}
                title="Generate a shareable static menu page"
                aria-label="Generate Menu Page"
              >
                <FileText className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Menu Page</span>
              </Button>

              {/* Desktop Create Button */}
              <Button
                onClick={() => setWizardOpen(true)}
                className="hidden sm:flex bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/30"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                New Menu
              </Button>
            </div>
          </div>

          {/* Mobile Stats */}
          <div className="lg:hidden grid grid-cols-4 gap-2 mt-4">
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold text-emerald-600">{stats.activeMenus}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold">{stats.totalViews}</div>
              <div className="text-xs text-muted-foreground">Views</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold text-emerald-600">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Revenue</div>
            </div>
            <div className="text-center p-2 bg-muted/50 rounded-lg">
              <div className="text-lg font-bold text-violet-600">{stats.conversionRate}%</div>
              <div className="text-xs text-muted-foreground">Conv.</div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="flex w-full overflow-x-auto max-w-2xl p-1 bg-muted/50">
            <TabsTrigger value="menus" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Menus</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {stats.activeMenus}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 relative data-[state=active]:bg-background data-[state=active]:shadow">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
              {stats.pendingOrders > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center animate-pulse">
                  {stats.pendingOrders}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="pages" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Pages</span>
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Setup</span>
            </TabsTrigger>
          </TabsList>

          {/* Menus Tab */}
          <TabsContent value="menus" className="space-y-6 mt-0">
            {/* Top Performer Card */}
            {topMenu && (topMenu.total_revenue ?? 0) > 0 && (
              <Card className="p-4 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-purple-500/10 border-violet-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Top Performer</div>
                      <div className="font-semibold">{topMenu.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(topMenu.total_revenue ?? 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {topMenu.order_count ?? 0} orders • {topMenu.view_count ?? 0} views
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <SearchInput
                  onSearch={setSearchQuery}
                  placeholder="Search menus..."
                  className="bg-background"
                  defaultValue={searchQuery}
                />
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="default" className="gap-2">
                      <Filter className="h-4 w-4" />
                      {statusFilter === 'all' ? 'All' : statusFilter === 'active' ? 'Active' : 'Burned'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                      All Menus ({menus.length})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('active')}>
                      Active Only ({stats.activeMenus})
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('burned')}>
                      Burned ({stats.burnedMenus})
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Menu Grid */}
            <ResponsiveGrid
              data={filteredMenus}
              isLoading={isLoading}
              keyExtractor={(menu: MenuData) => menu.id}
              renderItem={(menu: MenuData) => <MenuCard menu={menu as unknown as Parameters<typeof MenuCard>[0]['menu']} />}
              columns={{ default: 1, md: 2, lg: 3 }}
              emptyState={{
                icon: Link,
                title: searchQuery || statusFilter !== 'all' ? 'No menus found' : 'No menus yet',
                description: searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create a disposable menu to share with your customers',
                primaryAction: searchQuery || statusFilter !== 'all'
                  ? {
                      label: 'Clear Filters',
                      onClick: () => { setSearchQuery(''); setStatusFilter('all'); },
                    }
                  : {
                      label: 'Create Menu',
                      onClick: () => setWizardOpen(true),
                      icon: Plus,
                    },
                compact: true,
                designSystem: 'tenant-admin'
              }}
            />
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-0">
            <OrdersTab />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-0">
            <Suspense fallback={
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-80" />
                  ))}
                </div>
              </div>
            }>
              <MenuAnalyticsDashboard />
            </Suspense>
          </TabsContent>

          {/* Pages Tab */}
          <TabsContent value="pages" className="mt-0">
            <StaticMenuPagesList
              onRegenerate={(menuName) => {
                setRegenerateMenuName(menuName);
                setGeneratePageOpen(true);
              }}
            />
          </TabsContent>

          {/* Setup Tab */}
          <TabsContent value="setup" className="mt-0">
            <SetupTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Mobile FAB */}
      <Button
        onClick={() => setWizardOpen(true)}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-xl sm:hidden bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
        size="icon"
        aria-label="Add"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Menu Creation Wizard */}
      <MenuCreationWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      {/* Generate Menu Page Dialog */}
      <GenerateMenuPageDialog
        open={generatePageOpen}
        onOpenChange={(open) => {
          setGeneratePageOpen(open);
          if (!open) setRegenerateMenuName(undefined);
        }}
        preselectedMenuName={regenerateMenuName}
      />
    </div>
  );
}


