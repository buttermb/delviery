import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, DollarSign, Package, Users,
  Download, Calendar
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';

export default function Reports() {
  const navigate = useNavigate();
  const { account, loading: accountLoading } = useAccount();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    activeCustomers: 0,
    avgOrderValue: 0
  });

  useEffect(() => {
    if (!accountLoading && !account) {
      navigate('/admin/dashboard');
    }
  }, [account, accountLoading, navigate]);

  useEffect(() => {
    if (account) {
      loadReports();
    }
  }, [account]);

  const loadReports = async () => {
    try {
      // Placeholder data - replace with actual queries
      setMetrics({
        totalRevenue: 45280.50,
        totalOrders: 324,
        activeCustomers: 89,
        avgOrderValue: 139.75
      });
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (accountLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead 
        title="Reports & Analytics"
        description="Business reports and analytics"
      />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-2">Track your business performance</p>
          </div>
          <Button>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${metrics.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600">+12.5%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.totalOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metrics.activeCustomers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600">+8</span> new this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${metrics.avgOrderValue}</div>
              <p className="text-xs text-muted-foreground mt-1">Per order</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="revenue" className="w-full">
              <TabsList>
                <TabsTrigger value="revenue">Revenue</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="customers">Customers</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
              </TabsList>

              <TabsContent value="revenue" className="space-y-4">
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Revenue chart coming soon
                </div>
              </TabsContent>

              <TabsContent value="orders" className="space-y-4">
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Orders chart coming soon
                </div>
              </TabsContent>

              <TabsContent value="customers" className="space-y-4">
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Customer analytics coming soon
                </div>
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  Product performance coming soon
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
