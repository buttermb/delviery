import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Shield, AlertTriangle } from 'lucide-react';
import { useDisposableMenus, useMenuSecurityEvents } from '@/hooks/useDisposableMenus';
import { MenuCard } from '@/components/admin/disposable-menus/MenuCard';
import { CreateMenuDialog } from '@/components/admin/disposable-menus/CreateMenuDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DisposableMenus = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const { data: menus, isLoading, refetch } = useDisposableMenus();
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Disposable Encrypted Menus
          </h1>
          <p className="text-muted-foreground mt-1">
            OPSEC-focused menu system with instant burn capability
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Create New Menu
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Active Menus</div>
          <div className="text-3xl font-bold mt-2">{activeMenus.length}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Total Views</div>
          <div className="text-3xl font-bold mt-2">{totalViews}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Orders Today</div>
          <div className="text-3xl font-bold mt-2">{todayOrders}</div>
        </Card>
      </div>

      {/* Security Alerts */}
      {recentAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">Recent Security Alerts</div>
            <ul className="space-y-1 text-sm">
              {recentAlerts.map(alert => (
                <li key={alert.id}>
                  • {alert.event_type.replace(/_/g, ' ')} - {alert.menu?.name}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Active Menus */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Active Menus</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMenus.map(menu => (
              <MenuCard key={menu.id} menu={menu} />
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

      {/* Create Menu Dialog */}
      <CreateMenuDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
    </div>
  );
};

export default DisposableMenus;
