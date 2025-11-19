import { useState } from 'react';
import { useTenantNavigate } from '@/hooks/useTenantNavigate';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Shield, AlertTriangle, Download, ShoppingBag, CheckSquare, Activity, Settings, Bell, MessageSquare } from 'lucide-react';
import { useDisposableMenus, useMenuSecurityEvents } from '@/hooks/useDisposableMenus';
import { MenuCard } from '@/components/admin/disposable-menus/MenuCard';
import { CreateMenuDialog } from '@/components/admin/disposable-menus/CreateMenuDialog';
import { MenuCreationWizard } from '@/components/admin/disposable-menus/MenuCreationWizard';
import { EnhancedMenuDashboard } from '@/components/admin/disposable-menus/EnhancedMenuDashboard';
import { PanicModeButton } from '@/components/admin/disposable-menus/PanicModeButton';
import { EncryptionMigrationTool } from '@/components/admin/disposable-menus/EncryptionMigrationTool';
import { SecurityAlertsPanel } from '@/components/admin/disposable-menus/SecurityAlertsPanel';
import { SecurityMonitoringPanel } from '@/components/admin/disposable-menus/SecurityMonitoringPanel';
import { AutomatedSecuritySettings } from '@/components/admin/disposable-menus/AutomatedSecuritySettings';
import { NotificationSettings } from '@/components/admin/disposable-menus/NotificationSettings';
import { CustomerMessaging } from '@/components/admin/disposable-menus/CustomerMessaging';
import { BulkActionsDialog } from '@/components/admin/disposable-menus/BulkActionsDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { TooltipGuide } from '@/components/shared/TooltipGuide';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { TakeTourButton } from '@/components/tutorial/TakeTourButton';
import { menusTutorial } from '@/lib/tutorials/tutorialConfig';

const DisposableMenus = () => {
  const navigate = useTenantNavigate();
  const { tenant } = useTenantAdminAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createWizardOpen, setCreateWizardOpen] = useState(false);
  const [bulkActionsOpen, setBulkActionsOpen] = useState(false);
  const [encryptionToolOpen, setEncryptionToolOpen] = useState(false);
  const [selectedMenuIds, setSelectedMenuIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const { data: menus, isLoading, refetch } = useDisposableMenus(tenant?.id);
  const { data: securityEvents } = useMenuSecurityEvents();

  const activeMenus = menus?.filter(m => m.status === 'active') || [];
  const burnedMenus = menus?.filter(m => m.status !== 'active') || [];
  
  // Recent unacknowledged security alerts
  const recentAlerts = securityEvents
    ?.filter(e => !e.acknowledged && e.severity === 'high' || e.severity === 'critical')
    .slice(0, 3) || [];

  // Calculate overview stats
  const totalViews = menus?.reduce((sum, menu) => {
    const viewCount = menu.menu_access_logs?.[0]?.count || 0;
    return sum + viewCount;
  }, 0) || 0;

  const todayOrders = menus?.reduce((sum, menu) => {
    const orders = menu.menu_orders?.filter((o: any) => {
      const orderDate = new Date(o.created_at);
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    }).length || 0;
    return sum + orders;
  }, 0) || 0;

  const toggleMenuSelection = (menuId: string) => {
    setSelectedMenuIds(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMenuIds.length === activeMenus.length) {
      setSelectedMenuIds([]);
    } else {
      setSelectedMenuIds(activeMenus.map(m => m.id));
    }
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Disposable Encrypted Menus</h1>
              {tenant && (
                <TooltipGuide
                  title="💡 What are disposable menus?"
                  content="Share product lists with customers via unique links. Customers can browse and order without creating accounts. Select products to share with specific customers."
                  placement="right"
                  tenantId={tenant.id}
                  tenantCreatedAt={(tenant as any)?.created_at}
                />
              )}
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm md:text-base">
              Create secure, self-destructing catalogs with advanced access control
            </p>
          </div>
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            {selectedMenuIds.length > 0 && (
              <Button 
                variant="secondary"
                onClick={() => setBulkActionsOpen(true)}
                className="min-h-[48px] touch-manipulation text-xs sm:text-sm flex-1 sm:flex-initial"
              >
                <CheckSquare className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Bulk Actions ({selectedMenuIds.length})</span>
                <span className="sm:hidden">Bulk ({selectedMenuIds.length})</span>
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => navigate('/admin/disposable-menu-orders')}
              className="min-h-[44px] touch-manipulation text-xs sm:text-sm flex-1 sm:flex-initial"
            >
              <ShoppingBag className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">View Orders</span>
              <span className="sm:hidden">Orders</span>
            </Button>
            <PanicModeButton />
            <Button 
              variant="outline"
              onClick={() => setEncryptionToolOpen(true)}
              className="min-h-[44px] touch-manipulation text-xs sm:text-sm flex-1 sm:flex-initial"
            >
              <Shield className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Encryption</span>
              <span className="sm:hidden">🔐</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('../help')}
              className="min-h-[44px] touch-manipulation text-xs sm:text-sm flex-1 sm:flex-initial"
            >
              <Shield className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Help & Guide</span>
              <span className="sm:hidden">Help</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => setCreateDialogOpen(true)}
              data-tutorial="create-menu-button"
              className="min-h-[44px] touch-manipulation text-xs sm:text-sm flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Quick Create</span>
              <span className="sm:hidden">Quick</span>
            </Button>
            <Button 
              onClick={() => setCreateWizardOpen(true)}
              className="min-h-[44px] touch-manipulation text-xs sm:text-sm flex-1 sm:flex-initial"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Create Menu (Wizard)</span>
              <span className="sm:hidden">Wizard</span>
            </Button>
            <TakeTourButton
              tutorialId={menusTutorial.id}
              steps={menusTutorial.steps}
              variant="outline"
              size="sm"
              className="min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        <Card className="p-3 sm:p-4 md:p-6">
          <div className="text-xs sm:text-sm text-muted-foreground">Active Menus</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{activeMenus.length}</div>
        </Card>
        <Card className="p-3 sm:p-4 md:p-6">
          <div className="text-xs sm:text-sm text-muted-foreground">Total Views</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{totalViews}</div>
        </Card>
        <Card className="p-3 sm:p-4 md:p-6 sm:col-span-2 md:col-span-1">
          <div className="text-xs sm:text-sm text-muted-foreground">Orders Today</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2">{todayOrders}</div>
        </Card>
      </div>

      {/* Recent Security Alerts */}
      {recentAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>⚠️ Security Alerts:</strong> {recentAlerts.length} high-priority security events detected.
            <Button variant="link" className="ml-2 p-0 h-auto text-destructive underline" onClick={() => {
              const tabs = document.querySelector('[role="tablist"]');
              const securityTab = tabs?.querySelector('[value="security"]') as HTMLElement;
              securityTab?.click();
            }}>
              View Details →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="menus" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto overflow-x-auto">
          <TabsTrigger value="menus" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">Menus</TabsTrigger>
          <TabsTrigger value="security" data-tutorial="security-settings" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">
            <span className="hidden sm:inline">Security</span>
            <span className="sm:hidden">Sec</span>
            {recentAlerts.length > 0 && (
              <span className="ml-1 sm:ml-2 bg-destructive text-destructive-foreground rounded-full px-1.5 sm:px-2 py-0.5 text-xs">
                {recentAlerts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Live Monitor</span>
            <span className="sm:hidden">Monitor</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">
            <Bell className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Notifications</span>
            <span className="sm:hidden">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="messaging" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">
            <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Messaging</span>
            <span className="sm:hidden">Msg</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="min-h-[44px] touch-manipulation text-xs sm:text-sm">
            <Settings className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Settings</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menus" className="space-y-6 mt-6">
          {/* Active Menus */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Active Menus</h2>
              {activeMenus.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedMenuIds.length === activeMenus.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    Select All
                  </span>
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-6">
                    <Skeleton className="h-6 w-3/4 mb-4" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </Card>
                ))}
              </div>
            ) : activeMenus.length === 0 ? (
              <Card className="p-12 text-center">
                <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No active menus</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create your first encrypted menu to get started
                </p>
                <Button onClick={() => setCreateDialogOpen(true)} className="mt-4">
                  Create Menu
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tutorial="menu-list">
                {activeMenus.map(menu => (
                  <div key={menu.id} className="relative" data-tutorial="menu-actions">
                    <div className="absolute top-4 left-4 z-10">
                      <Checkbox
                        checked={selectedMenuIds.includes(menu.id)}
                        onCheckedChange={() => toggleMenuSelection(menu.id)}
                        className="bg-background"
                      />
                    </div>
                    <MenuCard menu={menu} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Burned Menus History */}
          {burnedMenus.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Burned Menus (Last 30 Days)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {burnedMenus.slice(0, 6).map(menu => (
                  <MenuCard key={menu.id} menu={menu} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <SecurityAlertsPanel />
        </TabsContent>

        <TabsContent value="monitoring" className="mt-6">
          <SecurityMonitoringPanel />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="messaging" className="mt-6">
          <CustomerMessaging />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <AutomatedSecuritySettings />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateMenuDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />

      <MenuCreationWizard
        open={createWizardOpen}
        onOpenChange={setCreateWizardOpen}
      />

      <BulkActionsDialog
        open={bulkActionsOpen}
        onClose={() => {
          setBulkActionsOpen(false);
          setSelectedMenuIds([]);
        }}
        selectedMenuIds={selectedMenuIds}
        onComplete={() => {
          refetch();
          setSelectedMenuIds([]);
        }}
      />

      <EncryptionMigrationTool
        open={encryptionToolOpen}
        onOpenChange={setEncryptionToolOpen}
        tenantId={tenant?.id || ''}
      />
    </div>
  );
};

export default DisposableMenus;
