import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMenuAccessLogs, useMenuOrders, useMenuSecurityEvents } from '@/hooks/useDisposableMenus';
import { format } from 'date-fns';
import { Download, Eye, ShoppingCart, TrendingUp, Users, BarChart3, Shield, Image } from 'lucide-react';
import { exportAccessLogs, exportOrders, exportMenuAnalytics, exportSecurityEvents } from '@/utils/exportHelpers';
import { showSuccessToast } from '@/utils/toastHelpers';
import { AnalyticsCharts } from './AnalyticsCharts';
import { SecurityHeatmap } from './SecurityHeatmap';
import { MenuImageAnalytics } from './MenuImageAnalytics';

interface Menu {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface MenuAnalyticsDialogProps {
  menu: Menu;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MenuAnalyticsDialog = ({ menu, open, onOpenChange }: MenuAnalyticsDialogProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data: accessLogs } = useMenuAccessLogs(menu.id);
  const { data: orders } = useMenuOrders(menu.id);
  const { data: securityEvents } = useMenuSecurityEvents(menu.id);

  const totalViews = accessLogs?.length || 0;
  const uniqueVisitors = new Set(accessLogs?.map(log => log.access_whitelist_id || log.ip_address)).size;
  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum, order) => sum + parseFloat(String(order.total_amount || 0)), 0) || 0;
  const conversionRate = totalViews > 0 ? ((totalOrders / totalViews) * 100).toFixed(2) : '0.00';

  const handleExportLogs = () => {
    if (!accessLogs || accessLogs.length === 0) return;
    const logsWithMenuName = accessLogs.map(log => ({ ...log, menu_name: menu.name }));
    exportAccessLogs(logsWithMenuName);
    showSuccessToast('Export Complete', 'Access logs exported to CSV');
  };

  const handleExportOrders = () => {
    if (!orders || orders.length === 0) return;
    const ordersWithMenuName = orders.map(order => ({ ...order, menu_name: menu.name }));
    exportOrders(ordersWithMenuName);
    showSuccessToast('Export Complete', 'Orders exported to CSV');
  };

  const handleExportAnalytics = () => {
    exportMenuAnalytics(menu, accessLogs || [], orders || []);
    showSuccessToast('Export Complete', 'Analytics exported to CSV');
  };

  const handleExportSecurityEvents = () => {
    if (!securityEvents || securityEvents.length === 0) return;
    exportSecurityEvents(securityEvents);
    showSuccessToast('Export Complete', 'Security events exported to CSV');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Analytics - {menu.name}</DialogTitle>
            <Button size="sm" variant="outline" onClick={handleExportAnalytics}>
              <Download className="h-4 w-4 mr-2" />
              Export Summary
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">
              <Eye className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="charts">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="images">
              <Image className="h-4 w-4 mr-2" />
              Images
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Users className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(90vh-12rem)] mt-4">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 p-1">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Total Views
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalViews}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Unique Visitors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{uniqueVisitors}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4" />
                      Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalOrders}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Conversion
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{conversionRate}%</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Orders Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  {!orders || orders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No orders yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orders.slice(0, 5).map(order => (
                        <div key={order.id} className="border rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold">{order.contact_phone || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">${parseFloat(String(order.total_amount || 0)).toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">{order.status}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Charts Tab */}
            <TabsContent value="charts" className="p-1">
              <AnalyticsCharts
                accessLogs={accessLogs || []}
                orders={orders || []}
                securityEvents={securityEvents || []}
              />
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="p-1">
              <MenuImageAnalytics menuId={menu.id} />
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6 p-1">
              <div className="flex justify-end mb-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportSecurityEvents}
                  disabled={!securityEvents || securityEvents.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Security Events
                </Button>
              </div>
              <SecurityHeatmap
                securityEvents={securityEvents || []}
                accessLogs={accessLogs || []}
              />
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs" className="space-y-6 p-1">
              {/* Access Logs */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Access Logs</CardTitle>
                    <Button size="sm" variant="outline" onClick={handleExportLogs} disabled={!accessLogs || accessLogs.length === 0}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {!accessLogs || accessLogs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No access logs yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {accessLogs.map(log => (
                          <div key={log.id} className="border rounded-lg p-3 text-sm">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-semibold">{log.ip_address || 'Anonymous'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(log.accessed_at), 'MMM dd, yyyy HH:mm:ss')}
                                </div>
                              </div>
                              <div className="text-right text-xs text-muted-foreground">
                                <div>IP: {log.ip_address || 'Unknown'}</div>
                                <div>Access: {log.access_code_correct ? '✓' : '✗'}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Orders */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Orders</CardTitle>
                    <Button size="sm" variant="outline" onClick={handleExportOrders} disabled={!orders || orders.length === 0}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {!orders || orders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No orders yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {orders.map(order => (
                          <div key={order.id} className="border rounded-lg p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-semibold">{order.contact_phone || 'Unknown'}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">${parseFloat(String(order.total_amount || 0)).toFixed(2)}</div>
                                <div className="text-xs text-muted-foreground">{order.status}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
