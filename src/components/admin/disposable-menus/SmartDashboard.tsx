import { useState, useMemo, Suspense, lazy } from 'react';
import { 
  Plus, Search, Settings, LayoutGrid, ShoppingBag, Eye, Users, DollarSign, 
  RefreshCw, Filter, TrendingUp, Flame, Clock, Shield, ChevronRight,
  Zap, Target, AlertCircle, CheckCircle, BarChart3, Copy, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MenuCreationWizard } from './MenuCreationWizard';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useDisposableMenus, useMenuOrders } from '@/hooks/useDisposableMenus';
import { MenuCard } from './MenuCard';
import { PanicModeButton } from './PanicModeButton';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { format, formatDistanceToNow } from 'date-fns';
import { showSuccessToast } from '@/utils/toastHelpers';

// Lazy load heavy components
const SecurityAlertsPanel = lazy(() => import('./SecurityAlertsPanel').then(m => ({ default: m.SecurityAlertsPanel })));
const AutomatedSecuritySettings = lazy(() => import('./AutomatedSecuritySettings').then(m => ({ default: m.AutomatedSecuritySettings })));
const NotificationSettings = lazy(() => import('./NotificationSettings').then(m => ({ default: m.NotificationSettings })));
const CustomerMessaging = lazy(() => import('./CustomerMessaging').then(m => ({ default: m.CustomerMessaging })));

// Enhanced Order Card with more details
function OrderCard({ order, onStatusChange }: { order: any; onStatusChange?: (id: string, status: string) => void }) {
  const customerName = order.whitelist?.customer_name || order.contact_phone || 'Unknown';
  const menuName = order.menu?.name || 'Menu';
  const total = Number(order.total_amount || 0);
  const itemCount = order.items?.length || 0;
  const createdAt = order.created_at ? new Date(order.created_at) : new Date();

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500',
    confirmed: 'bg-blue-500',
    completed: 'bg-emerald-500',
    delivered: 'bg-emerald-500',
    rejected: 'bg-red-500',
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
            statusColors[order.status] || 'bg-gray-400'
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
          <div className="font-bold text-emerald-600">{formatCurrency(total)}</div>
        </div>

        {/* Quick Actions */}
        {order.status === 'pending' && onStatusChange && (
          <div className="flex gap-2 pt-2 border-t">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(order.id, 'confirmed');
              }}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Confirm
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-8 text-xs text-red-600 hover:text-red-700"
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
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const ordersByStatus = useMemo(() => ({
    pending: orders.filter((o: any) => o.status === 'pending'),
    confirmed: orders.filter((o: any) => o.status === 'confirmed'),
    completed: orders.filter((o: any) => o.status === 'completed' || o.status === 'delivered'),
    rejected: orders.filter((o: any) => o.status === 'rejected'),
  }), [orders]);

  const stats = useMemo(() => ({
    total: orders.length,
    pending: ordersByStatus.pending.length,
    revenue: orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0),
    avgOrder: orders.length > 0 
      ? orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0) / orders.length 
      : 0,
    todayOrders: orders.filter((o: any) => {
      const orderDate = new Date(o.created_at);
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
        <div className="grid grid-cols-3 gap-4">
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
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.total}</div>
              <div className="text-xs text-blue-600/70">Total Orders</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.pending}</div>
              <div className="text-xs text-amber-600/70">Pending</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(stats.revenue)}</div>
              <div className="text-xs text-emerald-600/70">Revenue</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Target className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{formatCurrency(stats.avgOrder)}</div>
              <div className="text-xs text-purple-600/70">Avg Order</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/30 dark:to-rose-900/20 border-rose-200 dark:border-rose-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">{stats.todayOrders}</div>
              <div className="text-xs text-rose-600/70">Today</div>
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
            <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending
              </h3>
              <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/30">
                {ordersByStatus.pending.length}
              </Badge>
            </div>
            <div className="space-y-3 min-h-[200px] p-3 bg-muted/30 rounded-lg border-2 border-dashed border-muted">
              {ordersByStatus.pending.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No pending orders</p>
                </div>
              ) : (
                ordersByStatus.pending.map((order: any) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </div>
          </div>

          {/* Confirmed Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <h3 className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Confirmed
              </h3>
              <Badge variant="outline" className="bg-blue-500/20 text-blue-700 border-blue-500/30">
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
                ordersByStatus.confirmed.map((order: any) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </div>
          </div>

          {/* Completed Column */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <h3 className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Completed
              </h3>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">
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
                  {ordersByStatus.completed.slice(0, 8).map((order: any) => (
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
                <p>No orders yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {orders.slice(0, 20).map((order: any) => (
                  <div key={order.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          order.status === 'pending' && 'bg-amber-500',
                          order.status === 'confirmed' && 'bg-blue-500',
                          (order.status === 'completed' || order.status === 'delivered') && 'bg-emerald-500',
                          order.status === 'rejected' && 'bg-red-500'
                        )} />
                        <div>
                          <div className="font-medium">
                            {order.whitelist?.customer_name || order.contact_phone || 'Unknown'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.menu?.name} • {order.items?.length || 0} items
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-emerald-600">
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
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Setup Tab with collapsible sections
function SetupTab() {
  const [openSection, setOpenSection] = useState<string | null>('security');

  const sections = [
    { id: 'security', label: 'Security Rules', icon: Shield, component: AutomatedSecuritySettings },
    { id: 'notifications', label: 'Notifications', icon: AlertCircle, component: NotificationSettings },
    { id: 'messaging', label: 'Customer Messaging', icon: Users, component: CustomerMessaging },
    { id: 'alerts', label: 'Security Alerts', icon: Flame, component: SecurityAlertsPanel },
  ];

  return (
    <div className="space-y-4">
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
    </div>
  );
}

export function SmartDashboard() {
  const { tenant } = useTenantAdminAuth();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('menus');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'burned'>('all');

  const { data: menus = [], isLoading, refetch } = useDisposableMenus(tenant?.id);
  const { data: orders = [] } = useMenuOrders();

  // Calculate quick stats
  const stats = useMemo(() => {
    const activeMenus = menus.filter((m: any) => m.status === 'active');
    const burnedMenus = menus.filter((m: any) => m.status === 'soft_burned' || m.status === 'hard_burned');
    const totalViews = menus.reduce((sum: number, m: any) => sum + (m.view_count || 0), 0);
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
    const pendingOrders = orders.filter((o: any) => o.status === 'pending').length;
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
    return menus.filter((menu: any) => {
      const matchesSearch = !searchQuery || 
        menu.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && menu.status === 'active') ||
        (statusFilter === 'burned' && (menu.status === 'soft_burned' || menu.status === 'hard_burned'));
      return matchesSearch && matchesStatus;
    });
  }, [menus, searchQuery, statusFilter]);

  // Top performing menu
  const topMenu = useMemo(() => {
    if (menus.length === 0) return null;
    return menus.reduce((top: any, current: any) => {
      const currentRevenue = current.total_revenue || 0;
      const topRevenue = top?.total_revenue || 0;
      return currentRevenue > topRevenue ? current : top;
    }, menus[0]);
  }, [menus]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
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
              <PanicModeButton />
              
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
          <TabsList className="grid w-full max-w-lg grid-cols-3 p-1 bg-muted/50">
            <TabsTrigger value="menus" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow">
              <LayoutGrid className="h-4 w-4" />
              <span>Menus</span>
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {stats.activeMenus}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 relative data-[state=active]:bg-background data-[state=active]:shadow">
              <ShoppingBag className="h-4 w-4" />
              <span>Orders</span>
              {stats.pendingOrders > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center animate-pulse">
                  {stats.pendingOrders}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow">
              <Settings className="h-4 w-4" />
              <span>Setup</span>
            </TabsTrigger>
          </TabsList>

          {/* Menus Tab */}
          <TabsContent value="menus" className="space-y-6 mt-0">
            {/* Top Performer Card */}
            {topMenu && (topMenu.total_revenue || 0) > 0 && (
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
                      {formatCurrency(topMenu.total_revenue || 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {topMenu.order_count || 0} orders • {topMenu.view_count || 0} views
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search menus..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background"
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
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            ) : filteredMenus.length === 0 ? (
              <Card className="p-12 text-center bg-gradient-to-b from-muted/30 to-muted/10">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                  <LayoutGrid className="h-8 w-8 text-violet-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  {searchQuery || statusFilter !== 'all' ? 'No menus found' : 'Create Your First Menu'}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'Disposable menus are secure, time-limited catalogs that you can share with clients. They auto-destruct after use.'}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <Button 
                    onClick={() => setWizardOpen(true)}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Menu
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMenus.map((menu: any) => (
                  <MenuCard key={menu.id} menu={menu} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-0">
            <OrdersTab />
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
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl sm:hidden bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
        size="icon"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Menu Creation Wizard */}
      <MenuCreationWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

export default SmartDashboard;
