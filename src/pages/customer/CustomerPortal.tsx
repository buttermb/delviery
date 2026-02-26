import { logger } from '@/lib/logger';
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Package, FileText, User, UserPen, Loader2,
  MapPin, Clock, ChevronRight, RefreshCw
} from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { useCustomerPortalOrders } from '@/hooks/useCustomerPortalOrders';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';

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
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
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
        navigate(`/${tenantSlug || 'shop'}/customer/login`);
      }
    } else if (!user) {
      // No customer auth and no regular user auth - redirect to login
      navigate(`/${tenantSlug || 'shop'}/customer/login`);
    }
    setAuthLoading(false);
  }, [user, navigate, tenantSlug]);

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
                    <p className="text-lg font-medium mb-1">No orders yet</p>
                    <p className="text-sm mb-4">Your order history will appear here once you place an order.</p>
                    <Button onClick={() => navigate(`/${tenantSlug}/shop/dashboard`)}>Place Your First Order</Button>
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

                          <div className="mt-3 pt-3 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => navigate(`/${tenantSlug}/shop/orders/${order.id}`)}
                            >
                              View Order Details
                              <ChevronRight className="h-4 w-4 ml-2" />
                            </Button>
                          </div>
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
            {customerUser && (
              <PortalProfileSection customerUser={customerUser} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Editable profile section for the customer portal
function PortalProfileSection({ customerUser }: { customerUser: CustomerUser }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
  });

  // Fetch customer profile from customers table
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.customerPortal.profile(customerUser.customer_id, customerUser.tenant_id),
    queryFn: async () => {
      let query = supabase
        .from('customers')
        .select('id, first_name, last_name, phone, address, city, state, zip_code, email')
        .eq('tenant_id', customerUser.tenant_id);

      if (customerUser.customer_id) {
        query = query.eq('id', customerUser.customer_id);
      } else {
        query = query.eq('email', customerUser.email);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        logger.error('Failed to fetch customer profile', error, { component: 'PortalProfileSection' });
        throw error;
      }
      return data;
    },
    enabled: !!customerUser.tenant_id,
  });

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        zip_code: profile.zip_code ?? '',
      });
    }
  }, [profile]);

  // Update profile mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!profile?.id) throw new Error('No customer profile found');

      const { error } = await supabase
        .from('customers')
        .update({
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          phone: data.phone.trim() || null,
          address: data.address.trim() || null,
          city: data.city.trim() || null,
          state: data.state.trim() || null,
          zip_code: data.zip_code.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
        .eq('tenant_id', customerUser.tenant_id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.customerPortal.profile(customerUser.customer_id, customerUser.tenant_id) });
      setIsEditing(false);

      // Update localStorage with new name
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMER_USER);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          parsed.first_name = formData.first_name.trim();
          parsed.last_name = formData.last_name.trim();
          localStorage.setItem(STORAGE_KEYS.CUSTOMER_USER, JSON.stringify(parsed));
        } catch { /* ignore */ }
      }
    },
    onError: (error) => {
      logger.error('Failed to update profile', error, { component: 'PortalProfileSection' });
      toast.error('Failed to update profile', { description: 'Please try again.' });
    },
  });

  const handleSave = () => {
    if (!formData.first_name.trim()) {
      toast.error('First name is required');
      return;
    }
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        zip_code: profile.zip_code ?? '',
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <User className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Profile not found. Place an order to create your profile.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Profile Information</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your personal information and delivery address
            </p>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <UserPen className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-w-lg space-y-6">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="portal_first_name">First Name</Label>
              {isEditing ? (
                <Input
                  id="portal_first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  placeholder="First name"
                />
              ) : (
                <p className="text-sm py-2 px-3 bg-muted rounded-lg min-h-[40px] flex items-center">
                  {profile.first_name || '\u2014'}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="portal_last_name">Last Name</Label>
              {isEditing ? (
                <Input
                  id="portal_last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Last name"
                />
              ) : (
                <p className="text-sm py-2 px-3 bg-muted rounded-lg min-h-[40px] flex items-center">
                  {profile.last_name || '\u2014'}
                </p>
              )}
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>Email</Label>
            <p className="text-sm py-2 px-3 bg-muted rounded-lg min-h-[40px] flex items-center text-muted-foreground">
              {profile.email || customerUser.email}
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="portal_phone">Phone</Label>
            {isEditing ? (
              <Input
                id="portal_phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            ) : (
              <p className="text-sm py-2 px-3 bg-muted rounded-lg min-h-[40px] flex items-center">
                {formatPhoneNumber(profile.phone)}
              </p>
            )}
          </div>

          <Separator />

          {/* Delivery Address */}
          <div className="space-y-4">
            <h3 className="font-semibold">Delivery Address</h3>

            <div className="space-y-2">
              <Label htmlFor="portal_address">Street Address</Label>
              {isEditing ? (
                <Input
                  id="portal_address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main St"
                />
              ) : (
                <p className="text-sm py-2 px-3 bg-muted rounded-lg min-h-[40px] flex items-center">
                  {profile.address || '\u2014'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="portal_city">City</Label>
                {isEditing ? (
                  <Input
                    id="portal_city"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                  />
                ) : (
                  <p className="text-sm py-2 px-3 bg-muted rounded-lg min-h-[40px] flex items-center">
                    {profile.city || '\u2014'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal_state">State</Label>
                {isEditing ? (
                  <Input
                    id="portal_state"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="State"
                  />
                ) : (
                  <p className="text-sm py-2 px-3 bg-muted rounded-lg min-h-[40px] flex items-center">
                    {profile.state || '\u2014'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal_zip">ZIP Code</Label>
                {isEditing ? (
                  <Input
                    id="portal_zip"
                    value={formData.zip_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                    placeholder="12345"
                  />
                ) : (
                  <p className="text-sm py-2 px-3 bg-muted rounded-lg min-h-[40px] flex items-center">
                    {profile.zip_code || '\u2014'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
