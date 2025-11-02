/**
 * Comprehensive Analytics Dashboard
 * Complete metrics, charts, and insights for the wholesale CRM
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Eye, Users, ShoppingCart, DollarSign, TrendingUp, 
  Image as ImageIcon, Shield, Clock, BarChart3,
  Download, Calendar, Filter, ZoomIn
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AnalyticsPeriod {
  start: Date;
  end: Date;
  label: string;
}

const PERIODS: Record<string, AnalyticsPeriod> = {
  '7d': { start: subDays(new Date(), 7), end: new Date(), label: 'Last 7 Days' },
  '30d': { start: subDays(new Date(), 30), end: new Date(), label: 'Last 30 Days' },
  '90d': { start: subDays(new Date(), 90), end: new Date(), label: 'Last 90 Days' },
  'all': { start: new Date(0), end: new Date(), label: 'All Time' },
};

export default function ComprehensiveAnalytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30d');
  const [accountId, setAccountId] = useState<string | null>(null);

  // Get account
  const { data: account } = useQuery({
    queryKey: ['account'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (data) setAccountId(data.id);
      return data;
    },
  });

  const period = PERIODS[selectedPeriod];

  // Overall metrics
  const { data: overallMetrics } = useQuery({
    queryKey: ['analytics-overall', accountId, selectedPeriod],
    queryFn: async () => {
      if (!accountId) return null;

      const startDate = startOfDay(period.start).toISOString();
      const endDate = endOfDay(period.end).toISOString();

      // Total menus
      const { count: menuCount } = await supabase
        .from('disposable_menus')
        .select('*', { count: 'exact', head: true });

      // Total customers
      const { count: customerCount } = await supabase
        .from('wholesale_clients')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId);

      // Total orders
      const { data: orders } = await supabase
        .from('menu_orders')
        .select('total_amount, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const totalRevenue = orders?.reduce((sum, o) => sum + parseFloat(o.total_amount?.toString() || '0'), 0) || 0;
      const totalOrders = orders?.length || 0;
      const averageOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Access logs
      const { count: viewCount } = await supabase
        .from('menu_access_logs')
        .select('*', { count: 'exact', head: true })
        .gte('accessed_at', startDate)
        .lte('accessed_at', endDate);

      return {
        menuCount: menuCount || 0,
        customerCount: customerCount || 0,
        totalOrders,
        totalRevenue,
        averageOrder,
        viewCount: viewCount || 0,
      };
    },
    enabled: !!accountId,
  });

  // Menu performance
  const { data: menuPerformance } = useQuery({
    queryKey: ['analytics-menus', accountId, selectedPeriod],
    queryFn: async () => {
      if (!accountId) return [];

      const startDate = startOfDay(period.start).toISOString();
      const endDate = endOfDay(period.end).toISOString();

      // Get all menus with stats
      const { data: menus } = await supabase
        .from('disposable_menus')
        .select(`
          id,
          name,
          created_at,
          disposable_menu_products(count),
          menu_access_logs(count),
          menu_orders(count, total_amount)
        `);

      if (!menus) return [];

      // Get detailed stats for each menu
      const menuStats = await Promise.all(
        menus.map(async (menu) => {
          const { count: views } = await supabase
            .from('menu_access_logs')
            .select('*', { count: 'exact', head: true })
            .eq('menu_id', menu.id)
            .gte('accessed_at', startDate)
            .lte('accessed_at', endDate);

          const { data: orders } = await supabase
            .from('menu_orders')
            .select('total_amount')
            .eq('menu_id', menu.id)
            .gte('created_at', startDate)
            .lte('created_at', endDate);

          const revenue = orders?.reduce((sum, o) => sum + parseFloat(o.total_amount?.toString() || '0'), 0) || 0;
          const orderCount = orders?.length || 0;
          const conversionRate = (views || 0) > 0 ? (orderCount / views) * 100 : 0;

          return {
            id: menu.id,
            name: menu.name,
            created_at: menu.created_at,
            productCount: menu.disposable_menu_products?.length || 0,
            views: views || 0,
            orders: orderCount,
            revenue,
            conversionRate,
          };
        })
      );

      return menuStats.sort((a, b) => b.revenue - a.revenue);
    },
    enabled: !!accountId,
  });

  // Product analytics
  const { data: productAnalytics } = useQuery({
    queryKey: ['analytics-products', accountId, selectedPeriod],
    queryFn: async () => {
      if (!accountId) return [];

      const startDate = startOfDay(period.start).toISOString();
      const endDate = endOfDay(period.end).toISOString();

      // Get products from orders
      const { data: orders } = await supabase
        .from('menu_orders')
        .select('items')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (!orders) return [];

      // Aggregate product sales
      const productSales: Record<string, {
        name: string;
        quantity: number;
        revenue: number;
        orderCount: number;
      }> = {};

      orders.forEach((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach((item: any) => {
          const productId = item.product_id || item.id;
          const productName = item.name || item.product_name || 'Unknown';
          
          if (!productSales[productId]) {
            productSales[productId] = {
              name: productName,
              quantity: 0,
              revenue: 0,
              orderCount: 0,
            };
          }

          productSales[productId].quantity += item.quantity || item.qty_lbs || 0;
          productSales[productId].revenue += item.subtotal || (item.price_per_lb * (item.quantity || item.qty_lbs) || 0);
          productSales[productId].orderCount += 1;
        });
      });

      return Object.values(productSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20); // Top 20 products
    },
    enabled: !!accountId,
  });

  // Security events
  const { data: securityEvents } = useQuery({
    queryKey: ['analytics-security', accountId, selectedPeriod],
    queryFn: async () => {
      if (!accountId) return { events: [], summary: {} };

      const startDate = startOfDay(period.start).toISOString();
      const endDate = endOfDay(period.end).toISOString();

      const { data: events } = await supabase
        .from('menu_security_events')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
        .limit(100);

      // Summarize by type
      const summary: Record<string, number> = {};
      events?.forEach((event) => {
        summary[event.event_type] = (summary[event.event_type] || 0) + 1;
      });

      return {
        events: events || [],
        summary,
      };
    },
    enabled: !!accountId,
  });

  // Image analytics
  const { data: imageAnalytics } = useQuery({
    queryKey: ['analytics-images', accountId],
    queryFn: async () => {
      if (!accountId) return null;

      // Products with images
      const { data: products } = await supabase
        .from('wholesale_inventory')
        .select('id, image_url, images, product_name')
        .eq('account_id', accountId);

      const withImages = products?.filter(p => p.image_url || (p.images && p.images.length > 0)).length || 0;
      const totalProducts = products?.length || 0;
      const coverage = totalProducts > 0 ? (withImages / totalProducts) * 100 : 0;

      // Image views from access logs
      const { data: accessLogs } = await supabase
        .from('menu_access_logs')
        .select('actions_taken')
        .not('actions_taken', 'is', null)
        .limit(1000);

      let imageViews = 0;
      let imageZooms = 0;

      accessLogs?.forEach((log) => {
        const actions = Array.isArray(log.actions_taken) ? log.actions_taken : [];
        actions.forEach((action: any) => {
          if (action.type === 'product_viewed' && action.product_id) {
            imageViews += 1;
          }
          if (action.type === 'image_zoomed') {
            imageZooms += 1;
          }
        });
      });

      return {
        totalProducts,
        withImages,
        coverage,
        imageViews,
        imageZooms,
      };
    },
    enabled: !!accountId,
  });

  if (!account) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Please set up your account first</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Comprehensive Analytics</h1>
          <p className="text-muted-foreground">Complete insights into your wholesale business</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODS).map(([key, period]) => (
                <SelectItem key={key} value={key}>{period.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <Eye className="h-5 w-5 text-blue-500" />
            <Badge variant="outline">Views</Badge>
          </div>
          <div className="text-3xl font-bold">{overallMetrics?.viewCount.toLocaleString() || 0}</div>
          <div className="text-sm text-muted-foreground">Menu views</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 text-green-500" />
            <Badge variant="outline">Customers</Badge>
          </div>
          <div className="text-3xl font-bold">{overallMetrics?.customerCount.toLocaleString() || 0}</div>
          <div className="text-sm text-muted-foreground">Total customers</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="h-5 w-5 text-purple-500" />
            <Badge variant="outline">Orders</Badge>
          </div>
          <div className="text-3xl font-bold">{overallMetrics?.totalOrders.toLocaleString() || 0}</div>
          <div className="text-sm text-muted-foreground">
            ${overallMetrics?.averageOrder.toFixed(2) || '0.00'} avg
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            <Badge variant="outline">Revenue</Badge>
          </div>
          <div className="text-3xl font-bold">${overallMetrics?.totalRevenue.toLocaleString() || 0}</div>
          <div className="text-sm text-muted-foreground">{selectedPeriod}</div>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="menus" className="space-y-4">
        <TabsList>
          <TabsTrigger value="menus">Menu Performance</TabsTrigger>
          <TabsTrigger value="products">Product Analytics</TabsTrigger>
          <TabsTrigger value="images">Image Analytics</TabsTrigger>
          <TabsTrigger value="security">Security Events</TabsTrigger>
        </TabsList>

        {/* Menu Performance */}
        <TabsContent value="menus" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Top Performing Menus</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Menu Name</th>
                    <th className="text-right p-2">Views</th>
                    <th className="text-right p-2">Orders</th>
                    <th className="text-right p-2">Revenue</th>
                    <th className="text-right p-2">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {menuPerformance?.map((menu) => (
                    <tr key={menu.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{menu.name}</td>
                      <td className="p-2 text-right">{menu.views.toLocaleString()}</td>
                      <td className="p-2 text-right">{menu.orders}</td>
                      <td className="p-2 text-right">${menu.revenue.toLocaleString()}</td>
                      <td className="p-2 text-right">
                        <Badge variant={menu.conversionRate > 5 ? 'default' : 'secondary'}>
                          {menu.conversionRate.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Product Analytics */}
        <TabsContent value="products" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Top Selling Products</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Product</th>
                    <th className="text-right p-2">Quantity</th>
                    <th className="text-right p-2">Orders</th>
                    <th className="text-right p-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {productAnalytics?.map((product, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{product.name}</td>
                      <td className="p-2 text-right">{product.quantity.toLocaleString()} lbs</td>
                      <td className="p-2 text-right">{product.orderCount}</td>
                      <td className="p-2 text-right">${product.revenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Image Analytics */}
        <TabsContent value="images" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <ImageIcon className="h-5 w-5 text-blue-500" />
                <Badge variant="outline">Coverage</Badge>
              </div>
              <div className="text-3xl font-bold">{imageAnalytics?.coverage.toFixed(1) || 0}%</div>
              <div className="text-sm text-muted-foreground">
                {imageAnalytics?.withImages || 0} / {imageAnalytics?.totalProducts || 0} products
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Eye className="h-5 w-5 text-green-500" />
                <Badge variant="outline">Image Views</Badge>
              </div>
              <div className="text-3xl font-bold">{imageAnalytics?.imageViews.toLocaleString() || 0}</div>
              <div className="text-sm text-muted-foreground">Total image views</div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <ZoomIn className="h-5 w-5 text-purple-500" />
                <Badge variant="outline">Zooms</Badge>
              </div>
              <div className="text-3xl font-bold">{imageAnalytics?.imageZooms.toLocaleString() || 0}</div>
              <div className="text-sm text-muted-foreground">Images zoomed</div>
            </Card>
          </div>
        </TabsContent>

        {/* Security Events */}
        <TabsContent value="security" className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            {Object.entries(securityEvents?.summary || {}).map(([type, count]) => (
              <Card key={type} className="p-4">
                <div className="flex items-center justify-between">
                  <Shield className="h-4 w-4 text-red-500" />
                  <div className="text-right">
                    <div className="text-2xl font-bold">{count as number}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {type.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4">Recent Security Events</h3>
            <div className="space-y-2">
              {securityEvents?.events.slice(0, 20).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                  <div>
                    <div className="font-medium capitalize">{event.event_type.replace(/_/g, ' ')}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(event.created_at), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                  <Badge variant={event.severity === 'high' ? 'destructive' : 'secondary'}>
                    {event.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

