/**
 * Storefront Order Tracking Page Component
 * Allows customers to track their order status using order number or tracking token
 */

import { useState } from 'react';
import { Package, MapPin, Clock, CheckCircle2, Circle, Truck, Home, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ProductImage from '@/components/ProductImage';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

export interface TrackedOrder {
  order_number: string;
  status: string;
  payment_status: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  delivery_address: {
    address_line1: string;
    address_line2?: string | null;
    city: string;
    state: string;
    postal_code: string;
  };
  delivery_date?: string | null;
  delivery_time_slot?: string | null;
  items: Array<{
    product_id: string;
    name: string;
    quantity: number;
    price: number;
    image_url: string | null;
  }>;
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  total: number;
  status_history?: Array<{
    status: string;
    timestamp: string;
    note?: string | null;
  }>;
}

interface OrderTrackingPageProps {
  onTrackOrder: (orderNumber: string) => Promise<TrackedOrder | null>;
  storeSlug: string;
  storeName: string;
}

const ORDER_STATUSES = [
  { value: 'pending', label: 'Order Placed', icon: Package },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { value: 'preparing', label: 'Preparing', icon: Package },
  { value: 'ready', label: 'Ready for Delivery', icon: Truck },
  { value: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { value: 'delivered', label: 'Delivered', icon: Home },
];

export default function OrderTrackingPage({
  onTrackOrder,
  storeSlug,
  storeName,
}: OrderTrackingPageProps) {
  const [orderNumber, setOrderNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async () => {
    if (!orderNumber.trim()) {
      setError('Please enter an order number');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await onTrackOrder(orderNumber.trim());
      if (result) {
        setTrackedOrder(result);
      } else {
        setError('Order not found. Please check your order number and try again.');
      }
    } catch (err) {
      setError('Failed to track order. Please try again later.');
      logger.error('Failed to track order', err, 'OrderTrackingPage');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIndex = (status: string): number => {
    return ORDER_STATUSES.findIndex((s) => s.value === status);
  };

  const currentStatusIndex = trackedOrder ? getStatusIndex(trackedOrder.status) : -1;
  const isCancelled = trackedOrder?.status === 'cancelled';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Track Your Order</h1>
          <p className="text-muted-foreground">
            Enter your order number to check the status of your delivery
          </p>
        </div>

        {/* Search Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Order Lookup</CardTitle>
            <CardDescription>
              Find your order number in the confirmation email we sent you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="order_number" className="sr-only">
                  Order Number
                </Label>
                <Input
                  id="order_number"
                  placeholder="Enter order number (e.g., ORD-12345)"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                />
              </div>
              <Button onClick={handleTrack} disabled={isLoading} size="lg">
                {isLoading ? 'Tracking...' : 'Track Order'}
              </Button>
            </div>
            {error && (
              <Alert variant="destructive" className="mt-4">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Order Details */}
        {trackedOrder && (
          <div className="space-y-6">
            {/* Status Timeline */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Order #{trackedOrder.order_number}
                  </CardTitle>
                  <Badge
                    variant={
                      isCancelled
                        ? 'destructive'
                        : trackedOrder.status === 'delivered'
                          ? 'default'
                          : 'secondary'
                    }
                    className="capitalize"
                  >
                    {trackedOrder.status.replace('_', ' ')}
                  </Badge>
                </div>
                <CardDescription>
                  Placed on {format(new Date(trackedOrder.created_at), 'MMMM d, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isCancelled ? (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      This order has been cancelled. If you have questions, please contact{' '}
                      {storeName} support.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-6">
                    {ORDER_STATUSES.map((statusStep, index) => {
                      const Icon = statusStep.icon;
                      const isCompleted = index <= currentStatusIndex;
                      const isCurrent = index === currentStatusIndex;
                      const isLast = index === ORDER_STATUSES.length - 1;

                      return (
                        <div key={statusStep.value}>
                          <div className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
                                  isCompleted &&
                                    'bg-primary border-primary text-primary-foreground',
                                  !isCompleted &&
                                    'bg-muted border-muted-foreground/30 text-muted-foreground'
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                              {!isLast && (
                                <div
                                  className={cn(
                                    'w-0.5 h-16 mt-2',
                                    isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                                  )}
                                />
                              )}
                            </div>
                            <div className="flex-1 pb-8">
                              <h4
                                className={cn(
                                  'font-semibold mb-1',
                                  isCurrent && 'text-primary',
                                  !isCompleted && 'text-muted-foreground'
                                )}
                              >
                                {statusStep.label}
                              </h4>
                              {isCurrent && (
                                <p className="text-sm text-muted-foreground">In progress</p>
                              )}
                              {isCompleted && !isCurrent && (
                                <p className="text-sm text-muted-foreground">Completed</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Delivery Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-1 text-sm text-muted-foreground">
                    Delivery Address
                  </h4>
                  <p className="text-sm">{trackedOrder.delivery_address.address_line1}</p>
                  {trackedOrder.delivery_address.address_line2 && (
                    <p className="text-sm">{trackedOrder.delivery_address.address_line2}</p>
                  )}
                  <p className="text-sm">
                    {trackedOrder.delivery_address.city}, {trackedOrder.delivery_address.state}{' '}
                    {trackedOrder.delivery_address.postal_code}
                  </p>
                </div>

                {trackedOrder.delivery_date && (
                  <>
                    <Separator />
                    <div className="flex items-start gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <h4 className="font-semibold mb-1 text-sm">Estimated Delivery</h4>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(trackedOrder.delivery_date), 'EEEE, MMMM d, yyyy')}
                        </p>
                        {trackedOrder.delivery_time_slot && (
                          <p className="text-sm text-muted-foreground">
                            {trackedOrder.delivery_time_slot}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trackedOrder.items.map((item) => (
                    <div key={item.product_id} className="flex gap-4 items-center">
                      <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                        <ProductImage
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                          {item.quantity}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.price)} × {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Order Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(trackedOrder.subtotal)}</span>
                  </div>
                  {trackedOrder.delivery_fee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span>{formatCurrency(trackedOrder.delivery_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(trackedOrder.tax_amount)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(trackedOrder.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card>
              <CardHeader>
                <CardTitle>Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  If you have any questions about your order, please contact {storeName} support.
                </p>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Order Number:</span> #{trackedOrder.order_number}
                  </p>
                  <p>
                    <span className="font-medium">Email:</span> {trackedOrder.customer_email}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
