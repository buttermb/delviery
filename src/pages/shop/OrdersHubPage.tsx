/**
 * Storefront Orders Hub Page
 * Displays customer orders with filtering, search, and quick actions
 * Hub-style layout inspired by admin orders hub
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useShop } from './ShopLayout';
import { useStorefrontOrders, type OrderStatusFilter, type OrderFilters } from '@/hooks/useStorefrontOrders';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { STORAGE_KEYS } from '@/constants/storageKeys';
import {
  Package,
  Search,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Calendar,
  Truck,
  User,
  Receipt
} from 'lucide-react';

interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount?: number;
  total?: number;
  items?: Array<{
    product_id: string;
    name: string;
    quantity: number;
    price: number;
    image_url?: string | null;
  }>;
  created_at: string;
  tracking_token?: string;
}

const STATUS_TABS = [
  { id: 'all', label: 'All Orders', icon: Package },
  { id: 'active', label: 'Active', icon: Clock },
  { id: 'completed', label: 'Delivered', icon: CheckCircle },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  confirmed: 'bg-info/10 text-info border-info/20',
  preparing: 'bg-primary/10 text-primary border-primary/20',
  ready: 'bg-primary/10 text-primary border-primary/20',
  out_for_delivery: 'bg-warning/10 text-warning border-warning/20',
  delivered: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  refunded: 'bg-muted text-muted-foreground border-border',
};

export function OrdersHubPage() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const navigate = useNavigate();
  const { store, setCartItemCount } = useShop();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Order filters state
  const [orderFilters, setOrderFilters] = useState<OrderFilters>({
    status: 'all',
    search: '',
    dateRange: 'all',
  });
  const [orderSearchInput, setOrderSearchInput] = useState('');

  // Check if customer is logged in
  useEffect(() => {
    if (store?.id) {
      const savedCustomer = localStorage.getItem(`${STORAGE_KEYS.SHOP_CUSTOMER_PREFIX}${store.id}`);
      if (savedCustomer) {
        try {
          const customer = JSON.parse(savedCustomer);
          setCustomerId(customer.id);
          setIsLoggedIn(true);
        } catch {
          setIsLoggedIn(false);
        }
      }
    }
  }, [store?.id]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setOrderFilters((prev) => ({ ...prev, search: orderSearchInput }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [orderSearchInput]);

  // Fetch orders
  const { orders, isLoading, orderStats } = useStorefrontOrders({
    storeId: store?.id,
    customerId,
    filters: orderFilters,
  });

  const handleTabChange = (tab: string) => {
    setOrderFilters((prev) => ({ ...prev, status: tab as OrderStatusFilter }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'cancelled':
      case 'refunded':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'out_for_delivery':
        return <Truck className="w-4 h-4 text-warning" />;
      default:
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant="outline" className={STATUS_COLORS[status] || 'bg-muted text-muted-foreground'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  // Add items from order to cart
  const handleReorder = (order: CustomerOrder) => {
    if (!order.items || !store?.id) return;

    try {
      const cart = JSON.parse(localStorage.getItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${store.id}`) || '[]');

      order.items.forEach((item) => {
        const existingIndex = cart.findIndex((c: { productId: string }) => c.productId === item.product_id);
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

      localStorage.setItem(`${STORAGE_KEYS.SHOP_CART_PREFIX}${store.id}`, JSON.stringify(cart));
      setCartItemCount(cart.reduce((sum: number, c: { quantity: number }) => sum + c.quantity, 0));

      toast.success('Items added to cart', { description: `${order.items.length} ${order.items.length === 1 ? 'item' : 'items'} from order #${order.order_number}` });
      navigate(`/shop/${storeSlug}/cart`);
    } catch (error) {
      logger.error('Failed to reorder', error);
      toast.error('Failed to reorder', { description: humanizeError(error) });
    }
  };

  if (!store) return null;

  // Not logged in - redirect to account page
  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-none shadow-xl rounded-3xl overflow-hidden bg-card">
          <CardHeader className="text-center pb-2 pt-8">
            <div
              className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center shadow-inner"
              style={{ backgroundColor: `${store.primary_color}10` }}
            >
              <Package className="w-10 h-10" style={{ color: store.primary_color }} />
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight text-foreground">
              View Your Orders
            </CardTitle>
            <CardDescription className="text-muted-foreground text-base mt-2">
              Sign in to view your order history and track deliveries
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Link to={`/shop/${storeSlug}/account`}>
              <Button
                className="w-full h-14 text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                style={{ backgroundColor: store.primary_color }}
              >
                <User className="w-5 h-5 mr-2" />
                Sign In to View Orders
              </Button>
            </Link>
            <div className="mt-6 text-center">
              <Link to={`/shop/${storeSlug}/products`}>
                <Button variant="ghost" className="font-semibold text-muted-foreground">
                  Continue Shopping
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 min-h-dvh bg-shop-bg">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link to={`/shop/${storeSlug}`} className="hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">Orders</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl shadow-sm border border-border">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              <Receipt className="w-8 h-8" style={{ color: store.primary_color }} />
              My Orders
            </h1>
            <p className="text-muted-foreground mt-1">
              {orderStats.total > 0 ? (
                <>
                  {orderStats.total} order{orderStats.total !== 1 ? 's' : ''} &bull;{' '}
                  <span className="font-semibold">{formatCurrency(orderStats.totalSpent)}</span> spent
                </>
              ) : (
                'View and track your orders'
              )}
            </p>
          </div>

          {/* Stats badges */}
          {orderStats.total > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                <Clock className="w-3 h-3 mr-1" />
                {orderStats.active} active
              </Badge>
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                <CheckCircle className="w-3 h-3 mr-1" />
                {orderStats.completed} delivered
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Filters and Tabs */}
      <Tabs value={orderFilters.status} onValueChange={handleTabChange} className="space-y-6">
        <div className="bg-card p-4 rounded-2xl shadow-sm border border-border">
          {/* Tab navigation */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <TabsList className="flex-wrap bg-muted/50">
              {STATUS_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 data-[state=active]:bg-card"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.id === 'active' && orderStats.active > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-warning/10 text-warning text-xs">
                      {orderStats.active}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Search and filters */}
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order # or product..."
                  value={orderSearchInput}
                  onChange={(e) => setOrderSearchInput(e.target.value)}
                  className="pl-9 h-10"
                  aria-label="Search orders"
                />
              </div>
              <Select
                value={orderFilters.dateRange}
                onValueChange={(value) =>
                  setOrderFilters((prev) => ({ ...prev, dateRange: value as OrderFilters['dateRange'] }))
                }
              >
                <SelectTrigger className="w-[140px] h-10">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
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
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-none shadow-sm">
                  <CardContent className="p-6">
                    <Skeleton className="h-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <Card className="border-none shadow-sm">
              <CardContent className="py-16">
                <div className="text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-xl font-bold mb-2 text-foreground">
                    {orderFilters.status !== 'all' || orderFilters.search || orderFilters.dateRange !== 'all'
                      ? 'No matching orders'
                      : 'No orders yet'}
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    {orderFilters.status !== 'all' || orderFilters.search || orderFilters.dateRange !== 'all'
                      ? 'Try adjusting your filters to see more orders.'
                      : "You haven't placed any orders yet. Start exploring our collection today."}
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
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                storeSlug={storeSlug!}
                primaryColor={store.primary_color}
                getStatusIcon={getStatusIcon}
                getStatusBadge={getStatusBadge}
                onReorder={() => handleReorder(order)}
              />
            ))
          )}
        </div>
      </Tabs>
    </div>
  );
}

// Order Card Component
function OrderCard({
  order,
  storeSlug,
  primaryColor,
  getStatusIcon,
  getStatusBadge,
  onReorder,
}: {
  order: CustomerOrder;
  storeSlug: string;
  primaryColor: string;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadge: (status: string) => React.ReactNode;
  onReorder: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-shadow bg-card">
      <CardContent className="p-0">
        {/* Order Header */}
        <div
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-4 flex-1">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${primaryColor}10` }}
            >
              {getStatusIcon(order.status)}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-foreground">{`#${order.order_number}`}</p>
              <p className="text-sm text-muted-foreground">
                {formatSmartDate(order.created_at)} &bull; {order.items?.length ?? 0} item
                {(order.items?.length ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-bold text-lg" style={{ color: primaryColor }}>
                {formatCurrency(order.total || order.total_amount || 0)}
              </p>
              <div className="mt-1">{getStatusBadge(order.status)}</div>
            </div>
            <ChevronRight
              className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t border-border p-5 bg-muted/50">
            {/* Order Items */}
            {order.items && order.items.length > 0 && (
              <div className="space-y-3 mb-4">
                <p className="text-sm font-semibold text-muted-foreground">Order Items</p>
                {order.items.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty: {item.quantity} &times; {formatCurrency(item.price)}
                      </p>
                    </div>
                    <p className="font-semibold text-sm">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Link to={`/shop/${storeSlug}/orders/${order.id}`}>
                <Button size="sm" variant="outline" className="rounded-lg">
                  View Details
                </Button>
              </Link>
              {order.tracking_token && (
                <Link to={`/shop/${storeSlug}/track/${order.tracking_token}`}>
                  <Button
                    size="sm"
                    className="rounded-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Track Order
                  </Button>
                </Link>
              )}
              <Button size="sm" variant="outline" className="rounded-lg" onClick={onReorder}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reorder
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
