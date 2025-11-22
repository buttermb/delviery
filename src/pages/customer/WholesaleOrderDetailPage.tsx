import { logger } from '@/lib/logger';
/**
 * Wholesale Order Detail Page
 * B2B customers can view detailed information about a specific wholesale order
 */

import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  ShoppingCart, 
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  Clock,
  Building2,
  MapPin,
  DollarSign,
  FileText
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { ModeBanner } from '@/components/customer/ModeSwitcher';
import { useState as useReactState, useEffect } from 'react';
import { STORAGE_KEYS, safeStorage } from '@/constants/storageKeys';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type CustomerMode = 'retail' | 'wholesale';

export default function WholesaleOrderDetailPage() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>();
  const { customer, tenant } = useCustomerAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useReactState<CustomerMode>('wholesale');

  // Load saved mode preference
  useEffect(() => {
    try {
      const savedMode = safeStorage.getItem(STORAGE_KEYS.CUSTOMER_MODE as any) as CustomerMode | null;
      if (savedMode && (savedMode === 'retail' || savedMode === 'wholesale')) {
        setMode(savedMode);
      }
    } catch (error) {
      // Ignore storage errors
    }
  }, [setMode]);

  // Fetch order details
  const { data: order, isLoading } = useQuery({
    queryKey: ['marketplace-order-detail-customer', orderId],
    queryFn: async () => {
      if (!orderId) return null;

      const { data, error } = await supabase
        .from('marketplace_orders')
        .select(`
          *,
          marketplace_order_items (*),
          marketplace_profiles!seller_profile_id (
            id,
            business_name,
            license_verified
          )
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch order', error, { component: 'WholesaleOrderDetailPage', orderId });
        throw error;
      }

      return data;
    },
    enabled: !!orderId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'accepted':
        return (
          <Badge className="bg-info/20 text-info border-info/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <Package className="h-3 w-3 mr-1" />
            Processing
          </Badge>
        );
      case 'shipped':
        return (
          <Badge className="bg-info/20 text-info border-info/30">
            <Truck className="h-3 w-3 mr-1" />
            Shipped
          </Badge>
        );
      case 'delivered':
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <CheckCircle className="h-3 w-3 mr-1" />
            Delivered
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            Paid
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            Pending
          </Badge>
        );
      case 'partial':
        return (
          <Badge className="bg-info/20 text-info border-info/30">
            Partial
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            Overdue
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-16 lg:pb-0">
        <div className="bg-primary/5 border-b border-primary/20">
          <div className="container mx-auto px-4 py-4">
            <ModeBanner currentMode={mode} onModeChange={setMode} />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background pb-16 lg:pb-0">
        <div className="bg-primary/5 border-b border-primary/20">
          <div className="container mx-auto px-4 py-4">
            <ModeBanner currentMode={mode} onModeChange={setMode} />
          </div>
        </div>
        <div className="container mx-auto px-4 py-6">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Order Not Found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  The order you're looking for doesn't exist or has been removed.
                </p>
                <Button onClick={() => navigate(`/${slug}/shop/wholesale/orders`)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Orders
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const orderItems = Array.isArray(order.marketplace_order_items) 
    ? order.marketplace_order_items 
    : [];

  const sellerProfile = order.marketplace_profiles;
  const shippingAddress = order.shipping_address as {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  } || {};

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      {/* Mode Banner */}
      <div className="bg-primary/5 border-b border-primary/20">
        <div className="container mx-auto px-4 py-4">
          <ModeBanner currentMode={mode} onModeChange={setMode} />
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/${slug}/shop/wholesale/orders`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              Order {order.order_number}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatSmartDate(order.created_at as string)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(order.status || 'pending')}
            {getPaymentStatusBadge(order.payment_status || 'pending')}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      orderItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell>{item.quantity} {item.unit_type || 'unit'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(item.unit_price) || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(item.total_price) || 0)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Shipping Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Shipping Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Shipping Address</div>
                  <div className="text-sm">
                    {shippingAddress.street && <div>{shippingAddress.street}</div>}
                    {shippingAddress.city && shippingAddress.state && (
                      <div>
                        {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                      </div>
                    )}
                    {shippingAddress.country && <div>{shippingAddress.country}</div>}
                  </div>
                </div>
                {order.shipping_method && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Shipping Method</div>
                    <div className="text-sm">{order.shipping_method}</div>
                  </div>
                )}
                {order.tracking_number && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Tracking Number</div>
                    <div className="text-sm font-mono">{order.tracking_number}</div>
                    {order.tracking_number && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          // Open tracking in new tab (generic tracking URL - could be customized)
                          window.open(`https://www.google.com/search?q=${encodeURIComponent(order.tracking_number)}`, '_blank');
                        }}
                      >
                        Track Package
                      </Button>
                    )}
                  </div>
                )}
                {order.shipped_at && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Shipped At</div>
                    <div className="text-sm">{formatSmartDate(order.shipped_at as string)}</div>
                  </div>
                )}
                {order.delivered_at && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Delivered At</div>
                    <div className="text-sm">{formatSmartDate(order.delivered_at as string)}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {(order.buyer_notes || order.seller_notes) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {order.buyer_notes && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Your Notes</div>
                      <p className="text-sm">{order.buyer_notes}</p>
                    </div>
                  )}
                  {order.seller_notes && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Seller Notes</div>
                      <p className="text-sm">{order.seller_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Seller Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Seller Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="font-medium">{sellerProfile?.business_name || 'Unknown Seller'}</div>
                    {sellerProfile?.license_verified && (
                      <Badge variant="outline" className="border-success/30 text-success text-xs mt-1">
                        Verified License
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(Number(order.subtotal) || 0)}</span>
                </div>
                {Number(order.platform_fee) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Platform Fee (2%)</span>
                    <span className="font-medium">{formatCurrency(Number(order.platform_fee) || 0)}</span>
                  </div>
                )}
                {Number(order.shipping_cost) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">{formatCurrency(Number(order.shipping_cost) || 0)}</span>
                  </div>
                )}
                {Number(order.tax) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">{formatCurrency(Number(order.tax) || 0)}</span>
                  </div>
                )}
                <div className="pt-3 border-t flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(Number(order.total_amount) || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Payment Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Payment Status</div>
                  <div className="mt-1">
                    {getPaymentStatusBadge(order.payment_status || 'pending')}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Payment Terms</div>
                  <div className="text-sm capitalize">{order.payment_terms || 'Prepaid'}</div>
                </div>
                {order.confirmed_at && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Confirmed At</div>
                    <div className="text-sm">{formatSmartDate(order.confirmed_at as string)}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Order Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Order Placed</div>
                    <div className="text-xs text-muted-foreground">{formatSmartDate(order.created_at as string)}</div>
                  </div>
                </div>
                {order.confirmed_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <div>
                      <div className="font-medium">Order Confirmed</div>
                      <div className="text-xs text-muted-foreground">{formatSmartDate(order.confirmed_at as string)}</div>
                    </div>
                  </div>
                )}
                {order.shipped_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-info" />
                    <div>
                      <div className="font-medium">Order Shipped</div>
                      <div className="text-xs text-muted-foreground">{formatSmartDate(order.shipped_at as string)}</div>
                    </div>
                  </div>
                )}
                {order.delivered_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <div>
                      <div className="font-medium">Order Delivered</div>
                      <div className="text-xs text-muted-foreground">{formatSmartDate(order.delivered_at as string)}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

