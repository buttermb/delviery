/**
 * Account Page
 * Customer account management and order history
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useShop } from './ShopLayout';
import { useLuxuryTheme } from '@/components/shop/luxury';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStorefrontOrders, type OrderStatusFilter, type OrderFilters } from '@/hooks/useStorefrontOrders';
import {
  User,
  Package,
  LogOut,
  Search,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Heart,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Plus,
  Mail,
  Loader2,
  Filter,
  Calendar,
  UserPen,
  Leaf,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { formatPhoneNumber } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';
import { STORAGE_KEYS } from '@/constants/storageKeys';

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount?: number;
  total?: number;
  items?: OrderItem[];
  created_at: string;
  tracking_token?: string;
}

export default function AccountPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const { store } = useShop();
  const { accentColor } = useLuxuryTheme();

  const [email, setEmail] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  // Magic Link state
  const [showMagicCode, setShowMagicCode] = useState(false);
  const [magicCode, setMagicCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);

  // Check if customer is logged in (from localStorage)
  useEffect(() => {
    if (store?.id) {
      const savedCustomer = localStorage.getItem(`${STORAGE_KEYS.SHOP_CUSTOMER_PREFIX}${store.id}`);
      if (savedCustomer) {
        try {
          const customer = JSON.parse(savedCustomer);
          setCustomerId(customer.id);
          setEmail(customer.email);
          setCustomerName(customer.first_name || null);
          setIsLoggedIn(true);
        } catch {
          // Invalid data
        }
      }
    }
  }, [store?.id]);

  // Order filters state
  const [orderFilters, setOrderFilters] = useState<OrderFilters>({
    status: 'all',
    search: '',
    dateRange: 'all',
  });
  const [orderSearchInput, setOrderSearchInput] = useState('');

  // Use unified storefront orders hook
  const { orders, isLoading: ordersLoading, orderStats } = useStorefrontOrders({
    storeId: store?.id,
    customerId,
    filters: orderFilters,
  });

  // Debounced search handler
  useEffect(() => {
    const timeout = setTimeout(() => {
      setOrderFilters((prev) => ({ ...prev, search: orderSearchInput }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [orderSearchInput]);

  // Quick login/lookup by email
  const handleEmailLookup = async () => {
    if (!email || !store?.id) return;

    setIsLookingUp(true);
    try {
      const { data, error } = await supabase
        .rpc('get_marketplace_customer_by_email' as 'get_secret', {
          p_store_id: store.id,
          p_email: email.trim()
        } as Record<string, unknown>);

      if (error || !data || (Array.isArray(data) && data.length === 0)) {
        toast.error('Account not found', {
          description: 'No account found with this email. Please check the email or place an order first.',
        });
        return;
      }

      const customer = Array.isArray(data) ? data[0] : data;

      // Save to localStorage
      localStorage.setItem(`${STORAGE_KEYS.SHOP_CUSTOMER_PREFIX}${store.id}`, JSON.stringify(customer));
      setCustomerId(customer.id);
      setCustomerName(customer.first_name || null);
      setIsLoggedIn(true);
      toast.success(`Welcome back, ${customer.first_name || 'Customer'}!`);
    } finally {
      setIsLookingUp(false);
    }
  };

  // Track order by number
  const handleTrackOrder = async () => {
    if (!trackingNumber.trim()) return;

    setIsTracking(true);
    try {
      // Try tracking token first
      const { data } = await supabase
        .from('marketplace_orders')
        .select('tracking_token')
        .eq('store_id', store?.id)
        .or(`tracking_token.eq.${trackingNumber.trim()},order_number.eq.${trackingNumber.trim().toUpperCase()}`)
        .maybeSingle();

      const orderData = data as { tracking_token?: string } | null;

      if (orderData?.tracking_token) {
        navigate(`/shop/${storeSlug}/track/${orderData.tracking_token}`);
      } else {
        toast.error('Order not found', {
          description: 'Please check your order number and try again.',
        });
      }
    } finally {
      setIsTracking(false);
    }
  };

  // Logout
  const handleLogout = () => {
    if (store?.id) {
      localStorage.removeItem(`${STORAGE_KEYS.SHOP_CUSTOMER_PREFIX}${store.id}`);
    }
    setIsLoggedIn(false);
    setCustomerId(null);
    setEmail('');
    setShowMagicCode(false);
    setCodeSentTo(null);
    toast.success('Logged out successfully');
  };

  // Send magic code
  const handleSendMagicCode = async () => {
    if (!email || !store?.id) return;

    setIsSendingCode(true);
    try {
      // Call RPC to generate and store code
      const { data: code, error } = await supabase.rpc('request_magic_code' as 'get_secret', {
        p_store_id: store.id,
        p_email: email.trim()
      } as Record<string, unknown>);

      if (error) throw error;

      // In production, this would be sent via email.
      // For this demo/MVP, we show it in the toast as confirmed by requirement.
      toast.success('Magic code sent!', {
        description: `Check your email at ${email}. (Code: ${code})`,
      });

      setCodeSentTo(email);
      setShowMagicCode(true);
    } catch (error) {
      logger.error('Failed to send magic code', error);
      toast.error('Failed to send code', {
        description: 'Please try again or use email lookup.',
      });
    } finally {
      setIsSendingCode(false);
    }
  };

  // Verify magic code
  const handleVerifyMagicCode = async () => {
    if (!magicCode || !codeSentTo || !store?.id) return;

    setIsVerifyingCode(true);
    try {
      const { data: customerData, error } = await supabase.rpc('verify_magic_code' as 'get_secret', {
        p_store_id: store.id,
        p_email: codeSentTo.trim(),
        p_code: magicCode.trim()
      } as Record<string, unknown>);
      const customer = customerData as { id: string; email: string; first_name?: string } | null;

      if (error) throw error;

      if (!customer) {
        toast.error('Account not found', {
          description: 'No account found with this email. Please sign up or place an order.',
        });
        return;
      }

      // Success - Login
      localStorage.setItem(`${STORAGE_KEYS.SHOP_CUSTOMER_PREFIX}${store.id}`, JSON.stringify(customer));
      setCustomerId(customer.id);
      setEmail(customer.email);
      setCustomerName(customer.first_name || null);
      setIsLoggedIn(true);

      toast.success(`Welcome back, ${customer.first_name || 'Customer'}!`);
      setShowMagicCode(false);
      setMagicCode('');

    } catch (error: unknown) {
      logger.error('Failed to verify magic code', error);
      const message = error instanceof Error ? error.message : 'Invalid code or expired.';
      toast.error('Verification failed', {
        description: message,
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
      case 'refunded':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-indigo-100 text-indigo-800',
      out_for_delivery: 'bg-orange-100 text-orange-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    };
    return (
      <Badge variant="outline" className={colors[status] ?? ''}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (!store) return null;

  // Not logged in view
  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center items-center min-h-[60vh]">
        <Card className="w-full max-w-md border-none shadow-xl rounded-3xl overflow-hidden bg-white dark:bg-zinc-950">
          <CardHeader className="text-center pb-2 pt-8">
            <div
              className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center shadow-inner"
              style={{ backgroundColor: `${store.primary_color}10` }}
            >
              <User className="w-10 h-10" style={{ color: store.primary_color }} />
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight text-neutral-900">Welcome Back</CardTitle>
            <CardDescription className="text-neutral-500 text-base mt-2">
              Sign in to view orders and manage your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-8">
            {/* Magic Code Entry Mode */}
            {showMagicCode ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="text-center bg-neutral-50 p-6 rounded-2xl border border-neutral-100">
                  <Mail className="w-10 h-10 mx-auto mb-3 text-neutral-400" />
                  <p className="text-sm text-neutral-500 mb-1">
                    We sent a 6-digit code to
                  </p>
                  <p className="font-bold text-neutral-900 text-lg">{codeSentTo}</p>
                </div>
                <div className="space-y-3">
                  <Input
                    id="magicCode"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={magicCode}
                    onChange={(e) => setMagicCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    aria-label="Verification code"
                    className="text-center text-3xl tracking-[1em] font-mono h-16 rounded-xl border-neutral-200 focus-visible:border-neutral-900 focus-visible:ring-neutral-900 bg-white dark:bg-zinc-950"
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyMagicCode()}
                    autoFocus
                  />
                  <p className="text-xs text-center text-neutral-400">Enter the 6-digit verification code</p>
                </div>
                <Button
                  className="w-full h-14 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                  style={{ backgroundColor: store.primary_color }}
                  onClick={handleVerifyMagicCode}
                  disabled={isVerifyingCode || magicCode.length !== 6}
                >
                  {isVerifyingCode ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Sign In'
                  )}
                </Button>
                <div className="flex justify-center gap-6 text-sm pt-2">
                  <button
                    className="text-neutral-500 hover:text-neutral-900 font-medium transition-colors"
                    onClick={() => handleSendMagicCode()}
                    disabled={isSendingCode}
                  >
                    Resend code
                  </button>
                  <button
                    className="text-neutral-500 hover:text-neutral-900 font-medium transition-colors"
                    onClick={() => {
                      setShowMagicCode(false);
                      setMagicCode('');
                    }}
                  >
                    Change email
                  </button>
                </div>
              </div>
            ) : (
              /* Normal Email Entry Mode */
              <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="space-y-3">
                  <Label htmlFor="email" className="text-neutral-700 font-semibold ml-1">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-14 px-4 text-lg rounded-xl border-neutral-200 focus-visible:border-neutral-900 focus-visible:ring-neutral-900 bg-neutral-50 dark:bg-neutral-900 focus-visible:bg-white dark:focus-visible:bg-zinc-950 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleEmailLookup()}
                  />
                </div>

                <div className="space-y-3">
                  <Button
                    className="w-full h-14 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                    style={{ backgroundColor: store.primary_color }}
                    onClick={handleEmailLookup}
                    disabled={isLookingUp || !email}
                  >
                    {isLookingUp ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>

                  <div className="relative py-3">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-neutral-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-wider font-bold">
                      <span className="bg-white dark:bg-zinc-950 px-4 text-neutral-400">or continue with</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full h-14 text-lg font-semibold rounded-xl border-2 hover:bg-neutral-50 hover:border-neutral-300 transition-all text-neutral-700"
                    onClick={handleSendMagicCode}
                    disabled={!email || isSendingCode}
                  >
                    {isSendingCode ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                        Sending Code...
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5 mr-3" />
                        Send Magic Code
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-center text-neutral-400 px-4">
                    We'll determine if you have an account. If not, we'll help you create one or track your order.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2">
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-dashed border-neutral-200" />
                </div>
              </div>
              <p className="text-sm text-center text-neutral-500 mb-4 font-medium">
                Just looking to track an order?
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Order # or tracking code"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
                  className="h-12 rounded-lg bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 focus-visible:bg-white dark:focus-visible:bg-zinc-950"
                  aria-label="Order number or tracking code"
                />
                <Button variant="secondary" onClick={handleTrackOrder} disabled={isTracking || !trackingNumber.trim()} className="h-12 w-12 rounded-lg shrink-0" aria-label="Track order">
                  {isTracking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </Button>
              </div>
            </div>

            <Separator className="bg-neutral-100" />

            <div className="text-center pb-2">
              <p className="text-sm text-neutral-500 mb-3">
                Don't have an account yet?
              </p>
              <Link to={`/shop/${storeSlug}/products`}>
                <Button variant="ghost" className="font-bold text-neutral-900 hover:bg-neutral-100 rounded-full px-6">
                  Start Shopping <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged in view
  return (
    <div className="container mx-auto px-4 py-8 min-h-dvh bg-shop-bg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 bg-white dark:bg-zinc-950 p-6 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg" style={{ backgroundColor: store.primary_color }}>
            {email.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              {customerName ? `Hi, ${customerName}` : 'My Account'}
            </h1>
            <div className="flex items-center gap-2 text-neutral-500 font-medium">
              <Mail className="w-4 h-4" />
              {email}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={handleLogout} className="rounded-full px-6 py-5 border-neutral-200 hover:bg-neutral-50 hover:text-red-600 hover:border-red-200 transition-colors">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="orders">
            <Package className="w-4 h-4 mr-2" />
            Orders
          </TabsTrigger>
          <TabsTrigger value="wishlist">
            <Heart className="w-4 h-4 mr-2" />
            Wishlist
          </TabsTrigger>
          <TabsTrigger value="profile">
            <UserPen className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="track">
            <Search className="w-4 h-4 mr-2" />
            Track Order
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Order History</CardTitle>
                  <CardDescription>
                    {orderStats.total > 0
                      ? `${orderStats.total} order${orderStats.total !== 1 ? 's' : ''} • ${formatCurrency(orderStats.totalSpent)} spent`
                      : 'View and track your past orders'}
                  </CardDescription>
                </div>
                {orderStats.total > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">
                      {orderStats.active} active
                    </Badge>
                    <Badge variant="secondary" className="bg-green-50 text-green-700">
                      {orderStats.completed} delivered
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              {orderStats.total > 0 && (
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search orders..."
                      value={orderSearchInput}
                      onChange={(e) => setOrderSearchInput(e.target.value)}
                      className="pl-9 h-9"
                      aria-label="Search orders"
                    />
                  </div>
                  <Select
                    value={orderFilters.status}
                    onValueChange={(value) =>
                      setOrderFilters((prev) => ({ ...prev, status: value as OrderStatusFilter }))
                    }
                  >
                    <SelectTrigger className="w-[140px] h-9">
                      <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Orders</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={orderFilters.dateRange}
                    onValueChange={(value) =>
                      setOrderFilters((prev) => ({ ...prev, dateRange: value as OrderFilters['dateRange'] }))
                    }
                  >
                    <SelectTrigger className="w-[130px] h-9">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="90days">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {ordersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-16 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                  <Package className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                  <h2 className="text-xl font-bold mb-2 text-neutral-900">
                    {orderFilters.status !== 'all' || orderFilters.search || orderFilters.dateRange !== 'all'
                      ? 'No matching orders'
                      : 'No orders yet'}
                  </h2>
                  <p className="text-neutral-500 mb-6 max-w-sm mx-auto">
                    {orderFilters.status !== 'all' || orderFilters.search || orderFilters.dateRange !== 'all'
                      ? 'Try adjusting your filters to see more orders.'
                      : 'You haven\'t placed any orders yet. Start exploring our collection today.'}
                  </p>
                  {orderFilters.status !== 'all' || orderFilters.search || orderFilters.dateRange !== 'all' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOrderFilters({ status: 'all', search: '', dateRange: 'all' });
                        setOrderSearchInput('');
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Link to={`/shop/${storeSlug}/products`}>
                      <Button
                        className="rounded-full px-8 py-6 font-bold shadow-lg hover:shadow-xl transition-all"
                        style={{ backgroundColor: store.primary_color }}
                      >
                        Start Shopping
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    storeId={store.id}
                    storeSlug={storeSlug!}
                    primaryColor={store.primary_color}
                    getStatusIcon={getStatusIcon}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wishlist Tab */}
        <TabsContent value="wishlist">
          <WishlistSection
            storeId={store.id}
            storeSlug={storeSlug!}
            primaryColor={store.primary_color}
            accentColor={accentColor}
          />
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <ProfileSection
            customerId={customerId!}
            storeId={store.id}
            tenantId={store.tenant_id}
            primaryColor={store.primary_color}
            onProfileUpdated={(name: string | null) => {
              setCustomerName(name);
              // Update localStorage with new name
              const saved = localStorage.getItem(`${STORAGE_KEYS.SHOP_CUSTOMER_PREFIX}${store.id}`);
              if (saved) {
                try {
                  const parsed = JSON.parse(saved);
                  parsed.first_name = name;
                  localStorage.setItem(`${STORAGE_KEYS.SHOP_CUSTOMER_PREFIX}${store.id}`, JSON.stringify(parsed));
                } catch { /* ignore */ }
              }
            }}
          />
        </TabsContent>

        {/* Track Order Tab */}
        <TabsContent value="track">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Track an Order</CardTitle>
              <CardDescription>
                Enter your order number or tracking code to see live updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md space-y-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="Order number or tracking code"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
                    className="h-12 text-lg"
                    aria-label="Order number or tracking code"
                  />
                  <Button
                    className="h-12 px-6 font-bold rounded-lg"
                    style={{ backgroundColor: store.primary_color }}
                    onClick={handleTrackOrder}
                    disabled={isTracking || !trackingNumber.trim()}
                  >
                    {isTracking ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Tracking...
                      </>
                    ) : (
                      'Track'
                    )}
                  </Button>
                </div>
                <p className="text-sm text-neutral-500">
                  You can find your order number in the confirmation email sent to you.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Wishlist Section Component
function WishlistSection({
  storeId,
  storeSlug,
  primaryColor,
  accentColor: _accentColor
}: {
  storeId: string;
  storeSlug: string;
  primaryColor: string;
  accentColor?: string;
}) {
  const { setCartItemCount } = useShop();

  // Get wishlist from localStorage with error handling
  let wishlistIds: string[] = [];
  try {
    wishlistIds = JSON.parse(localStorage.getItem(`${STORAGE_KEYS.SHOP_WISHLIST_PREFIX}${storeId}`) || '[]');
    if (!Array.isArray(wishlistIds)) wishlistIds = [];
  } catch {
    wishlistIds = [];
  }

  // Fetch wishlist products
  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.shopPages.wishlistProducts(storeId, wishlistIds),
    queryFn: async () => {
      if (wishlistIds.length === 0) return [];

      const { data, error } = await supabase
        .rpc('get_marketplace_products' as 'get_secret', { p_store_id: storeId } as Record<string, unknown>);

      if (error) throw error;
      const productsData = (data as unknown as Array<Record<string, unknown>>) ?? [];
      return productsData.filter((p) => wishlistIds.includes(p.product_id as string));
    },
    enabled: wishlistIds.length > 0,
  });

  // Remove from wishlist with error handling
  const removeFromWishlist = (productId: string) => {
    try {
      const newWishlist = wishlistIds.filter((id) => id !== productId);
      localStorage.setItem(`${STORAGE_KEYS.SHOP_WISHLIST_PREFIX}${storeId}`, JSON.stringify(newWishlist));
      refetch();
      toast.success('Removed from wishlist');
    } catch {
      toast.success('Removed from wishlist', { description: 'Changes may not persist' });
      refetch();
    }
  };

  // Add to cart with error handling
  const addToCart = (product: Record<string, unknown>) => {
    try {
      const cart = JSON.parse(localStorage.getItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${storeId}`) || '[]') as Array<Record<string, unknown>>;
      const existingIndex = cart.findIndex((item) => item.productId === product.product_id);

      if (existingIndex >= 0) {
        cart[existingIndex].quantity = (cart[existingIndex].quantity as number) + 1;
      } else {
        cart.push({
          productId: product.product_id,
          quantity: 1,
          price: product.display_price,
          name: product.name,
          imageUrl: product.image_url,
        });
      }

      localStorage.setItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${storeId}`, JSON.stringify(cart));
      setCartItemCount(cart.reduce((sum: number, item) => sum + (item.quantity as number), 0));
      toast.success('Added to cart');
    } catch (error) {
      logger.error('Failed to add to cart from wishlist', error);
      toast.error('Failed to add to cart', { description: humanizeError(error) });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>My Wishlist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl font-bold">
          <Heart className="w-6 h-6 text-red-500 fill-current" />
          My Wishlist ({products.length})
        </CardTitle>
        <CardDescription>
          Your curated collection of favorites
        </CardDescription>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-16 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
            <Heart className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
            <h2 className="text-xl font-bold mb-2 text-neutral-900">Your wishlist is empty</h2>
            <p className="text-neutral-500 mb-6 max-w-sm mx-auto">
              Save items you love by clicking the heart icon while shopping.
            </p>
            <Link to={`/shop/${storeSlug}/products`}>
              <Button
                className="rounded-full px-8 py-6 font-bold shadow-lg hover:shadow-xl transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                Browse Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {products.map((product) => (
              <div
                key={product.product_id as string}
                className="flex items-center gap-6 p-6 border border-neutral-100 dark:border-neutral-800 rounded-2xl bg-white dark:bg-zinc-950 hover:shadow-md transition-shadow group"
              >
                <Link to={`/shop/${storeSlug}/products/${product.product_id as string}`}>
                  <div className="w-24 h-24 bg-neutral-100 rounded-xl overflow-hidden flex-shrink-0 relative">
                    {product.image_url ? (
                      <img
                        src={product.image_url as string}
                        alt={product.name as string}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-neutral-300" />
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0 space-y-1">
                  <Link to={`/shop/${storeSlug}/products/${product.product_id as string}`}>
                    <h3 className="font-bold text-lg text-neutral-900 hover:text-neutral-700 transition-colors">{product.name as string}</h3>
                  </Link>
                  <p className="text-xl font-bold" style={{ color: primaryColor }}>
                    {formatCurrency(product.display_price as number)}
                  </p>
                  {!product.in_stock && (
                    <Badge variant="secondary" className="bg-neutral-100 text-neutral-500">Out of Stock</Badge>
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    size="lg"
                    className="font-bold rounded-full shadow-sm hover:shadow-md transition-all"
                    style={{ backgroundColor: primaryColor }}
                    disabled={!product.in_stock}
                    onClick={() => addToCart(product)}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add to Cart
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                    onClick={() => removeFromWishlist(product.product_id as string)}
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Order Card with Expandable Items - Flowhub style
function OrderCard({
  order,
  storeId,
  storeSlug,
  primaryColor,
  getStatusIcon,
  getStatusBadge
}: {
  order: CustomerOrder;
  storeId: string;
  storeSlug: string;
  primaryColor: string;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { setCartItemCount } = useShop();

  // Add individual item to cart
  const addItemToCart = (item: OrderItem) => {
    try {
      const cart = JSON.parse(localStorage.getItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${storeId}`) || '[]') as Array<Record<string, unknown>>;
      const existingIndex = cart.findIndex((c) => c.productId === item.product_id);

      if (existingIndex >= 0) {
        cart[existingIndex].quantity = (cart[existingIndex].quantity as number) + 1;
      } else {
        cart.push({
          productId: item.product_id,
          quantity: 1,
          price: item.price,
          name: item.name,
          imageUrl: item.image_url,
        });
      }

      localStorage.setItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${storeId}`, JSON.stringify(cart));
      setCartItemCount(cart.reduce((sum: number, c) => sum + (c.quantity as number), 0));

      toast.success('Added to bag!', { description: item.name });
    } catch (error) {
      logger.error('Failed to add item to cart', error);
      toast.error('Failed to add item', { description: humanizeError(error) });
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Order Header */}
        <div
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="flex-shrink-0">
              {getStatusIcon(order.status)}
            </div>
            <div className="min-w-0">
              <p className="font-medium">#{order.order_number}</p>
              <p className="text-sm text-muted-foreground">
                {formatSmartDate(order.created_at)} • {order.items?.length ?? 0} item
                {(order.items?.length ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold">{formatCurrency(order.total || order.total_amount || 0)}</p>
              <div className="mt-1">
                {getStatusBadge(order.status)}
              </div>
            </div>
            <ChevronRight
              className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        </div>

        {/* Expanded Items */}
        {isExpanded && order.items && order.items.length > 0 && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Order Items</p>
            {order.items.map((item: OrderItem, idx: number) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                {/* Item Image */}
                <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Qty: {item.quantity} × {formatCurrency(item.price)}
                  </p>
                </div>

                {/* Add to Bag Button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    addItemToCart(item);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            ))}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <QuickReorderButton
                order={order}
                storeId={storeId}
                primaryColor={primaryColor}
              />
              <Link to={`/shop/${storeSlug}/orders/${order.id}`}>
                <Button size="sm" variant="outline">
                  View Details
                </Button>
              </Link>
              {order.tracking_token && (
                <Link to={`/shop/${storeSlug}/track/${order.tracking_token}`}>
                  <Button size="sm" variant="ghost">
                    Track
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Quick Reorder Button Component
function QuickReorderButton({
  order,
  storeId,
  primaryColor: _primaryColor,
}: {
  order: CustomerOrder;
  storeId: string;
  primaryColor: string;
}) {
  const navigate = useNavigate();
  const { setCartItemCount } = useShop();
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [isReordering, setIsReordering] = useState(false);

  const handleReorder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsReordering(true);

    try {
      // Get current cart
      const cart = JSON.parse(localStorage.getItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${storeId}`) || '[]') as Array<Record<string, unknown>>;

      // Add order items to cart
      (order.items ?? []).forEach((item: OrderItem) => {
        const existingIndex = cart.findIndex((c) => c.productId === item.product_id);

        if (existingIndex >= 0) {
          cart[existingIndex].quantity = (cart[existingIndex].quantity as number) + item.quantity;
        } else {
          cart.push({
            productId: item.product_id,
            quantity: item.quantity,
            price: item.price,
            name: item.name,
            imageUrl: item.image_url,
          });
        }
      });

      // Save cart
      localStorage.setItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${storeId}`, JSON.stringify(cart));
      setCartItemCount(cart.reduce((sum: number, c) => sum + (c.quantity as number), 0));

      toast.success('Items added to cart', {
        description: `${(order.items?.length ?? 0) === 1 ? '1 item' : `${order.items?.length ?? 0} items`} from order ${order.order_number}`,
      });

      // Navigate to cart
      navigate(`/shop/${storeSlug}/cart`);
    } catch (error) {
      logger.error('Failed to reorder', error, { component: 'QuickReorderButton' });
      toast.error('Failed to reorder', { description: 'Please try again' });
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleReorder}
      disabled={isReordering}
      className="whitespace-nowrap"
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${isReordering ? 'animate-spin' : ''}`} />
      Reorder
    </Button>
  );
}

// Profile Section Component
interface ProfileFormData {
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  flavor_preferences: string[];
  preferred_strains: string[];
  preferred_products: string[];
  preferred_consumption_method: string[];
  thc_preference: string;
  cbd_preference: string;
}

function ProfileSection({
  customerId,
  storeId: _storeId,
  tenantId,
  primaryColor,
  onProfileUpdated,
}: {
  customerId: string;
  storeId: string;
  tenantId: string;
  primaryColor: string;
  onProfileUpdated: (name: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    flavor_preferences: [],
    preferred_strains: [],
    preferred_products: [],
    preferred_consumption_method: [],
    thc_preference: '',
    cbd_preference: '',
  });

  // Fetch customer profile
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.shopPages.customerProfile(customerId, tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('first_name, last_name, phone, address, city, state, zip_code, email, flavor_preferences, preferred_strains, preferred_products, preferred_consumption_method, thc_preference, cbd_preference, loyalty_points, loyalty_tier, total_spent, created_at')
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch customer profile', error, { component: 'ProfileSection' });
        throw error;
      }
      return data;
    },
    enabled: !!customerId && !!tenantId,
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
        flavor_preferences: profile.flavor_preferences ?? [],
        preferred_strains: profile.preferred_strains ?? [],
        preferred_products: profile.preferred_products ?? [],
        preferred_consumption_method: profile.preferred_consumption_method ?? [],
        thc_preference: profile.thc_preference ?? '',
        cbd_preference: profile.cbd_preference ?? '',
      });
    }
  }, [profile]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
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
          flavor_preferences: data.flavor_preferences.filter(Boolean),
          preferred_strains: data.preferred_strains.filter(Boolean),
          preferred_products: data.preferred_products.filter(Boolean),
          preferred_consumption_method: data.preferred_consumption_method.filter(Boolean),
          thc_preference: data.thc_preference.trim() || null,
          cbd_preference: data.cbd_preference.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.shopPages.customerProfile(customerId, tenantId) });
      setIsEditing(false);
      onProfileUpdated(formData.first_name.trim() || null);
    },
    onError: (error) => {
      logger.error('Failed to update profile', error, { component: 'ProfileSection' });
      toast.error('Failed to update profile', { description: 'Please try again.' });
    },
  });

  const handleSave = () => {
    if (!formData.first_name.trim()) {
      toast.error('First name is required');
      return;
    }
    updateProfileMutation.mutate(formData);
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
        flavor_preferences: profile.flavor_preferences ?? [],
        preferred_strains: profile.preferred_strains ?? [],
        preferred_products: profile.preferred_products ?? [],
        preferred_consumption_method: profile.preferred_consumption_method ?? [],
        thc_preference: profile.thc_preference ?? '',
        cbd_preference: profile.cbd_preference ?? '',
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <User className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <p className="text-neutral-500">Profile not found. Place an order to create your profile.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">My Profile</CardTitle>
            <CardDescription>Manage your personal information and delivery address</CardDescription>
          </div>
          {!isEditing && (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="rounded-full px-6"
            >
              <UserPen className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-w-lg space-y-6">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              {isEditing ? (
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                  placeholder="First name"
                  className="h-11"
                />
              ) : (
                <p className="text-base py-2 px-3 bg-neutral-50 rounded-lg min-h-[44px] flex items-center">
                  {profile.first_name || '—'}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              {isEditing ? (
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Last name"
                  className="h-11"
                />
              ) : (
                <p className="text-base py-2 px-3 bg-neutral-50 rounded-lg min-h-[44px] flex items-center">
                  {profile.last_name || '—'}
                </p>
              )}
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>Email</Label>
            <p className="text-base py-2 px-3 bg-neutral-50 rounded-lg min-h-[44px] flex items-center text-neutral-500">
              {profile.email}
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            {isEditing ? (
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
                className="h-11"
              />
            ) : (
              <p className="text-base py-2 px-3 bg-neutral-50 rounded-lg min-h-[44px] flex items-center">
                {formatPhoneNumber(profile.phone)}
              </p>
            )}
          </div>

          <Separator />

          {/* Address */}
          <div className="space-y-4">
            <h2 className="font-semibold text-neutral-900">Delivery Address</h2>

            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              {isEditing ? (
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Main St"
                  className="h-11"
                />
              ) : (
                <p className="text-base py-2 px-3 bg-neutral-50 rounded-lg min-h-[44px] flex items-center">
                  {profile.address || '—'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                {isEditing ? (
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="City"
                    className="h-11"
                  />
                ) : (
                  <p className="text-base py-2 px-3 bg-neutral-50 rounded-lg min-h-[44px] flex items-center">
                    {profile.city || '—'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                {isEditing ? (
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                    placeholder="State"
                    className="h-11"
                  />
                ) : (
                  <p className="text-base py-2 px-3 bg-neutral-50 rounded-lg min-h-[44px] flex items-center">
                    {profile.state || '—'}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">ZIP Code</Label>
                {isEditing ? (
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => setFormData((prev) => ({ ...prev, zip_code: e.target.value }))}
                    placeholder="12345"
                    className="h-11"
                  />
                ) : (
                  <p className="text-base py-2 px-3 bg-neutral-50 rounded-lg min-h-[44px] flex items-center">
                    {profile.zip_code || '—'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Preferences */}
          <div className="space-y-4">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Leaf className="w-4 h-4" />
              Preferences
            </h3>

            {isEditing ? (
              <PreferencesEditFields formData={formData} setFormData={setFormData} />
            ) : (
              <PreferencesDisplay
                flavorPreferences={profile.flavor_preferences}
                preferredStrains={profile.preferred_strains}
                preferredProducts={profile.preferred_products}
                preferredConsumptionMethod={profile.preferred_consumption_method}
                thcPreference={profile.thc_preference}
                cbdPreference={profile.cbd_preference}
              />
            )}
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-3 pt-4">
              <Button
                className="font-bold rounded-lg px-8"
                style={{ backgroundColor: primaryColor }}
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
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
                className="rounded-lg px-6"
                onClick={handleCancel}
                disabled={updateProfileMutation.isPending}
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

// Preferences Display Component (read-only view)
interface PreferencesDisplayProps {
  flavorPreferences: string[] | null;
  preferredStrains: string[] | null;
  preferredProducts: string[] | null;
  preferredConsumptionMethod: string[] | null;
  thcPreference: string | null;
  cbdPreference: string | null;
}

function PreferencesDisplay({
  flavorPreferences,
  preferredStrains,
  preferredProducts,
  preferredConsumptionMethod,
  thcPreference,
  cbdPreference,
}: PreferencesDisplayProps) {
  const hasAnyPreference =
    (flavorPreferences && flavorPreferences.length > 0) ||
    (preferredStrains && preferredStrains.length > 0) ||
    (preferredProducts && preferredProducts.length > 0) ||
    (preferredConsumptionMethod && preferredConsumptionMethod.length > 0) ||
    thcPreference ||
    cbdPreference;

  if (!hasAnyPreference) {
    return (
      <p className="text-sm text-neutral-400 py-2">
        No preferences set yet. Edit your profile to add your preferences.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {flavorPreferences && flavorPreferences.length > 0 && (
        <PreferenceBadgeRow label="Flavors" items={flavorPreferences} />
      )}
      {preferredStrains && preferredStrains.length > 0 && (
        <PreferenceBadgeRow label="Strains" items={preferredStrains} />
      )}
      {preferredProducts && preferredProducts.length > 0 && (
        <PreferenceBadgeRow label="Products" items={preferredProducts} />
      )}
      {preferredConsumptionMethod && preferredConsumptionMethod.length > 0 && (
        <PreferenceBadgeRow label="Consumption" items={preferredConsumptionMethod} />
      )}
      {(thcPreference || cbdPreference) && (
        <div className="flex flex-wrap gap-3">
          {thcPreference && (
            <div className="text-sm">
              <span className="text-neutral-500">THC: </span>
              <span className="font-medium">{thcPreference}</span>
            </div>
          )}
          {cbdPreference && (
            <div className="text-sm">
              <span className="text-neutral-500">CBD: </span>
              <span className="font-medium">{cbdPreference}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreferenceBadgeRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="text-xs font-normal">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// Preferences Edit Fields Component
interface PreferencesEditFieldsProps {
  formData: ProfileFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProfileFormData>>;
}

function PreferencesEditFields({ formData, setFormData }: PreferencesEditFieldsProps) {
  const handleArrayChange = (field: keyof ProfileFormData, value: string) => {
    const items = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setFormData((prev) => ({ ...prev, [field]: items }));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="flavor_preferences">Flavor Preferences</Label>
        <Input
          id="flavor_preferences"
          value={formData.flavor_preferences.join(', ')}
          onChange={(e) => handleArrayChange('flavor_preferences', e.target.value)}
          placeholder="e.g. Citrus, Berry, Earthy"
          className="h-11"
        />
        <p className="text-xs text-neutral-400">Separate with commas</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="preferred_strains">Preferred Strains</Label>
        <Input
          id="preferred_strains"
          value={formData.preferred_strains.join(', ')}
          onChange={(e) => handleArrayChange('preferred_strains', e.target.value)}
          placeholder="e.g. Blue Dream, OG Kush"
          className="h-11"
        />
        <p className="text-xs text-neutral-400">Separate with commas</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="preferred_products">Preferred Products</Label>
        <Input
          id="preferred_products"
          value={formData.preferred_products.join(', ')}
          onChange={(e) => handleArrayChange('preferred_products', e.target.value)}
          placeholder="e.g. Flower, Edibles, Concentrates"
          className="h-11"
        />
        <p className="text-xs text-neutral-400">Separate with commas</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="preferred_consumption_method">Consumption Methods</Label>
        <Input
          id="preferred_consumption_method"
          value={formData.preferred_consumption_method.join(', ')}
          onChange={(e) => handleArrayChange('preferred_consumption_method', e.target.value)}
          placeholder="e.g. Smoking, Vaping, Edibles"
          className="h-11"
        />
        <p className="text-xs text-neutral-400">Separate with commas</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="thc_preference">THC Preference</Label>
          <Input
            id="thc_preference"
            value={formData.thc_preference}
            onChange={(e) => setFormData((prev) => ({ ...prev, thc_preference: e.target.value }))}
            placeholder="e.g. High, Medium, Low"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cbd_preference">CBD Preference</Label>
          <Input
            id="cbd_preference"
            value={formData.cbd_preference}
            onChange={(e) => setFormData((prev) => ({ ...prev, cbd_preference: e.target.value }))}
            placeholder="e.g. High, Medium, Low"
            className="h-11"
          />
        </div>
      </div>
    </div>
  );
}
