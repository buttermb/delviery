import { useState, useMemo, Suspense, lazy } from 'react';
import { Plus, Search, Settings, LayoutGrid, ShoppingBag, Eye, Users, DollarSign, RefreshCw, Filter, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MenuCreationWizard } from './MenuCreationWizard';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useDisposableMenus, useMenuOrders } from '@/hooks/useDisposableMenus';
import { MenuCard } from './MenuCard';
import { PanicModeButton } from './PanicModeButton';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';

// Lazy load heavy components
const SecurityAlertsPanel = lazy(() => import('./SecurityAlertsPanel').then(m => ({ default: m.SecurityAlertsPanel })));
const AutomatedSecuritySettings = lazy(() => import('./AutomatedSecuritySettings').then(m => ({ default: m.AutomatedSecuritySettings })));
const NotificationSettings = lazy(() => import('./NotificationSettings').then(m => ({ default: m.NotificationSettings })));
const CustomerMessaging = lazy(() => import('./CustomerMessaging').then(m => ({ default: m.CustomerMessaging })));

// Inline Order Kanban component for the Orders tab
function OrdersTab() {
  const { data: orders = [], isLoading, refetch } = useMenuOrders();

  const ordersByStatus = useMemo(() => ({
    pending: orders.filter((o: any) => o.status === 'pending'),
    confirmed: orders.filter((o: any) => o.status === 'confirmed'),
    completed: orders.filter((o: any) => o.status === 'completed' || o.status === 'delivered'),
  }), [orders]);

  const stats = useMemo(() => ({
    total: orders.length,
    pending: ordersByStatus.pending.length,
    revenue: orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0),
  }), [orders, ordersByStatus]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Orders</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Revenue</div>
          <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.revenue)}</div>
        </Card>
        <Card className="p-4 flex items-center justify-center">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </Card>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pending Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-yellow-600 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              Pending ({ordersByStatus.pending.length})
            </h3>
          </div>
          <div className="space-y-2 min-h-[200px] p-2 bg-muted/30 rounded-lg">
            {ordersByStatus.pending.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No pending orders
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
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-600 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Confirmed ({ordersByStatus.confirmed.length})
            </h3>
          </div>
          <div className="space-y-2 min-h-[200px] p-2 bg-muted/30 rounded-lg">
            {ordersByStatus.confirmed.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No confirmed orders
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
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-emerald-600 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              Completed ({ordersByStatus.completed.length})
            </h3>
          </div>
          <div className="space-y-2 min-h-[200px] p-2 bg-muted/30 rounded-lg">
            {ordersByStatus.completed.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No completed orders
              </div>
            ) : (
              ordersByStatus.completed.slice(0, 5).map((order: any) => (
                <OrderCard key={order.id} order={order} />
              ))
            )}
            {ordersByStatus.completed.length > 5 && (
              <Button variant="ghost" size="sm" className="w-full">
                View all {ordersByStatus.completed.length} completed
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: any }) {
  const customerName = order.whitelist?.customer_name || order.contact_phone || 'Unknown';
  const menuName = order.menu?.name || 'Menu';
  const total = Number(order.total_amount || 0);

  return (
    <Card className="p-3 cursor-pointer hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{customerName}</div>
          <div className="text-xs text-muted-foreground truncate">{menuName}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold text-emerald-600">{formatCurrency(total)}</div>
          <div className="text-xs text-muted-foreground">
            {order.items?.length || 0} items
          </div>
        </div>
      </div>
    </Card>
  );
}

// Setup Tab with collapsible sections
function SetupTab() {
  const [openSection, setOpenSection] = useState<string | null>('security');

  const sections = [
    { id: 'security', label: 'Security Rules', component: AutomatedSecuritySettings },
    { id: 'notifications', label: 'Notifications', component: NotificationSettings },
    { id: 'messaging', label: 'Customer Messaging', component: CustomerMessaging },
    { id: 'alerts', label: 'Security Alerts', component: SecurityAlertsPanel },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.id} className="overflow-hidden">
          <button
            onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium">{section.label}</span>
            <span className={cn(
              "transition-transform",
              openSection === section.id && "rotate-180"
            )}>
              ▼
            </span>
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
    const totalViews = menus.reduce((sum: number, m: any) => sum + (m.view_count || 0), 0);
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
    const pendingOrders = orders.filter((o: any) => o.status === 'pending').length;

    return { activeMenus: activeMenus.length, totalViews, totalOrders, totalRevenue, pendingOrders };
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

  return (
    <div className="min-h-screen bg-background">
      {/* Compact Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Title & Stats */}
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-xl font-bold">Disposable Menus</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Secure, time-limited menus for your clients
                </p>
              </div>

              {/* Quick Stats - Hidden on mobile */}
              <div className="hidden md:flex items-center gap-4 pl-4 border-l">
                <div className="text-center">
                  <div className="text-lg font-bold">{stats.activeMenus}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{stats.totalViews}</div>
                  <div className="text-xs text-muted-foreground">Views</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600">{formatCurrency(stats.totalRevenue)}</div>
                  <div className="text-xs text-muted-foreground">Revenue</div>
                </div>
                {stats.pendingOrders > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    {stats.pendingOrders} pending
                  </Badge>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <PanicModeButton />
              
              {/* Desktop Create Button */}
              <Button
                onClick={() => setWizardOpen(true)}
                className="hidden sm:flex bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Menu
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="menus" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Menus</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2 relative">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
              {stats.pendingOrders > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                  {stats.pendingOrders}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Setup</span>
            </TabsTrigger>
          </TabsList>

          {/* Menus Tab */}
          <TabsContent value="menus" className="space-y-4 mt-0">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search menus..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      {statusFilter === 'all' ? 'All' : statusFilter === 'active' ? 'Active' : 'Burned'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setStatusFilter('all')}>All Menus</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('active')}>Active Only</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('burned')}>Burned Only</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
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
              <Card className="p-12 text-center">
                <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery || statusFilter !== 'all' ? 'No menus found' : 'No menus yet'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'Create your first disposable menu to get started'}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <Button onClick={() => setWizardOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Menu
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
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg sm:hidden bg-gradient-to-r from-violet-600 to-indigo-600"
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
