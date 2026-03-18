import { logger } from '@/lib/logger';
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  FileText,
  DollarSign,
  TrendingUp,
  Loader2,
  Eye,
  LogOut,
} from "lucide-react";
import { useVendorAuth } from '@/contexts/VendorAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import type { Database } from '@/integrations/supabase/types';
import { formatSmartDate } from '@/lib/formatters';

type MarketplaceOrderRow = Database['public']['Tables']['marketplace_orders']['Row'];

// Extend the generated type with buyer_business_name which exists in DB but may not be in generated types
interface MarketplaceOrder extends Pick<MarketplaceOrderRow, 'id' | 'order_number' | 'total_amount' | 'created_at'> {
  status: string | null;
  payment_status: string | null;
  buyer_business_name?: string | null;
}

export default function VendorDashboardPage() {
  const { vendor, logout } = useVendorAuth();
  const navigate = useNavigate();

  const { data: orders, isLoading } = useQuery({
    queryKey: queryKeys.vendorOrders.list(vendor?.tenant_id),
    enabled: !!vendor?.tenant_id,
    queryFn: async () => {
      if (!vendor?.tenant_id) return [];

      try {
        const { data, error } = await supabase
          .from("marketplace_orders")
          .select('id, order_number, total_amount, created_at, status, payment_status, buyer_business_name')
          .eq("seller_tenant_id", vendor.tenant_id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) {
          logger.error('Failed to fetch marketplace orders', error, { component: 'VendorDashboardPage' });
          throw error;
        }

        return data as MarketplaceOrder[];
      } catch (err) {
        logger.error('Error fetching orders', err);
        return [];
      }
    },
  });

  // Calculate stats
  const activeStatuses = ['pending', 'accepted', 'processing', 'shipped'];
  const activeOrders = orders?.filter(o => o.status && activeStatuses.includes(o.status)).length ?? 0;

  // Pending payment: delivered but not paid
  const pendingPayment = orders?.filter(o => o.payment_status !== 'paid' && o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0;

  const totalRevenue = orders?.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0;

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">🏭</span>
            Vendor Portal
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground hidden sm:block">
              {vendor?.business_name}
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Welcome Section */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Manage your wholesale orders and track your revenue.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeOrders}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payment</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${pendingPayment.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Marketplace Status</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize text-primary text-sm">
                {vendor?.marketplace_status || 'Unknown'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Purchase Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>
              View and manage wholesale orders from retailers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-lg">#{order.order_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${order.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          order.status === 'accepted' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            order.status === 'delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                          }`}>
                          {(order.status ?? 'unknown').toUpperCase()}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.buyer_business_name || 'Unknown Buyer'} • {order.created_at ? formatSmartDate(order.created_at) : 'N/A'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-bold">${Number(order.total_amount).toFixed(2)}</div>
                        <div className={`text-xs ${order.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                          {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="h-9" onClick={() => navigate(`/vendor/order/${order.id}`)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-foreground">No orders yet</h3>
                <p>When retailers place orders, they will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
