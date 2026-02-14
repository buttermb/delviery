import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  Clock,
  RefreshCw,
  ChevronRight,
  RotateCcw,
  Eye,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Calendar,
  Bell,
  CheckCircle,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  useExpiringSoonMenus,
  useArchivedMenus,
  useArchiveMenu,
  useReactivateMenu,
  useProcessExpiredMenus,
  useTimeUntilExpiration,
  type ExpiringMenu,
  type ArchivedMenu,
} from '@/hooks/useMenuExpiration';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { publish } from '@/lib/eventBus';
import { cn } from '@/lib/utils';

interface ExpiringMenuCardProps {
  menu: ExpiringMenu;
  onArchive: (menuId: string) => void;
  isArchiving: boolean;
}

const ExpiringMenuCard = ({ menu, onArchive, isArchiving }: ExpiringMenuCardProps) => {
  const timeUntil = useTimeUntilExpiration(menu.scheduled_deactivation_time);
  const navigate = useNavigate();
  const { tenant } = useTenantAdminAuth();

  const isUrgent = timeUntil && !timeUntil.expired && timeUntil.hours < 6;
  const isWarning = timeUntil && !timeUntil.expired && timeUntil.hours < 24;

  return (
    <Card className={cn(
      'transition-all duration-200 hover:shadow-md',
      isUrgent && 'border-red-500/50 bg-red-50/30 dark:bg-red-900/10',
      isWarning && !isUrgent && 'border-amber-500/50 bg-amber-50/30 dark:bg-amber-900/10'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold truncate">{menu.name}</h4>
              {isUrgent && (
                <Badge variant="destructive" className="shrink-0 animate-pulse">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Urgent
                </Badge>
              )}
              {isWarning && !isUrgent && (
                <Badge variant="outline" className="shrink-0 border-amber-500 text-amber-600">
                  <Clock className="h-3 w-3 mr-1" />
                  Soon
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {menu.view_count || 0} views
              </span>
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-3.5 w-3.5" />
                {menu.order_count || 0} orders
              </span>
            </div>

            {timeUntil && !timeUntil.expired && (
              <div className={cn(
                'mt-2 text-sm font-medium',
                isUrgent && 'text-red-600',
                isWarning && !isUrgent && 'text-amber-600',
                !isWarning && 'text-muted-foreground'
              )}>
                <Clock className="h-3.5 w-3.5 inline mr-1" />
                Expires in {timeUntil.label}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/${tenant?.slug}/admin/menus/${menu.id}`)}
            >
              View
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onArchive(menu.id)}
              disabled={isArchiving}
              className="text-muted-foreground hover:text-foreground"
            >
              {isArchiving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-1" />
                  Archive
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface ArchivedMenuCardProps {
  menu: ArchivedMenu;
  onReactivate: (menuId: string) => void;
  isReactivating: boolean;
}

const ArchivedMenuCard = ({ menu, onReactivate, isReactivating }: ArchivedMenuCardProps) => {
  const analytics = menu.analytics_snapshot;

  return (
    <Card className="transition-all duration-200 hover:shadow-md bg-muted/30">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold truncate">{menu.name}</h4>
              <Badge variant="secondary" className="shrink-0">
                <Archive className="h-3 w-3 mr-1" />
                Archived
              </Badge>
            </div>

            {/* Preserved Analytics */}
            {analytics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <div className="text-center p-2 bg-background rounded-md">
                  <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm font-semibold">{analytics.totalViews}</div>
                  <div className="text-xs text-muted-foreground">Views</div>
                </div>
                <div className="text-center p-2 bg-background rounded-md">
                  <ShoppingBag className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-sm font-semibold">{analytics.totalOrders}</div>
                  <div className="text-xs text-muted-foreground">Orders</div>
                </div>
                <div className="text-center p-2 bg-background rounded-md">
                  <DollarSign className="h-4 w-4 mx-auto mb-1 text-success" />
                  <div className="text-sm font-semibold text-success">
                    {formatCurrency(analytics.totalRevenue)}
                  </div>
                  <div className="text-xs text-muted-foreground">Revenue</div>
                </div>
                <div className="text-center p-2 bg-background rounded-md">
                  <TrendingUp className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <div className="text-sm font-semibold text-primary">
                    {analytics.conversionRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Conv.</div>
                </div>
              </div>
            )}

            <div className="mt-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 inline mr-1" />
              Archived {menu.archived_at ? new Date(menu.archived_at).toLocaleDateString() : 'N/A'}
              {menu.archived_reason && ` • ${menu.archived_reason}`}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onReactivate(menu.id)}
            disabled={isReactivating}
            className="shrink-0"
          >
            {isReactivating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reactivate
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export interface MenuExpirationManagerProps {
  showExpiringSoon?: boolean;
  showArchived?: boolean;
  maxItems?: number;
  compact?: boolean;
}

export const MenuExpirationManager = ({
  showExpiringSoon = true,
  showArchived = true,
  maxItems = 10,
  compact = false,
}: MenuExpirationManagerProps) => {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;

  const [activeTab, setActiveTab] = useState<'expiring' | 'archived'>('expiring');
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [reactivateConfirmId, setReactivateConfirmId] = useState<string | null>(null);

  // Fetch data
  const {
    data: expiringMenus = [],
    isLoading: loadingExpiring,
  } = useExpiringSoonMenus(tenantId, 48); // 48 hours ahead

  const {
    data: archivedMenus = [],
    isLoading: loadingArchived,
  } = useArchivedMenus(tenantId);

  // Mutations
  const archiveMenu = useArchiveMenu();
  const reactivateMenu = useReactivateMenu();
  const { processExpired } = useProcessExpiredMenus(tenantId);

  // Process expired menus on mount and periodically
  useEffect(() => {
    if (tenantId) {
      processExpired();

      // Check every 5 minutes
      const interval = setInterval(() => {
        processExpired();
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [tenantId, processExpired]);

  // Notify admin of expiring menus
  useEffect(() => {
    expiringMenus.forEach((menu) => {
      if (menu.scheduled_deactivation_time) {
        const now = new Date();
        const expiry = new Date(menu.scheduled_deactivation_time);
        const hoursRemaining = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));

        // Notify at 24h, 6h, 1h marks
        if (hoursRemaining === 24 || hoursRemaining === 6 || hoursRemaining === 1) {
          publish('menu_expiring_soon', {
            menuId: menu.id,
            menuName: menu.name,
            tenantId: menu.tenant_id,
            expiresAt: menu.scheduled_deactivation_time,
            hoursRemaining,
          });

          logger.info('Menu expiring soon notification sent', {
            menuId: menu.id,
            hoursRemaining,
            component: 'MenuExpirationManager',
          });
        }
      }
    });
  }, [expiringMenus]);

  const handleArchive = useCallback(async () => {
    if (!archiveConfirmId) return;

    try {
      const menu = expiringMenus.find((m) => m.id === archiveConfirmId);
      await archiveMenu.mutateAsync({ menuId: archiveConfirmId, reason: 'manual' });

      if (menu && tenantId) {
        publish('menu_archived', {
          menuId: archiveConfirmId,
          menuName: menu.name,
          tenantId,
          reason: 'manual',
          analyticsSnapshot: {
            totalViews: menu.view_count || 0,
            totalOrders: menu.order_count || 0,
            totalRevenue: menu.total_revenue || 0,
            conversionRate: (menu.view_count || 0) > 0
              ? ((menu.order_count || 0) / (menu.view_count || 1)) * 100
              : 0,
          },
          archivedAt: new Date().toISOString(),
        });
      }
    } finally {
      setArchiveConfirmId(null);
    }
  }, [archiveConfirmId, archiveMenu, expiringMenus, tenantId]);

  const handleReactivate = useCallback(async () => {
    if (!reactivateConfirmId) return;

    try {
      const menu = archivedMenus.find((m) => m.id === reactivateConfirmId);
      await reactivateMenu.mutateAsync({ menuId: reactivateConfirmId });

      if (menu && tenantId) {
        publish('menu_reactivated', {
          menuId: reactivateConfirmId,
          menuName: menu.name,
          tenantId,
          reactivatedAt: new Date().toISOString(),
        });
      }
    } finally {
      setReactivateConfirmId(null);
    }
  }, [reactivateConfirmId, reactivateMenu, archivedMenus, tenantId]);

  const displayExpiring = expiringMenus.slice(0, maxItems);
  const displayArchived = archivedMenus.slice(0, maxItems);

  if (compact) {
    // Compact mode: just show expiring count badge
    if (expiringMenus.length === 0) return null;

    return (
      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <Bell className="h-4 w-4 text-amber-600" />
        <span className="text-sm text-amber-700 dark:text-amber-400">
          {expiringMenus.length} menu{expiringMenus.length > 1 ? 's' : ''} expiring soon
        </span>
        <Button variant="link" size="sm" className="ml-auto p-0 h-auto text-amber-600">
          View
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Menu Lifecycle Manager
            </CardTitle>
            {expiringMenus.length > 0 && (
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                {expiringMenus.length} expiring soon
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'expiring' | 'archived')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              {showExpiringSoon && (
                <TabsTrigger value="expiring" className="relative">
                  <Clock className="h-4 w-4 mr-2" />
                  Expiring Soon
                  {expiringMenus.length > 0 && (
                    <span className="ml-2 h-5 w-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">
                      {expiringMenus.length}
                    </span>
                  )}
                </TabsTrigger>
              )}
              {showArchived && (
                <TabsTrigger value="archived">
                  <Archive className="h-4 w-4 mr-2" />
                  Archived
                  {archivedMenus.length > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({archivedMenus.length})
                    </span>
                  )}
                </TabsTrigger>
              )}
            </TabsList>

            {showExpiringSoon && (
              <TabsContent value="expiring" className="mt-0">
                <ScrollArea className="h-[400px] pr-4">
                  {loadingExpiring ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  ) : displayExpiring.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle className="h-12 w-12 text-success mb-3" />
                      <h4 className="font-medium">No Menus Expiring Soon</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        All your menus are safe for the next 48 hours.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayExpiring.map((menu) => (
                        <ExpiringMenuCard
                          key={menu.id}
                          menu={menu}
                          onArchive={setArchiveConfirmId}
                          isArchiving={archiveMenu.isPending && archiveConfirmId === menu.id}
                        />
                      ))}
                      {expiringMenus.length > maxItems && (
                        <Button variant="ghost" className="w-full mt-2">
                          View all {expiringMenus.length} expiring menus
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            )}

            {showArchived && (
              <TabsContent value="archived" className="mt-0">
                <ScrollArea className="h-[400px] pr-4">
                  {loadingArchived ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                      ))}
                    </div>
                  ) : displayArchived.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Archive className="h-12 w-12 text-muted-foreground mb-3" />
                      <h4 className="font-medium">No Archived Menus</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Expired menus will appear here with their analytics preserved.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayArchived.map((menu) => (
                        <ArchivedMenuCard
                          key={menu.id}
                          menu={menu}
                          onReactivate={setReactivateConfirmId}
                          isReactivating={reactivateMenu.isPending && reactivateConfirmId === menu.id}
                        />
                      ))}
                      {archivedMenus.length > maxItems && (
                        <Button variant="ghost" className="w-full mt-2">
                          View all {archivedMenus.length} archived menus
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!archiveConfirmId} onOpenChange={() => setArchiveConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Menu?</AlertDialogTitle>
            <AlertDialogDescription>
              This menu will be deactivated and moved to the archive. All analytics
              data will be preserved, and you can reactivate it at any time with one click.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              Archive Menu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Confirmation Dialog */}
      <AlertDialog open={!!reactivateConfirmId} onOpenChange={() => setReactivateConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate Menu?</AlertDialogTitle>
            <AlertDialogDescription>
              This menu will be reactivated and become accessible to customers again.
              The unique access links will be regenerated and customers will need new links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReactivate}>
              Reactivate Menu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MenuExpirationManager;
