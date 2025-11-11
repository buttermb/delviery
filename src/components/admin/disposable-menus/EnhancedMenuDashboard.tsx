/**
 * Enhanced OPSEC Menu Dashboard
 * Complete overview with alerts, burned menu history, and real-time stats
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Shield, AlertTriangle, Flame, TrendingUp, 
  Users, Eye, ShoppingCart, Clock, ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { MenuCard } from './MenuCard';
import { CreateMenuDialog } from './CreateMenuDialog';
import { BurnMenuDialog } from './BurnMenuDialog';
import { useDisposableMenus } from '@/hooks/useDisposableMenus';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

interface WhitelistEntry {
  id: string;
  [key: string]: unknown;
}

interface AccessLog {
  id: string;
  [key: string]: unknown;
}

interface MenuOrder {
  id: string;
  [key: string]: unknown;
}

interface SecurityAlert {
  id: string;
  event_type?: string;
  created_at: string;
  [key: string]: unknown;
}

interface Menu {
  id: string;
  name: string;
  encrypted_url_token: string;
  status: string;
  created_at: string;
  burned_at?: string;
  burn_reason?: string;
  regenerated_from?: string;
  min_order_quantity?: number;
  max_order_quantity?: number;
  expiration_date?: string;
  never_expires?: boolean;
  menu_access_whitelist?: WhitelistEntry[];
  menu_access_logs?: AccessLog[];
  menu_orders?: MenuOrder[];
}

export function EnhancedMenuDashboard() {
  const { tenant } = useTenantAdminAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedMenuForBurn, setSelectedMenuForBurn] = useState<Menu | null>(null);
  
  const { data: menus, isLoading } = useDisposableMenus(tenant?.id);

  // Calculate overview stats
  const { data: overviewStats } = useQuery({
    queryKey: ['menu-overview-stats'],
    queryFn: async () => {
      const activeMenus = menus?.filter((m: Menu) => m.status === 'active') || [];
      const burnedMenus = menus?.filter((m: Menu) => 
        m.status === 'soft_burned' || m.status === 'hard_burned'
      ) || [];

      // Total views (from access logs)
      let totalViews = 0;
      if (menus) {
        for (const menu of menus) {
          if (menu.menu_access_logs) {
            const { count } = await supabase
              .from('menu_access_logs')
              .select('*', { count: 'exact', head: true })
              .eq('menu_id', menu.id);
            totalViews += count || 0;
          }
        }
      }

      // Orders today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let todayOrders = 0;
      if (menus) {
        for (const menu of menus) {
          if (menu.menu_orders) {
            const { count } = await supabase
              .from('menu_orders')
              .select('*', { count: 'exact', head: true })
              .eq('menu_id', menu.id)
              .gte('created_at', today.toISOString());
            todayOrders += count || 0;
          }
        }
      }

      return {
        activeMenus: activeMenus.length,
        totalViews,
        todayOrders,
        burnedMenus: burnedMenus.length,
      };
    },
    enabled: !!menus,
  });

  // Recent security alerts
  const { data: recentAlerts } = useQuery({
    queryKey: ['menu-recent-alerts'],
    queryFn: async () => {
      const { data } = await supabase
        .from('menu_security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      return data || [];
    },
  });

  // Recent burned menus (last 30 days)
  const { data: recentBurnedMenus } = useQuery({
    queryKey: ['recent-burned-menus'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const burned = menus?.filter((m: Menu) => 
        (m.status === 'soft_burned' || m.status === 'hard_burned') &&
        m.burned_at &&
        new Date(m.burned_at) >= thirtyDaysAgo
      ) || [];

      return burned.slice(0, 10);
    },
    enabled: !!menus,
  });

  const activeMenus = menus?.filter((m: Menu) => m.status === 'active') || [];
  const siteUrl = window.location.origin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">🔐 Disposable Menus</h1>
          <p className="text-muted-foreground">
            Secure, encrypted, self-destructing catalogs with advanced access control
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Menu
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <Shield className="h-5 w-5 text-green-500" />
            <Badge variant="outline">Active</Badge>
          </div>
          <div className="text-3xl font-bold">{overviewStats?.activeMenus || 0}</div>
          <div className="text-sm text-muted-foreground">Active Menus</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <Eye className="h-5 w-5 text-blue-500" />
            <Badge variant="outline">Views</Badge>
          </div>
          <div className="text-3xl font-bold">{overviewStats?.totalViews.toLocaleString() || 0}</div>
          <div className="text-sm text-muted-foreground">Total Views</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="h-5 w-5 text-purple-500" />
            <Badge variant="outline">Today</Badge>
          </div>
          <div className="text-3xl font-bold">{overviewStats?.todayOrders || 0}</div>
          <div className="text-sm text-muted-foreground">Orders Today</div>
        </Card>
      </div>

      {/* Recent Alerts */}
      {recentAlerts && recentAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <strong>🚨 Recent Security Alerts:</strong>
              {recentAlerts.slice(0, 3).map((alert: SecurityAlert) => (
                <div key={alert.id} className="text-sm">
                  • {alert.event_type?.replace(/_/g, ' ')} - {format(new Date(alert.created_at), 'MMM d, h:mm a')}
                </div>
              ))}
              {recentAlerts.length > 3 && (
                <div className="text-xs text-muted-foreground">
                  +{recentAlerts.length - 3} more alerts
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Active Menus */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">🟢 Active Menus</h2>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading menus...</div>
        ) : activeMenus.length === 0 ? (
          <Card className="p-8 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">No active menus yet</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              Create Your First Menu
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeMenus.map((menu: Menu) => {
              const viewCount = menu.menu_access_logs?.length || 0;
              const orderCount = menu.menu_orders?.length || 0;
              const customerCount = menu.menu_access_whitelist?.length || 0;
              const menuUrl = `${siteUrl}/menu/${menu.encrypted_url_token}`;

              return (
                <Card key={menu.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{menu.name}</h3>
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          ACTIVE
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground mb-3">
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {format(new Date(menu.created_at), 'MMM d, yyyy')}
                        </div>
                        <div>
                          <span className="font-medium">Views:</span> {viewCount}
                        </div>
                        <div>
                          <span className="font-medium">Orders:</span> {orderCount}
                        </div>
                        <div>
                          <span className="font-medium">Customers:</span> {customerCount}
                        </div>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="font-medium">URL:</span>{' '}
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {siteUrl}/menu/{menu.encrypted_url_token}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-2 h-auto p-1"
                            onClick={() => navigator.clipboard.writeText(menuUrl)}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                        <div>
                          <span className="font-medium">Access:</span> Invite-only
                        </div>
                        {menu.expiration_date && !menu.never_expires && (
                          <div>
                            <span className="font-medium">Expires:</span>{' '}
                            {format(new Date(menu.expiration_date), 'MMM d, yyyy')}
                            {' '}
                            <Badge variant="outline" className="text-xs">
                              {Math.ceil((new Date(menu.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left
                            </Badge>
                          </div>
                        )}
                        {menu.never_expires && (
                          <div className="text-muted-foreground">
                            Expires: Never (Manual burn only)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm">
                      📋 View Menu
                    </Button>
                    <Button variant="outline" size="sm">
                      👥 Manage Access
                    </Button>
                    <Button variant="outline" size="sm">
                      📊 Analytics
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setSelectedMenuForBurn(menu)}
                    >
                      🔥 BURN
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Burned Menus History */}
      {recentBurnedMenus && recentBurnedMenus.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">🔴 Burned Menus (Last 30 days)</h2>
          <div className="space-y-2">
            {recentBurnedMenus.map((menu: Menu) => (
              <Card key={menu.id} className="p-4 bg-muted/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className="h-4 w-4 text-red-500" />
                      <span className="font-medium">{menu.name}</span>
                      <Badge variant="destructive" className="text-xs">
                        {menu.status === 'hard_burned' ? 'Hard Burned' : 'Soft Burned'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Burned: {menu.burned_at && format(new Date(menu.burned_at), 'MMM d, yyyy')}
                      {menu.burn_reason && ` • Reason: ${menu.burn_reason}`}
                    </div>
                    {menu.regenerated_from && (
                      <div className="text-sm text-green-600 mt-1">
                        ✅ Regenerated as new menu
                      </div>
                    )}
                  </div>
                  {menu.regenerated_from && (
                    <Button variant="outline" size="sm">
                      View New Menu
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateMenuDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      {selectedMenuForBurn && (
        <BurnMenuDialog
          menu={selectedMenuForBurn}
          open={!!selectedMenuForBurn}
          onOpenChange={(open) => !open && setSelectedMenuForBurn(null)}
        />
      )}
    </div>
  );
}

