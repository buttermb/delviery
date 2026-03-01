/**
 * Live Order Detail Slide-Over Panel
 * Displays full order details in a right-side sheet panel for admin Live Orders.
 * Fetches complete order data (order + order_items) when opened.
 * Supports both regular orders (orders table) and menu orders (menu_orders table).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import {
  Phone,
  MapPin,
  Truck,
  CreditCard,
  Banknote,
  Printer,
  Clock,
  StickyNote,
  ChevronRight,
  XCircle,
  Loader2,
  Package,
  User,
  Hash,
} from 'lucide-react';

import type { LiveOrder } from '@/components/admin/live-orders/LiveOrdersKanban';

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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { LiveOrderStatusBadge } from '@/components/admin/live-orders/LiveOrderStatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// ---------- Types ----------

interface OrderDetail {
  // Common fields
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  source: 'app' | 'menu';
  total_amount: number;

  // Customer info (app orders)
  customer_name: string | null;
  customer_phone: string | null;

  // Delivery
  delivery_address: string | null;
  delivery_borough: string | null;
  delivery_notes: string | null;
  delivery_fee: number;

  // Pricing
  subtotal: number;
  discount_amount: number | null;
  tip_amount: number | null;

  // Payment
  payment_method: string | null;
  payment_status: string | null;

  // Timestamps
  accepted_at: string | null;
  delivered_at: string | null;

  // Courier
  courier_id: string | null;

  // Special
  special_instructions: string | null;
  order_type: string | null;

  // Menu order specific
  menu_title: string | null;
  customer_notes: string | null;
  delivery_method: string | null;

  // Items
  items: OrderItemDetail[];
}

interface OrderItemDetail {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  line_total: number;
}

interface LiveOrderDetailPanelProps {
  order: LiveOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, newStatus: string, source: 'menu' | 'app') => void;
}

// ---------- Helpers ----------

/** Get next logical status for advancing an order */
function getNextStatus(current: string): { status: string; label: string } | null {
  switch (current) {
    case 'pending': return { status: 'confirmed', label: 'Confirm' };
    case 'confirmed': return { status: 'preparing', label: 'Start Preparing' };
    case 'preparing': return { status: 'ready_for_pickup', label: 'Mark Ready' };
    case 'ready_for_pickup': return { status: 'in_transit', label: 'Out for Delivery' };
    case 'in_transit': return { status: 'delivered', label: 'Mark Delivered' };
    default: return null;
  }
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

/** Build a timeline from available timestamp fields */
interface TimelineEntry {
  label: string;
  timestamp: string;
}

function buildTimeline(detail: OrderDetail): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  if (detail.created_at) {
    entries.push({ label: 'Order placed', timestamp: detail.created_at });
  }
  if (detail.accepted_at) {
    entries.push({ label: 'Accepted', timestamp: detail.accepted_at });
  }
  if (detail.delivered_at) {
    entries.push({ label: 'Delivered', timestamp: detail.delivered_at });
  }

  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return entries;
}

/** Parse menu order items from JSON data */
function parseMenuOrderItems(orderData: unknown, itemsJson: unknown): OrderItemDetail[] {
  // Try items field first
  if (Array.isArray(itemsJson) && itemsJson.length > 0) {
    return itemsJson.map((item, idx) => {
      const i = item as Record<string, unknown>;
      const name = (i.name || i.product_name || 'Item') as string;
      const quantity = typeof i.quantity === 'number' ? i.quantity : 1;
      const price = typeof i.price === 'number' ? i.price
        : typeof i.unit_price === 'number' ? i.unit_price : 0;
      const lineTotal = typeof i.total === 'number' ? i.total
        : typeof i.line_total === 'number' ? i.line_total : price * quantity;

      return {
        id: (i.id as string) || `item-${idx}`,
        product_name: name,
        quantity,
        price,
        line_total: lineTotal,
      };
    });
  }

  // Fallback: parse from order_data
  if (orderData && typeof orderData === 'object') {
    const data = orderData as Record<string, unknown>;
    const dataItems = data.items || data.line_items || data.products;
    if (Array.isArray(dataItems)) {
      return dataItems.map((item, idx) => {
        const i = item as Record<string, unknown>;
        const name = (i.name || i.product_name || 'Item') as string;
        const quantity = typeof i.quantity === 'number' ? i.quantity : 1;
        const price = typeof i.price === 'number' ? i.price
          : typeof i.unit_price === 'number' ? i.unit_price : 0;

        return {
          id: `item-${idx}`,
          product_name: name,
          quantity,
          price,
          line_total: price * quantity,
        };
      });
    }
  }

  return [];
}

// ---------- Component ----------

export function LiveOrderDetailPanel({
  order,
  open,
  onOpenChange,
  onStatusChange,
}: LiveOrderDetailPanelProps) {
  const { tenant } = useTenantAdminAuth();

  // Fetch full order details when panel opens
  const { data: detail, isLoading } = useQuery({
    queryKey: queryKeys.orders.detail(tenant?.id ?? '', order?.id ?? ''),
    queryFn: async (): Promise<OrderDetail | null> => {
      if (!order || !tenant?.id) return null;

      if (order.source === 'menu') {
        // Fetch from menu_orders
        const { data, error } = await supabase
          .from('menu_orders')
          .select(`
            *,
            disposable_menus (name, title)
          `)
          .eq('id', order.id)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch menu order detail', { error, orderId: order.id });
          throw error;
        }
        if (!data) return null;

        const items = parseMenuOrderItems(data.order_data, data.items);
        const menuName = (data.disposable_menus as Record<string, unknown> | null)?.name
          || (data.disposable_menus as Record<string, unknown> | null)?.title
          || null;

        return {
          id: data.id,
          order_number: 'MENU-' + data.id.slice(0, 5).toUpperCase(),
          status: data.status === 'completed' ? 'delivered' : data.status,
          created_at: data.created_at,
          source: 'menu',
          total_amount: Number(data.total_amount ?? 0),
          customer_name: null,
          customer_phone: data.contact_phone || null,
          delivery_address: data.delivery_address || null,
          delivery_borough: null,
          delivery_notes: null,
          delivery_fee: 0,
          subtotal: Number(data.total_amount ?? 0),
          discount_amount: null,
          tip_amount: null,
          payment_method: data.payment_method || null,
          payment_status: null,
          accepted_at: null,
          delivered_at: null,
          courier_id: null,
          special_instructions: null,
          order_type: null,
          menu_title: menuName as string | null,
          customer_notes: data.customer_notes || null,
          delivery_method: data.delivery_method || null,
          items,
        };
      }

      // Fetch from orders table + order_items
      const [orderRes, itemsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('id', order.id)
          .eq('tenant_id', tenant.id)
          .maybeSingle(),
        supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id),
      ]);

      if (orderRes.error) {
        logger.error('Failed to fetch order detail', { error: orderRes.error, orderId: order.id });
        throw orderRes.error;
      }
      if (!orderRes.data) return null;

      const o = orderRes.data;
      const rawItems = itemsRes.data ?? [];

      return {
        id: o.id,
        order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
        status: o.status,
        created_at: o.created_at ?? '',
        source: 'app',
        total_amount: Number(o.total_amount ?? 0),
        customer_name: o.customer_name || null,
        customer_phone: o.customer_phone || null,
        delivery_address: o.delivery_address || null,
        delivery_borough: o.delivery_borough || null,
        delivery_notes: o.delivery_notes || null,
        delivery_fee: Number(o.delivery_fee ?? 0),
        subtotal: Number(o.subtotal ?? 0),
        discount_amount: o.discount_amount != null ? Number(o.discount_amount) : null,
        tip_amount: o.tip_amount != null ? Number(o.tip_amount) : null,
        payment_method: o.payment_method || null,
        payment_status: o.payment_status || null,
        accepted_at: o.accepted_at || null,
        delivered_at: o.delivered_at || null,
        courier_id: o.courier_id || null,
        special_instructions: o.special_instructions || null,
        order_type: o.order_type || null,
        menu_title: null,
        customer_notes: null,
        delivery_method: null,
        items: rawItems.map(item => ({
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: Number(item.price),
          line_total: Number(item.price) * item.quantity,
        })),
      };
    },
    enabled: !!order && !!tenant?.id && open,
    staleTime: 30_000,
  });

  const timeline = useMemo(() => {
    if (!detail) return [];
    return buildTimeline(detail);
  }, [detail]);

  if (!order) return null;

  const nextAction = getNextStatus(order.status);
  const isTerminal = ['delivered', 'completed', 'cancelled', 'rejected'].includes(order.status);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[85vw] max-w-lg sm:max-w-xl overflow-y-auto p-0"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 space-y-3">
          <SheetHeader className="space-y-1">
            <SheetTitle className="text-xl flex items-center gap-2">
              <Hash className="h-5 w-5 text-muted-foreground" />
              {order.order_number}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Details for order {order.order_number}
            </SheetDescription>
          </SheetHeader>

          {/* Status + Source + Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <LiveOrderStatusBadge status={order.status} className="text-xs px-2 py-0.5 h-6" />
            {order.source === 'menu' && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Menu Order</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </span>
          </div>

          {/* Action Buttons */}
          {!isTerminal && (
            <div className="flex items-center gap-2">
              {nextAction && (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    onStatusChange(order.id, nextAction.status, order.source || 'app');
                    onOpenChange(false);
                  }}
                >
                  <ChevronRight className="h-3 w-3" />
                  {nextAction.label}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                onClick={() => {
                  onStatusChange(order.id, 'cancelled', order.source || 'app');
                  onOpenChange(false);
                }}
              >
                <XCircle className="h-3 w-3" />
                Cancel
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Loading State */}
        {isLoading && (
          <div className="px-6 py-6 space-y-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {/* Full Detail Content */}
        {detail && !isLoading && (
          <>
            {/* Customer Info */}
            <div className="px-6 py-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Customer
              </h3>
              <div className="space-y-1.5">
                {detail.customer_name ? (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{detail.customer_name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Guest</p>
                )}
                {detail.customer_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <a href={`tel:${detail.customer_phone}`} className="hover:underline">
                      {detail.customer_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Delivery / Fulfillment */}
            <div className="px-6 py-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Fulfillment
              </h3>
              {detail.delivery_address ? (
                <div className="flex items-start gap-2">
                  <Truck className="h-4 w-4 mt-0.5 text-blue-600" />
                  <div>
                    <Badge variant="outline" className="text-xs border-blue-300 text-blue-700 bg-blue-50 mb-1">
                      {detail.delivery_method || 'Delivery'}
                    </Badge>
                    <p className="text-sm text-muted-foreground">{detail.delivery_address}</p>
                    {detail.delivery_borough && (
                      <p className="text-xs text-muted-foreground">{detail.delivery_borough}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  <Badge variant="outline" className="text-xs border-orange-300 text-orange-700 bg-orange-50">
                    Pickup
                  </Badge>
                </div>
              )}
              {detail.courier_id && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <Truck className="h-3 w-3" />
                  <span>Driver assigned</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Line Items */}
            <div className="px-6 py-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Items ({detail.items.length})
              </h3>
              {detail.items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Product</TableHead>
                      <TableHead className="text-xs text-center">Qty</TableHead>
                      <TableHead className="text-xs text-right">Price</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm py-2">
                          {item.product_name}
                        </TableCell>
                        <TableCell className="text-sm text-center py-2">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-sm text-right py-2">
                          {formatCurrency(item.price)}
                        </TableCell>
                        <TableCell className="text-sm text-right py-2 font-medium">
                          {formatCurrency(item.line_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  No itemized details available
                </p>
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
                <span>{formatCurrency(detail.subtotal)}</span>
              </div>
              {detail.delivery_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span>{formatCurrency(detail.delivery_fee)}</span>
                </div>
              )}
              {detail.discount_amount != null && detail.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-600">-{formatCurrency(detail.discount_amount)}</span>
                </div>
              )}
              {detail.tip_amount != null && detail.tip_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tip</span>
                  <span>{formatCurrency(detail.tip_amount)}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>{formatCurrency(detail.total_amount)}</span>
              </div>
            </div>

            <Separator />

            {/* Payment */}
            <div className="px-6 py-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Payment
              </h3>
              <div className="flex items-center gap-2 text-sm">
                {detail.payment_method?.toLowerCase().includes('cash') ? (
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{detail.payment_method || 'Not specified'}</span>
                {detail.payment_status && (
                  <Badge variant="outline" className={cn(
                    'text-[10px] ml-1',
                    detail.payment_status === 'paid'
                      ? 'border-green-300 text-green-700 bg-green-50'
                      : 'border-amber-300 text-amber-700 bg-amber-50'
                  )}>
                    {detail.payment_status}
                  </Badge>
                )}
              </div>
            </div>

            {/* Notes */}
            {(detail.delivery_notes || detail.special_instructions || detail.customer_notes) && (
              <>
                <Separator />
                <div className="px-6 py-4 space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Notes
                  </h3>
                  {detail.delivery_notes && (
                    <div className="flex items-start gap-2">
                      <StickyNote className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Delivery Notes</p>
                        <p className="text-sm">{detail.delivery_notes}</p>
                      </div>
                    </div>
                  )}
                  {detail.special_instructions && (
                    <div className="flex items-start gap-2">
                      <StickyNote className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Special Instructions</p>
                        <p className="text-sm">{detail.special_instructions}</p>
                      </div>
                    </div>
                  )}
                  {detail.customer_notes && (
                    <div className="flex items-start gap-2">
                      <StickyNote className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Customer Notes</p>
                        <p className="text-sm">{detail.customer_notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Menu Info (for menu orders) */}
            {detail.menu_title && (
              <>
                <Separator />
                <div className="px-6 py-4 space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Menu
                  </h3>
                  <p className="text-sm">{detail.menu_title}</p>
                </div>
              </>
            )}

            {/* Timeline */}
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
              {detail.customer_phone && (
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <a href={`tel:${detail.customer_phone}`}>
                    <Phone className="h-4 w-4 mr-1.5" />
                    Call Customer
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1.5" />
                Print
              </Button>
            </div>
          </>
        )}

        {/* No detail found (non-loading state) */}
        {!detail && !isLoading && (
          <div className="px-6 py-10 text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Order details not available</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
