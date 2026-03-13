/**
 * Storefront Order Confirmation Page Component
 * Displays order success with order number, items, delivery info, and tracking link
 */

import { CheckCircle2, Package, MapPin, Clock, Mail, Phone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import ProductImage from '@/components/ProductImage';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { format } from 'date-fns';

export interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  sku: string | null;
}

export interface DeliveryAddress {
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
}

export interface OrderConfirmationData {
  order_number: string;
  order_id: string;
  tracking_token: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: DeliveryAddress;
  delivery_date: string;
  delivery_time_slot: string;
  delivery_notes?: string | null;
  items: OrderItem[];
  subtotal: number;
  tax_amount: number;
  delivery_fee: number;
  total: number;
  status: string;
  payment_status: string;
}

interface OrderConfirmationPageProps {
  order: OrderConfirmationData;
  storeSlug: string;
  storeName: string;
  onContinueShopping: () => void;
  onTrackOrder: () => void;
}

export default function OrderConfirmationPage({
  order,
  storeSlug,
  storeName,
  onContinueShopping,
  onTrackOrder,
}: OrderConfirmationPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Order Confirmed!</h1>
          <p className="text-lg text-muted-foreground mb-4">
            Thank you for your order. We've sent a confirmation email to{' '}
            <span className="font-medium text-foreground">{order.customer_email}</span>
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-muted-foreground">Order Number:</span>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              #{order.order_number}
            </Badge>
          </div>
        </div>

        {/* Order Details */}
        <div className="space-y-6">
          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.product_id} className="flex gap-4 items-center">
                    <div className="relative w-20 h-20 rounded-md overflow-hidden bg-muted shrink-0">
                      <ProductImage
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                      <Badge className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">
                        {item.quantity}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{item.name}</h4>
                      {item.sku && (
                        <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              {/* Order Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                {order.delivery_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee</span>
                    <span>{formatCurrency(order.delivery_fee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(order.tax_amount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
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
                <h4 className="font-semibold mb-1 text-sm text-muted-foreground">Address</h4>
                <p className="text-sm">{order.delivery_address.address_line1}</p>
                {order.delivery_address.address_line2 && (
                  <p className="text-sm">{order.delivery_address.address_line2}</p>
                )}
                <p className="text-sm">
                  {order.delivery_address.city}, {order.delivery_address.state}{' '}
                  {order.delivery_address.postal_code}
                </p>
              </div>

              <Separator />

              <div className="flex items-start gap-2">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <h4 className="font-semibold mb-1 text-sm">Delivery Time</h4>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(order.delivery_date), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground">{order.delivery_time_slot}</p>
                </div>
              </div>

              {order.delivery_notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-1 text-sm text-muted-foreground">
                      Delivery Notes
                    </h4>
                    <p className="text-sm italic">{order.delivery_notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{order.customer_email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{order.customer_phone}</span>
              </div>
            </CardContent>
          </Card>

          {/* Status Info */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
              <CardDescription>Track your order and get updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Order Confirmation</h4>
                  <p className="text-sm text-muted-foreground">
                    You'll receive a confirmation email shortly with your order details.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Preparation</h4>
                  <p className="text-sm text-muted-foreground">
                    We'll prepare your order and send you updates along the way.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Delivery</h4>
                  <p className="text-sm text-muted-foreground">
                    Your order will be delivered on {format(new Date(order.delivery_date), 'MMMM d')} during your
                    selected time slot.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" onClick={onTrackOrder} className="flex-1 gap-2">
              Track Your Order
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onContinueShopping}
              className="flex-1"
            >
              Continue Shopping
            </Button>
          </div>

          {/* Help Text */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Need help with your order? Contact {storeName} support or check your order status
              using tracking number <span className="font-mono font-medium">#{order.order_number}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
