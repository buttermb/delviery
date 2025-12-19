/**
 * Account Page
 * Customer account management and order history
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Package,
  MapPin,
  Settings,
  LogOut,
  Search,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Heart,
  RefreshCw,
  ShoppingCart,
  Trash2
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { logger } from '@/lib/logger';

interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount?: number;
  total?: number;
  items?: any[];
  created_at: string;
  tracking_token?: string;
}

export default function AccountPage() {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const { store } = useShop();
  const { isLuxuryTheme, accentColor, cardBg, cardBorder, textMuted } = useLuxuryTheme();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

  // Check if customer is logged in (from localStorage)
  useEffect(() => {
    if (store?.id) {
      const savedCustomer = localStorage.getItem(`shop_customer_${store.id}`);
      if (savedCustomer) {
        try {
          const customer = JSON.parse(savedCustomer);
          setCustomerId(customer.id);
          setEmail(customer.email);
          setIsLoggedIn(true);
        } catch {
          // Invalid data
        }
      }
    }
  }, [store?.id]);

  // Fetch customer orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', store?.id, customerId],
    queryFn: async (): Promise<CustomerOrder[]> => {
      if (!store?.id || !customerId) return [];

      // @ts-ignore - Supabase types issue with marketplace_orders
      const { data, error } = await supabase
        .from('marketplace_orders')
        .select('*')
        .eq('store_id', store.id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as unknown as CustomerOrder[]) || [];
    },
    enabled: !!store?.id && !!customerId,
  });

  // Quick login/lookup by email
  const handleEmailLookup = async () => {
    if (!email || !store?.id) return;

    const { data, error } = await supabase
      .rpc('get_marketplace_customer_by_email' as any, {
        p_store_id: store.id,
        p_email: email.trim()
      });

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      toast({
        title: 'Account not found',
        description: 'No account found with this email. Please check the email or place an order first.',
        variant: 'destructive',
      });
      return;
    }

    const customer = Array.isArray(data) ? data[0] : data;

    // Save to localStorage
    localStorage.setItem(`shop_customer_${store.id}`, JSON.stringify(customer));
    setCustomerId(customer.id);
    setIsLoggedIn(true);
    toast({ title: `Welcome back, ${customer.first_name || 'Customer'}!` });
  };

  // Track order by number
  const handleTrackOrder = async () => {
    if (!trackingNumber.trim()) return;

    // Try tracking token first
    const { data } = await supabase
      .from('marketplace_orders')
      .select('tracking_token')
      .eq('store_id', store?.id)
      .or(`tracking_token.eq.${trackingNumber.trim()},order_number.eq.${trackingNumber.trim().toUpperCase()}`)
      .maybeSingle();

    const orderData = data as any;

    if (orderData?.tracking_token) {
      navigate(`/shop/${storeSlug}/track/${orderData.tracking_token}`);
    } else {
      toast({
        title: 'Order not found',
        description: 'Please check your order number and try again.',
        variant: 'destructive',
      });
    }
  };

  // Logout
  const handleLogout = () => {
    if (store?.id) {
      localStorage.removeItem(`shop_customer_${store.id}`);
    }
    setIsLoggedIn(false);
    setCustomerId(null);
    setEmail('');
    toast({ title: 'Logged out successfully' });
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
      refunded: 'bg-gray-100 text-gray-800',
    };
    return (
      <Badge variant="outline" className={colors[status] || ''}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (!store) return null;

  // Not logged in view
  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: `${store.primary_color}15` }}
            >
              <User className="w-8 h-8" style={{ color: store.primary_color }} />
            </div>
            <CardTitle>Your Account</CardTitle>
            <CardDescription>
              Enter your email to view orders and manage your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailLookup()}
                />
              </div>
              <Button
                className="w-full"
                style={{ backgroundColor: store.primary_color }}
                onClick={handleEmailLookup}
              >
                View My Orders
              </Button>
            </div>

            <Separator />

            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Or track an order by number
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Order # or tracking code"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
                />
                <Button variant="outline" onClick={handleTrackOrder}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Don't have an account yet?
              </p>
              <Link to={`/shop/${storeSlug}/products`}>
                <Button variant="outline">Start Shopping</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged in view
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Account</h1>
          <p className="text-muted-foreground">{email}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
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
          <TabsTrigger value="track">
            <Search className="w-4 h-4 mr-2" />
            Track Order
          </TabsTrigger>
        </TabsList>

        {/* Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
              <CardDescription>
                View and track your past orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">No orders yet</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't placed any orders yet.
                  </p>
                  <Link to={`/shop/${storeSlug}/products`}>
                    <Button style={{ backgroundColor: store.primary_color }}>
                      Start Shopping
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card key={order.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/shop/${storeSlug}/track/${order.tracking_token}`}
                            className="flex items-center gap-4 flex-1"
                          >
                            {getStatusIcon(order.status)}
                            <div>
                              <p className="font-medium">{order.order_number}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatSmartDate(order.created_at)} • {order.items?.length || 0} item
                                {(order.items?.length || 0) !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(order.total || order.total_amount || 0)}</p>
                              {getStatusBadge(order.status)}
                            </div>
                            <QuickReorderButton
                              order={order}
                              storeId={store.id}
                              primaryColor={store.primary_color}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wishlist Tab */}
        <TabsContent value="wishlist">
          <WishlistSection storeId={store.id} storeSlug={storeSlug!} primaryColor={store.primary_color} />
        </TabsContent>

        {/* Track Order Tab */}
        <TabsContent value="track">
          <Card>
            <CardHeader>
              <CardTitle>Track an Order</CardTitle>
              <CardDescription>
                Enter your order number or tracking code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-md mx-auto space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Order number or tracking code"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
                  />
                  <Button
                    style={{ backgroundColor: store.primary_color }}
                    onClick={handleTrackOrder}
                  >
                    Track
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  You can find your order number in the confirmation email
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
  primaryColor
}: {
  storeId: string;
  storeSlug: string;
  primaryColor: string;
}) {
  const { toast } = useToast();
  const { setCartItemCount } = useShop();

  // Get wishlist from localStorage with error handling
  let wishlistIds: string[] = [];
  try {
    wishlistIds = JSON.parse(localStorage.getItem(`shop_wishlist_${storeId}`) || '[]');
    if (!Array.isArray(wishlistIds)) wishlistIds = [];
  } catch {
    wishlistIds = [];
  }

  // Fetch wishlist products
  const { data: products = [], isLoading, refetch } = useQuery({
    queryKey: ['wishlist-products', storeId, wishlistIds],
    queryFn: async () => {
      if (wishlistIds.length === 0) return [];

      const { data, error } = await supabase
        .rpc('get_marketplace_products' as any, { p_store_id: storeId });

      if (error) throw error;
      const productsData = data as any[] || [];
      return productsData.filter((p: any) => wishlistIds.includes(p.product_id));
    },
    enabled: wishlistIds.length > 0,
  });

  // Remove from wishlist with error handling
  const removeFromWishlist = (productId: string) => {
    try {
      const newWishlist = wishlistIds.filter((id) => id !== productId);
      localStorage.setItem(`shop_wishlist_${storeId}`, JSON.stringify(newWishlist));
      refetch();
      toast({ title: 'Removed from wishlist' });
    } catch {
      toast({ title: 'Removed from wishlist', description: 'Changes may not persist' });
      refetch();
    }
  };

  // Add to cart with error handling
  const addToCart = (product: any) => {
    try {
      const cart = JSON.parse(localStorage.getItem(`shop_cart_${storeId}`) || '[]');
      const existingIndex = cart.findIndex((item: any) => item.productId === product.product_id);

      if (existingIndex >= 0) {
        cart[existingIndex].quantity += 1;
      } else {
        cart.push({
          productId: product.product_id,
          quantity: 1,
          price: product.display_price,
          name: product.name,
          imageUrl: product.image_url,
        });
      }

      localStorage.setItem(`shop_cart_${storeId}`, JSON.stringify(cart));
      setCartItemCount(cart.reduce((sum: number, item: any) => sum + item.quantity, 0));
      toast({ title: 'Added to cart' });
    } catch (error) {
      logger.error('Failed to add to cart from wishlist', error);
      toast({ title: 'Failed to add to cart', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Wishlist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5" />
          My Wishlist ({products.length})
        </CardTitle>
        <CardDescription>
          Items you've saved for later
        </CardDescription>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Your wishlist is empty</h3>
            <p className="text-muted-foreground mb-4">
              Save items you love by clicking the heart icon
            </p>
            <Link to={`/shop/${storeSlug}/products`}>
              <Button style={{ backgroundColor: primaryColor }}>
                Browse Products
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product: any) => (
              <div
                key={product.product_id}
                className="flex items-center gap-4 p-4 border rounded-lg"
              >
                <Link to={`/shop/${storeSlug}/products/${product.product_id}`}>
                  <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/shop/${storeSlug}/products/${product.product_id}`}>
                    <h4 className="font-medium hover:underline">{product.name}</h4>
                  </Link>
                  <p className="text-lg font-bold" style={{ color: primaryColor }}>
                    {formatCurrency(product.display_price)}
                  </p>
                  {!product.in_stock && (
                    <Badge variant="secondary">Out of Stock</Badge>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    style={{ backgroundColor: primaryColor }}
                    disabled={!product.in_stock}
                    onClick={() => addToCart(product)}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add to Cart
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removeFromWishlist(product.product_id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
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

// Quick Reorder Button Component
function QuickReorderButton({
  order,
  storeId,
  primaryColor,
}: {
  order: CustomerOrder;
  storeId: string;
  primaryColor: string;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setCartItemCount } = useShop();
  const { storeSlug } = useParams();
  const [isReordering, setIsReordering] = useState(false);

  const handleReorder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsReordering(true);

    try {
      // Get current cart
      const cart = JSON.parse(localStorage.getItem(`shop_cart_${storeId}`) || '[]');

      // Add order items to cart
      (order.items || []).forEach((item: any) => {
        const existingIndex = cart.findIndex((c: any) => c.productId === item.product_id);

        if (existingIndex >= 0) {
          cart[existingIndex].quantity += item.quantity;
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
      localStorage.setItem(`shop_cart_${storeId}`, JSON.stringify(cart));
      setCartItemCount(cart.reduce((sum: number, c: any) => sum + c.quantity, 0));

      toast({
        title: 'Items added to cart',
        description: `${order.items?.length || 0} item(s) from order ${order.order_number}`,
      });

      // Navigate to cart
      navigate(`/shop/${storeSlug}/cart`);
    } catch (error) {
      logger.error('Failed to reorder', error, { component: 'QuickReorderButton' });
      toast({
        title: 'Failed to reorder',
        description: 'Please try again',
        variant: 'destructive',
      });
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





