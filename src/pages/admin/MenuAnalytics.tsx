import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Eye, Users, ShoppingCart, DollarSign, MapPin, Clock, 
  Shield, AlertTriangle, TrendingUp 
} from 'lucide-react';
import { useMenuAccessLogs, useMenuOrders, useMenuSecurityEvents } from '@/hooks/useDisposableMenus';
import { format } from 'date-fns';

const MenuAnalytics = () => {
  const { menuId } = useParams();
  const { data: accessLogs, isLoading: logsLoading } = useMenuAccessLogs(menuId!);
  const { data: orders, isLoading: ordersLoading } = useMenuOrders(menuId);
  const { data: securityEvents, isLoading: eventsLoading } = useMenuSecurityEvents(menuId);

  // Calculate metrics
  const totalViews = accessLogs?.length || 0;
  const uniqueVisitors = new Set(accessLogs?.map(log => log.access_whitelist_id)).size;
  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum, order) => sum + parseFloat(order.total_amount.toString()), 0) || 0;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const conversionRate = totalViews > 0 ? (totalOrders / totalViews) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Menu Analytics</h1>
        <p className="text-muted-foreground">Detailed insights and metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <Badge variant="outline">Views</Badge>
          </div>
          <div className="text-3xl font-bold">{totalViews}</div>
          <div className="text-sm text-muted-foreground">Total page views</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <Badge variant="outline">Visitors</Badge>
          </div>
          <div className="text-3xl font-bold">{uniqueVisitors}</div>
          <div className="text-sm text-muted-foreground">Unique customers</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            <Badge variant="outline">Orders</Badge>
          </div>
          <div className="text-3xl font-bold">{totalOrders}</div>
          <div className="text-sm text-muted-foreground">
            {conversionRate.toFixed(1)}% conversion
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <Badge variant="outline">Revenue</Badge>
          </div>
          <div className="text-3xl font-bold">${totalRevenue.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">
            ${averageOrderValue.toFixed(2)} avg
          </div>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="access" className="space-y-4">
        <TabsList>
          <TabsTrigger value="access">Access Logs</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="security">Security Events</TabsTrigger>
        </TabsList>

        {/* Access Logs Tab */}
        <TabsContent value="access" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Recent Access Activity</h3>
            <div className="space-y-3">
              {logsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : accessLogs?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No access logs yet</div>
              ) : (
                accessLogs?.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {log.whitelist?.customer_name || 'Unknown Customer'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(log.accessed_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {log.location && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          Location tracked
                        </div>
                      )}
                      <Badge variant="outline">{log.access_code_correct ? 'Valid' : 'Invalid'}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Order History</h3>
            <div className="space-y-3">
              {ordersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : orders?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No orders yet</div>
              ) : (
                orders?.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">
                          {order.whitelist?.customer_name || 'Unknown Customer'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold">${parseFloat(order.total_amount.toString()).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.order_data ? (Array.isArray(order.order_data) ? order.order_data.length : 0) : 0} items
                        </div>
                      </div>
                      <Badge variant={order.status === 'confirmed' ? 'default' : 'outline'}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Security Events Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Security Events</h3>
            <div className="space-y-3">
              {eventsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : securityEvents?.length === 0 ? (
                <div className="text-center py-8 text-green-600">
                  <Shield className="h-8 w-8 mx-auto mb-2" />
                  No security events detected
                </div>
              ) : (
                securityEvents?.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`h-4 w-4 ${
                        event.severity === 'high' ? 'text-destructive' :
                        event.severity === 'medium' ? 'text-yellow-500' :
                        'text-muted-foreground'
                      }`} />
                      <div>
                        <div className="font-medium">{event.event_type}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(event.created_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                        {event.event_data && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {JSON.stringify(event.event_data)}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant={event.severity === 'high' ? 'destructive' : 'outline'}>
                      {event.severity}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MenuAnalytics;
