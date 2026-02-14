/**
 * OrderRelatedEntitiesPanel Component
 *
 * Displays all related entities for an order in a unified panel:
 * - Customer card (clickable to navigate)
 * - Product thumbnails with quantities
 * - Payment status with transaction details
 * - Delivery tracking information
 * - Order timeline events
 *
 * Uses useRelatedEntities hook for efficient data fetching.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link2 from "lucide-react/dist/esm/icons/link-2";
import User from "lucide-react/dist/esm/icons/user";
import Mail from "lucide-react/dist/esm/icons/mail";
import Phone from "lucide-react/dist/esm/icons/phone";
import Package from "lucide-react/dist/esm/icons/package";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Truck from "lucide-react/dist/esm/icons/truck";
import Clock from "lucide-react/dist/esm/icons/clock";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import {
  useRelatedEntities,
  type OrderRelatedEntities,
  type RelatedCustomer,
  type RelatedProduct,
  type RelatedPayment,
  type RelatedDelivery,
} from '@/hooks/useRelatedEntities';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { cn } from '@/lib/utils';

interface OrderRelatedEntitiesPanelProps {
  orderId: string;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
      <Separator />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

// Customer Section
function CustomerSection({
  customer,
  onNavigate,
}: {
  customer: RelatedCustomer | null;
  onNavigate: (customerId: string) => void;
}) {
  if (!customer) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          <User className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Guest Order</p>
          <p className="text-xs text-muted-foreground">No customer profile linked</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onNavigate(customer.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate(customer.id)}
    >
      <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
        <AvatarFallback className="text-sm font-medium">
          {getInitials(customer.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold truncate">{customer.name}</h4>
          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        </div>
        <div className="space-y-0.5 mt-1">
          {customer.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate">{customer.email}</span>
            </div>
          )}
          {customer.phone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{customer.phone}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Products Section
function ProductsSection({
  products,
  onNavigate,
}: {
  products: RelatedProduct[];
  onNavigate: (productId: string) => void;
}) {
  if (products.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No products in this order</p>
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 pb-2">
        {products.map((product) => (
          <div
            key={product.id}
            className="flex-shrink-0 w-20 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors text-center"
            onClick={() => onNavigate(product.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigate(product.id)}
          >
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-12 h-12 mx-auto rounded object-cover mb-1"
              />
            ) : (
              <div className="w-12 h-12 mx-auto rounded bg-muted flex items-center justify-center mb-1">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <p className="text-xs font-medium truncate" title={product.name}>
              {product.name}
            </p>
            <Badge variant="secondary" className="text-xs mt-1">
              ×{product.quantity}
            </Badge>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// Payment Section
function PaymentSection({ payment }: { payment: RelatedPayment | null }) {
  if (!payment) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
        <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center">
          <AlertCircle className="h-4 w-4 text-warning" />
        </div>
        <div>
          <p className="text-sm font-medium">Payment Pending</p>
          <p className="text-xs text-muted-foreground">No payment recorded</p>
        </div>
      </div>
    );
  }

  const isPaid = payment.status === 'paid' || payment.status === 'completed';
  const statusColor = isPaid ? 'bg-success/10 border-success/20' : 'bg-warning/10 border-warning/20';
  const iconColor = isPaid ? 'text-success' : 'text-warning';
  const iconBg = isPaid ? 'bg-success/20' : 'bg-warning/20';

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-lg border', statusColor)}>
      <div className={cn('h-8 w-8 rounded-full flex items-center justify-center', iconBg)}>
        {isPaid ? (
          <CheckCircle className={cn('h-4 w-4', iconColor)} />
        ) : (
          <Clock className={cn('h-4 w-4', iconColor)} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium capitalize">{payment.status}</p>
          <span className="text-sm font-semibold">{formatCurrency(payment.amount)}</span>
        </div>
        <div className="space-y-0.5 mt-1">
          {payment.method && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CreditCard className="h-3 w-3" />
              <span className="capitalize">{payment.method}</span>
            </div>
          )}
          {payment.paid_at && (
            <p className="text-xs text-muted-foreground">
              Paid {formatSmartDate(payment.paid_at)}
            </p>
          )}
          {payment.transaction_id && (
            <p className="text-xs text-muted-foreground font-mono truncate">
              ID: {payment.transaction_id}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Delivery Section
function DeliverySection({ delivery }: { delivery: RelatedDelivery | null }) {
  if (!delivery) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
          <Truck className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">No Delivery Info</p>
          <p className="text-xs text-muted-foreground">Delivery details not available</p>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 border-yellow-500/20',
    assigned: 'bg-blue-500/10 border-blue-500/20',
    in_transit: 'bg-indigo-500/10 border-indigo-500/20',
    delivered: 'bg-success/10 border-success/20',
    failed: 'bg-destructive/10 border-destructive/20',
  };

  const statusColor = statusColors[delivery.status] || 'bg-muted';

  return (
    <div className={cn('p-3 rounded-lg border', statusColor)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4" />
          <span className="text-sm font-medium capitalize">{delivery.status.replace('_', ' ')}</span>
        </div>
        {delivery.tracking_url && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => window.open(delivery.tracking_url!, '_blank')}
          >
            <MapPin className="h-3 w-3 mr-1" />
            Track
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {delivery.courier_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{delivery.courier_name}</span>
            {delivery.courier_phone && <span>· {delivery.courier_phone}</span>}
          </div>
        )}
        {delivery.scheduled_at && (
          <p className="text-xs text-muted-foreground">
            Scheduled: {formatSmartDate(delivery.scheduled_at)}
          </p>
        )}
        {delivery.delivered_at && (
          <p className="text-xs text-success">
            Delivered: {formatSmartDate(delivery.delivered_at)}
          </p>
        )}
      </div>
    </div>
  );
}

export function OrderRelatedEntitiesPanel({
  orderId,
  className,
}: OrderRelatedEntitiesPanelProps) {
  const { navigateToAdmin } = useTenantNavigation();
  const { data, isLoading, isError } = useRelatedEntities('order', orderId);

  // Type guard for order entities
  const orderData = useMemo(() => {
    if (!data || data.entityType !== 'order') return null;
    return data as OrderRelatedEntities;
  }, [data]);

  const handleNavigateToCustomer = (customerId: string) => {
    navigateToAdmin(`customers/${customerId}`);
  };

  const handleNavigateToProduct = (productId: string) => {
    navigateToAdmin(`products/${productId}`);
  };

  if (isError) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Related Entities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-destructive">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Failed to load related entities</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Related Entities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Customer Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Customer</h4>
              </div>
              <CustomerSection
                customer={orderData?.customer ?? null}
                onNavigate={handleNavigateToCustomer}
              />
            </div>

            <Separator />

            {/* Products Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Products</h4>
                {orderData?.products && orderData.products.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {orderData.products.length} item{orderData.products.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <ProductsSection
                products={orderData?.products ?? []}
                onNavigate={handleNavigateToProduct}
              />
            </div>

            <Separator />

            {/* Payment Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Payment</h4>
              </div>
              <PaymentSection payment={orderData?.payment ?? null} />
            </div>

            <Separator />

            {/* Delivery Section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Delivery</h4>
              </div>
              <DeliverySection delivery={orderData?.delivery ?? null} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
