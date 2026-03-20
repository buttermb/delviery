import { logger } from '@/lib/logger';
import { useState, useMemo, Suspense, lazy, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Settings, LayoutGrid, ShoppingBag, Users,
  RefreshCw, Filter, TrendingUp, Flame, Shield, ChevronRight,
  AlertCircle, BarChart3,
  Download, Link, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import { OrdersTab } from './OrdersTab';
import { RealtimeViewerBadge } from './RealtimeViewerBadge';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useDisposableMenus, useMenuOrders } from '@/hooks/useDisposableMenus';
import { MenuCard } from './MenuCard';
import { PanicModeButton } from './PanicModeButton';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatters';
import { ResponsiveGrid } from '@/components/shared/ResponsiveGrid';
import { SearchInput } from '@/components/shared/SearchInput';
import { exportAnalyticsCsv } from '@/utils/analyticsExport';
import type { MenuAnalytics } from '@/utils/analyticsExport';
import type { OrderData } from './OrdersTab';

// Re-export types for backwards compatibility
export type { MenuAnalytics, TopProduct, BurnReasonEntry, ViewsByHourEntry } from '@/utils/analyticsExport';

// Lazy load heavy components
const SecurityAlertsPanel = lazy(() => import('./SecurityAlertsPanel').then(m => ({ default: m.SecurityAlertsPanel })));
const AutomatedSecuritySettings = lazy(() => import('./AutomatedSecuritySettings').then(m => ({ default: m.AutomatedSecuritySettings })));
const NotificationSettings = lazy(() => import('./NotificationSettings').then(m => ({ default: m.NotificationSettings })));
const CustomerMessaging = lazy(() => import('./CustomerMessaging').then(m => ({ default: m.CustomerMessaging })));
const EncryptionMigrationTool = lazy(() => import('./EncryptionMigrationTool').then(m => ({ default: m.EncryptionMigrationTool })));
const MenuAnalyticsDashboard = lazy(() => import('./MenuAnalyticsDashboard').then(m => ({ default: m.MenuAnalyticsDashboard })));

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
    const allMenus = menus as MenuData[];
    const activeMenus = allMenus.filter((m) => m.status === 'active');
    const burnedMenus = allMenus.filter((m) => m.status === 'soft_burned' || m.status === 'hard_burned');
    const totalViews = allMenus.reduce((sum: number, m) => sum + (m.view_count ?? 0), 0);
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
    return (menus as MenuData[]).filter((menu) => {
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
    totalViews: stats.totalViews as number,
    totalOrders: stats.totalOrders,
    conversionRate: parseFloat(stats.conversionRate as string),
    avgViewsPerMenu: menus.length > 0 ? (stats.totalViews as number) / menus.length : 0,
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
    const allMenus = menus as MenuData[];
    return allMenus.reduce((top: MenuData, current: MenuData) => {
      const currentRevenue = Number(current.total_revenue || 0);
      const topRevenue = Number(top?.total_revenue || 0);
      return currentRevenue > topRevenue ? current : top;
    }, allMenus[0]) as MenuData;
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
              <RealtimeViewerBadge tenantId={tenant?.id} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                title="Export analytics to CSV"
                aria-label="Export analytics to CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
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

      {/* Panic Mode - Fixed position, always visible */}
      <div className="fixed bottom-20 left-4 z-50 sm:bottom-6 sm:right-6 sm:left-auto">
        <PanicModeButton />
      </div>

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


