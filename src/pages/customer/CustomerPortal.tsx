import { logger } from '@/lib/logger';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Package from "lucide-react/dist/esm/icons/package";
import FileText from "lucide-react/dist/esm/icons/file-text";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Clock from "lucide-react/dist/esm/icons/clock";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { SEOHead } from '@/components/SEOHead';
import { useCustomerPortalOrders } from '@/hooks/useCustomerPortalOrders';
import { format } from 'date-fns';

interface CustomerUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  customer_id?: string;
  tenant_id: string;
}

export default function CustomerPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userProfile, loading: accountLoading } = useAccount();
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Check for customer token
    const token = localStorage.getItem(STORAGE_KEYS.CUSTOMER_ACCESS_TOKEN);
    const userData = localStorage.getItem(STORAGE_KEYS.CUSTOMER_USER);

    if (token && userData) {
      try {
        setCustomerUser(JSON.parse(userData));
      } catch (error) {
        logger.error('Error parsing customer user data', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerPortal' });
        navigate('/willysbo/customer/login');
      }
    } else if (!user) {
      // No customer auth and no regular user auth - redirect to login
      navigate('/willysbo/customer/login');
    }
    setAuthLoading(false);
  }, [user, navigate]);

  // Fetch orders using the new hook
  const {
    orders,
    isLoading: ordersLoading,
    error: ordersError,
    orderStats,
    getStatusInfo,
    refetch,
  } = useCustomerPortalOrders({
    customerEmail: customerUser?.email,
    tenantId: customerUser?.tenant_id,
    enabled: !!customerUser,
  });

  const loading = authLoading || accountLoading;

  if (accountLoading || loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <SEOHead 
        title="My Account"
        description="Manage your orders and account"
      />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Account</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back, {customerUser?.first_name || userProfile?.full_name || 'Customer'}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{orderStats.activeOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently in progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{orderStats.totalOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${orderStats.totalSpent.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">Lifetime purchases</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders" className="w-full">
          <TabsList>
            <TabsTrigger value="orders">My Orders</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Orders</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={ordersLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${ordersLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-muted-foreground mt-4">Loading orders...</p>
                  </div>
                ) : ordersError ? (
                  <div className="text-center py-8 text-destructive">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Failed to load orders</p>
                    <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                      Try Again
                    </Button>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No orders yet</p>
                    <Button className="mt-4">Place Your First Order</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => {
                      const statusInfo = getStatusInfo(order.status);
                      const items = order.items as Array<{ name: string; quantity: number; price: number }> | null;

                      return (
                        <div key={order.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium text-lg">Order #{order.order_number}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold">${order.total_amount.toFixed(2)}</p>
                              <Badge variant={statusInfo.variant}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                          </div>

                          {items && items.length > 0 && (
                            <>
                              <Separator className="my-3" />
                              <div className="space-y-2">
                                {items.slice(0, 3).map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      {item.name} × {item.quantity}
                                    </span>
                                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                                  </div>
                                ))}
                                {items.length > 3 && (
                                  <p className="text-sm text-muted-foreground">
                                    +{items.length - 3} more items
                                  </p>
                                )}
                              </div>
                            </>
                          )}

                          {order.tracking_token && (
                            <div className="mt-3 pt-3 border-t">
                              <Button variant="outline" size="sm" className="w-full" asChild>
                                <a href={`/track/${order.tracking_token}`}>
                                  Track Order
                                  <ChevronRight className="h-4 w-4 ml-2" />
                                </a>
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Billing History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No invoices available</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">
                      {customerUser?.first_name && customerUser?.last_name
                        ? `${customerUser.first_name} ${customerUser.last_name}`
                        : customerUser?.first_name || userProfile?.full_name || 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{customerUser?.email || userProfile?.email || user?.email}</p>
                  </div>
                  <Button>Edit Profile</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
