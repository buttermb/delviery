/**
 * Order Detail Slide-Over Panel
 * Displays full order details in a right-side sheet panel.
 * Opened by clicking an order # in the Live Orders table or Kanban.
 */

import { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import {
  Phone,
  Mail,
  MapPin,
  Store,
  Truck,
  CreditCard,
  Banknote,
  Printer,
  MessageCircle,
  Loader2,
  Clock,
  StickyNote,
  ChevronRight,
  XCircle,
} from 'lucide-react';
import { LiveOrderStatusBadge } from '@/components/admin/live-orders/LiveOrderStatusBadge';
import type { LiveOrder } from '@/pages/admin/storefront/StorefrontLiveOrders';
import { getValidNextStatuses } from '@/pages/admin/storefront/StorefrontLiveOrders';

/**
 * Extended order fields available at runtime from marketplace_orders select('*').
 * The LiveOrder interface is a subset; these fields exist on the raw DB row.
 */
interface OrderRawFields {
  tax?: number | null;
  shipping_address?: Record<string, unknown> | null;
  shipping_cost?: number | null;
  buyer_notes?: string | null;
  seller_notes?: string | null;
  confirmed_at?: string | null;
  preparing_at?: string | null;
  ready_at?: string | null;
  out_for_delivery_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  updated_at?: string | null;
  paid_at?: string | null;
}

interface OrderDetailPanelProps {
  order: LiveOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, newStatus: string) => void;
  updatingOrderId?: string | null;
}

/** Extract raw DB fields from order cast as unknown */
function getRawFields(order: LiveOrder): OrderRawFields {
  return order as unknown as OrderRawFields;
}

/** Determine fulfillment type from order */
function getFulfillmentType(order: LiveOrder): 'delivery' | 'pickup' {
  if (order.shipping_method) {
    const method = order.shipping_method.toLowerCase();
    if (method.includes('pickup') || method.includes('collect')) return 'pickup';
    return 'delivery';
  }
  const raw = getRawFields(order);
  if (raw.shipping_address) return 'delivery';
  if (order.delivery_address) return 'delivery';
  return 'pickup';
}

/** Derive payment method from order fields */
function getPaymentLabel(order: LiveOrder): { label: string; icon: 'card' | 'cash' } {
  if (order.stripe_payment_intent_id || order.payment_status === 'paid') {
    return { label: 'Card', icon: 'card' };
  }
  if (order.payment_terms) {
    const terms = order.payment_terms.toLowerCase();
    if (terms.includes('card') || terms.includes('stripe')) {
      return { label: 'Card', icon: 'card' };
    }
  }
  return { label: 'Cash', icon: 'cash' };
}

/** Parse an item from the items array */
interface ParsedItem {
  name: string;
  variant: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

function parseItems(items: unknown[]): ParsedItem[] {
  return items.map((item) => {
    const i = item as Record<string, unknown>;
    const name = (i.name || i.product_name || 'Item') as string;
    const variant = (i.variant || i.variant_name || null) as string | null;
    const quantity = (typeof i.quantity === 'number' ? i.quantity : 1);
    const unitPrice = (typeof i.unit_price === 'number'
      ? i.unit_price
      : typeof i.price === 'number'
        ? i.price
        : 0);
    const lineTotal = (typeof i.line_total === 'number'
      ? i.line_total
      : typeof i.total === 'number'
        ? i.total
        : unitPrice * quantity);

    return { name, variant, quantity, unitPrice, lineTotal };
  });
}

/** Format a date string to readable format */
function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return null;
  }
}

/** Format delivery address from various shapes */
function formatAddress(order: LiveOrder): string | null {
  const raw = getRawFields(order);
  const addr = raw.shipping_address || order.delivery_address;
  if (!addr) return null;

  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object' && addr !== null) {
    const a = addr as Record<string, unknown>;
    const parts = [
      a.line1 || a.street || a.address_line_1 || a.address,
      a.line2 || a.address_line_2,
      a.city,
      a.state || a.province,
      a.zip || a.postal_code || a.postcode,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  return null;
}

/** Build a timeline from available timestamp fields */
interface TimelineEntry {
  label: string;
  timestamp: string;
}

function buildTimeline(order: LiveOrder): TimelineEntry[] {
  const raw = getRawFields(order);
  const entries: TimelineEntry[] = [];

  if (order.created_at) {
    entries.push({ label: 'Order placed', timestamp: order.created_at });
  }
  if (raw.confirmed_at) {
    entries.push({ label: 'Confirmed', timestamp: raw.confirmed_at });
  }
  if (raw.paid_at) {
    entries.push({ label: 'Payment received', timestamp: raw.paid_at });
  }
  if (raw.preparing_at) {
    entries.push({ label: 'Preparing', timestamp: raw.preparing_at });
  }
  if (raw.ready_at) {
    entries.push({ label: 'Ready', timestamp: raw.ready_at });
  }
  if (raw.out_for_delivery_at) {
    entries.push({ label: 'Out for delivery', timestamp: raw.out_for_delivery_at });
  }
  if (raw.shipped_at && !raw.out_for_delivery_at) {
    entries.push({ label: 'Shipped', timestamp: raw.shipped_at });
  }
  if (raw.delivered_at) {
    entries.push({ label: 'Delivered', timestamp: raw.delivered_at });
  }
  if (raw.cancelled_at) {
    entries.push({ label: 'Cancelled', timestamp: raw.cancelled_at });
  }

  // Sort by timestamp ascending
  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return entries;
}

export function OrderDetailPanel({
  order,
  open,
  onOpenChange,
  onStatusChange,
  updatingOrderId,
}: OrderDetailPanelProps) {
  const items = useMemo(() => {
    if (!order) return [];
    return parseItems(Array.isArray(order.items) ? order.items : []);
  }, [order]);

  const timeline = useMemo(() => {
    if (!order) return [];
    return buildTimeline(order);
  }, [order]);

  if (!order) return null;

  const raw = getRawFields(order);
  const fulfillment = getFulfillmentType(order);
  const payment = getPaymentLabel(order);
  const address = formatAddress(order);
  const isUpdating = updatingOrderId === order.id;
  const validActions = getValidNextStatuses(order.status, fulfillment);
  const primaryAction = validActions.find(a => a.variant === 'default');
  const cancelAction = validActions.find(a => a.variant === 'destructive');

  // Price breakdown
  const subtotal = order.subtotal || 0;
  const tax = raw.tax ?? 0;
  const deliveryFee = raw.shipping_cost ?? order.delivery_fee ?? 0;
  const total = order.total || order.total_amount || 0;

  // Notes
  const notes: Array<{ label: string; text: string }> = [];
  if (order.delivery_notes) notes.push({ label: 'Delivery notes', text: order.delivery_notes });
  if (raw.buyer_notes) notes.push({ label: 'Customer notes', text: raw.buyer_notes });
  if (raw.seller_notes) notes.push({ label: 'Seller notes', text: raw.seller_notes });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[85vw] max-w-lg sm:max-w-xl overflow-y-auto p-0"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 space-y-3">
          <SheetHeader className="space-y-1">
            <SheetTitle className="text-xl">
              Order #{order.order_number}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Details for order {order.order_number}
            </SheetDescription>
          </SheetHeader>

          {/* Status + Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <LiveOrderStatusBadge status={order.status} className="text-xs px-2 py-0.5 h-6" />
            {primaryAction && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => onStatusChange(order.id, primaryAction.status)}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                {primaryAction.label}
              </Button>
            )}
            {cancelAction && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onStatusChange(order.id, cancelAction.status)}
                disabled={isUpdating}
              >
                <XCircle className="h-3 w-3 mr-1" />
                {cancelAction.label}
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Customer Info */}
        <div className="px-6 py-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Customer
          </h3>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{order.customer_name || 'Guest'}</p>
            {order.customer_phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <a href={`tel:${order.customer_phone}`} className="hover:underline">
                  {order.customer_phone}
                </a>
              </div>
            )}
            {order.customer_email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                <a href={`mailto:${order.customer_email}`} className="hover:underline">
                  {order.customer_email}
                </a>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Fulfillment / Address */}
        <div className="px-6 py-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Fulfillment
          </h3>
          <div className="flex items-start gap-2">
            {fulfillment === 'delivery' ? (
              <>
                <Truck className="h-4 w-4 mt-0.5 text-blue-600" />
                <div>
                  <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50 mb-1">
                    Delivery
                  </Badge>
                  {address && (
                    <p className="text-sm text-muted-foreground">{address}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <Store className="h-4 w-4 mt-0.5 text-orange-600" />
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                  Pickup
                </Badge>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Line Items */}
        <div className="px-6 py-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Items
          </h3>
          {items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs text-center">Qty</TableHead>
                  <TableHead className="text-xs text-right">Unit Price</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-sm py-2">
                      <span>{item.name}</span>
                      {item.variant && (
                        <span className="block text-xs text-muted-foreground">
                          {item.variant}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-center py-2">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-sm text-right py-2">
                      {formatCurrency(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-sm text-right py-2 font-medium">
                      {formatCurrency(item.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No items</p>
          )}
        </div>

        <Separator />

        {/* Price Breakdown */}
        <div className="px-6 py-4 space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Price Breakdown
          </h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(tax)}</span>
            </div>
          )}
          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery</span>
              <span>{formatCurrency(deliveryFee)}</span>
            </div>
          )}
          <Separator className="my-1" />
          <div className="flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <Separator />

        {/* Payment Method */}
        <div className="px-6 py-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Payment
          </h3>
          <div className="flex items-center gap-2 text-sm">
            {payment.icon === 'card' ? (
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Banknote className="h-4 w-4 text-muted-foreground" />
            )}
            <span>{payment.label}</span>
            {order.payment_status && (
              <Badge variant="outline" className={cn(
                'text-[10px] ml-1',
                order.payment_status === 'paid'
                  ? 'border-green-300 text-green-700 bg-green-50'
                  : 'border-amber-300 text-amber-700 bg-amber-50'
              )}>
                {order.payment_status}
              </Badge>
            )}
          </div>
        </div>

        {/* Cancellation Reason */}
        {order.status === 'cancelled' && raw.cancellation_reason && (
          <>
            <Separator />
            <div className="px-6 py-4 space-y-2">
              <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider">
                Cancellation Reason
              </h3>
              <p className="text-sm">{raw.cancellation_reason}</p>
            </div>
          </>
        )}

        {/* Notes */}
        {notes.length > 0 && (
          <>
            <Separator />
            <div className="px-6 py-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Notes
              </h3>
              {notes.map((note, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <StickyNote className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{note.label}</p>
                    <p className="text-sm">{note.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Order Timeline */}
        {timeline.length > 0 && (
          <>
            <Separator />
            <div className="px-6 py-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Timeline
              </h3>
              <div className="space-y-3">
                {timeline.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="relative flex flex-col items-center">
                      <div className={cn(
                        'h-2.5 w-2.5 rounded-full mt-1',
                        idx === timeline.length - 1
                          ? 'bg-primary'
                          : 'bg-muted-foreground/40'
                      )} />
                      {idx < timeline.length - 1 && (
                        <div className="w-px h-6 bg-muted-foreground/20 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Footer Actions */}
        <Separator />
        <div className="px-6 py-4 flex gap-2">
          {order.customer_phone && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={`tel:${order.customer_phone}`}>
                <Phone className="h-4 w-4 mr-1.5" />
                Contact Customer
              </a>
            </Button>
          )}
          {order.customer_email && !order.customer_phone && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={`mailto:${order.customer_email}`}>
                <MessageCircle className="h-4 w-4 mr-1.5" />
                Contact Customer
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
