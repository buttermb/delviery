/**
 * Admin Order Details Page
 * Full order details view with status timeline, items, customer info, and actions
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SwipeBackWrapper } from '@/components/mobile/SwipeBackWrapper';
import { OrderRelatedEntitiesPanel } from '@/components/admin/orders/OrderRelatedEntitiesPanel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Package from "lucide-react/dist/esm/icons/package";
import Truck from "lucide-react/dist/esm/icons/truck";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import User from "lucide-react/dist/esm/icons/user";
import Phone from "lucide-react/dist/esm/icons/phone";
import Mail from "lucide-react/dist/esm/icons/mail";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Edit from "lucide-react/dist/esm/icons/edit";
import Ban from "lucide-react/dist/esm/icons/ban";
import Copy from "lucide-react/dist/esm/icons/copy";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import FileText from "lucide-react/dist/esm/icons/file-text";
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { getStatusColor, getStatusVariant } from '@/lib/utils/statusColors';

// Status steps for the timeline
const STATUS_STEPS = [
  { status: 'pending', label: 'Order Placed', icon: Package, description: 'Order received' },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle, description: 'Order confirmed' },
  { status: 'processing', label: 'Processing', icon: Clock, description: 'Being prepared' },
  { status: 'ready', label: 'Ready', icon: Package, description: 'Ready for pickup/delivery' },
  { status: 'in_transit', label: 'In Transit', icon: Truck, description: 'Out for delivery' },
  { status: 'delivered', label: 'Delivered', icon: CheckCircle, description: 'Successfully delivered' },
];

// Alternative statuses (not in the main timeline)
const TERMINAL_STATUSES = ['cancelled', 'refunded', 'rejected'];

interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  delivery_method: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  delivery_fee: number;
  order_source: string;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  tracking_token: string | null;
  courier_id: string | null;
  user_id: string | null;
  customer_id: string | null;
  wholesale_client_id: string | null;
  user?: {
    id: string;
    full_name: string;
    email: string;
    phone: string;
  } | null;
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  } | null;
  courier?: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
  order_items?: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    variant: string | null;
    image_url: string | null;
  }>;
}

export function OrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();

  const [cancellationReason, setCancellationReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  // Fetch order details
  const { data: order, isLoading, error } = useQuery({
    queryKey: queryKeys.orders.detail(orderId || ''),
    queryFn: async (): Promise<OrderDetails | null> => {
      if (!tenant?.id || !orderId) return null;

      // First try unified_orders
      const { data: unifiedOrder } = await supabase
        .from('unified_orders')
        .select(`
          *,
          items:unified_order_items(*),
          customer:customers(id, first_name, last_name, email, phone),
          courier:couriers(id, full_name, phone)
        `)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (unifiedOrder) {
        // Map unified_orders to expected format
        return {
          id: unifiedOrder.id,
          order_number: unifiedOrder.order_number,
          status: unifiedOrder.status,
          payment_status: unifiedOrder.payment_status || 'unpaid',
          total_amount: unifiedOrder.total_amount || 0,
          subtotal: unifiedOrder.subtotal || 0,
          tax_amount: unifiedOrder.tax_amount || 0,
          discount_amount: unifiedOrder.discount_amount || 0,
          delivery_method: (unifiedOrder as Record<string, unknown>).delivery_method as string | null,
          delivery_address: unifiedOrder.delivery_address,
          delivery_notes: unifiedOrder.delivery_notes,
          delivery_fee: 0,
          order_source: unifiedOrder.source || 'admin',
          created_at: unifiedOrder.created_at,
          updated_at: unifiedOrder.updated_at,
          confirmed_at: (unifiedOrder as Record<string, unknown>).confirmed_at as string | null,
          shipped_at: (unifiedOrder as Record<string, unknown>).shipped_at as string | null,
          delivered_at: (unifiedOrder as Record<string, unknown>).delivered_at as string | null,
          cancelled_at: unifiedOrder.cancelled_at,
          cancellation_reason: unifiedOrder.cancellation_reason,
          notes: (unifiedOrder as Record<string, unknown>).notes as string | null,
          tracking_token: null,
          courier_id: unifiedOrder.courier_id,
          user_id: null,
          customer_id: unifiedOrder.customer_id,
          wholesale_client_id: unifiedOrder.wholesale_client_id,
          customer: unifiedOrder.customer,
          courier: unifiedOrder.courier,
          order_items: (unifiedOrder.items || []).map((item: Record<string, unknown>) => ({
            id: item.id as string,
            product_id: item.product_id as string,
            product_name: item.product_name as string,
            quantity: item.quantity as number,
            unit_price: item.unit_price as number,
            total_price: item.total_price as number,
            variant: null,
            image_url: null,
          })),
        };
      }

      // Fallback to orders table
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          user:profiles(id, full_name, email, phone),
          courier:couriers(id, full_name, phone),
          order_items(*)
        `)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (fetchError) {
        logger.error('Failed to fetch order details', fetchError, { component: 'OrderDetailsPage', orderId });
        throw fetchError;
      }

      if (!data) return null;

      return {
        ...data,
        delivery_method: (data as Record<string, unknown>).delivery_method as string | null ?? null,
        order_source: (data as Record<string, unknown>).order_source as string | null ?? 'admin',
        tax_amount: (data as Record<string, unknown>).tax_amount as number ?? 0,
        updated_at: (data as Record<string, unknown>).updated_at as string ?? data.created_at,
        order_items: data.order_items || [],
      } as unknown as OrderDetails;
    },
    enabled: !!tenant?.id && !!orderId,
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ newStatus, notes }: { newStatus: string; notes?: string }) => {
      if (!tenant?.id || !orderId) throw new Error('Missing required data');

      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // Add timestamp based on status
      if (newStatus === 'confirmed') {
        updateData.confirmed_at = new Date().toISOString();
      } else if (newStatus === 'in_transit' || newStatus === 'shipped') {
        updateData.shipped_at = new Date().toISOString();
      } else if (newStatus === 'delivered' || newStatus === 'completed') {
        updateData.delivered_at = new Date().toISOString();
      } else if (newStatus === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = notes;
      }

      // Try unified_orders first
      const { error: unifiedError } = await supabase
        .from('unified_orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (!unifiedError) return;

      // Fallback to orders table
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId || '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
      toast.success('Order status updated');
      setShowStatusDialog(false);
      setShowCancelDialog(false);
      setCancellationReason('');
    },
    onError: (error) => {
      logger.error('Failed to update order status', error, { component: 'OrderDetailsPage' });
      toast.error('Failed to update order status');
    },
  });

  // Cancel order handler
  const handleCancelOrder = () => {
    updateStatusMutation.mutate({
      newStatus: 'cancelled',
      notes: cancellationReason,
    });
  };

  // Update status handler
  const handleUpdateStatus = () => {
    if (!selectedStatus) return;
    updateStatusMutation.mutate({ newStatus: selectedStatus });
  };

  // Copy tracking URL
  const handleCopyTrackingUrl = async () => {
    if (!order?.tracking_token) return;
    const trackingUrl = `${window.location.origin}/shop/${tenantSlug}/track/${order.tracking_token}`;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      toast.success('Tracking link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6 p-6 max-w-5xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <XCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The order you're looking for doesn't exist or has been removed.
            </p>
            <Button variant="outline" onClick={() => navigateToAdmin('orders')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === order.status);
  const isCancelled = TERMINAL_STATUSES.includes(order.status);
  const canCancel = !isCancelled && !['delivered', 'completed'].includes(order.status);

  const customerName = order.customer
    ? `${order.customer.first_name} ${order.customer.last_name}`
    : order.user?.full_name || 'Guest';
  const customerEmail = order.customer?.email || order.user?.email;
  const customerPhone = order.customer?.phone || order.user?.phone;

  // Build timeline events from timestamps
  const timelineEvents = [
    { timestamp: order.created_at, status: 'pending', label: 'Order Placed', color: 'bg-info' },
    order.confirmed_at && { timestamp: order.confirmed_at, status: 'confirmed', label: 'Order Confirmed', color: 'bg-success' },
    order.shipped_at && { timestamp: order.shipped_at, status: 'in_transit', label: 'Shipped', color: 'bg-warning' },
    order.delivered_at && { timestamp: order.delivered_at, status: 'delivered', label: 'Delivered', color: 'bg-success' },
    order.cancelled_at && { timestamp: order.cancelled_at, status: 'cancelled', label: 'Cancelled', color: 'bg-destructive' },
  ].filter(Boolean) as Array<{ timestamp: string; status: string; label: string; color: string }>;

  return (
    <SwipeBackWrapper onBack={() => navigateToAdmin('orders')}>
      <div className="space-y-6 p-6 pb-16 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('orders')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  Order #{order.order_number}
                </h1>
                <Badge variant={getStatusVariant(order.status)} className={getStatusColor(order.status)}>
                  {order.status.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {formatSmartDate(order.created_at)} · {order.order_source || 'Manual'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {order.tracking_token && (
              <Button variant="outline" size="sm" onClick={handleCopyTrackingUrl}>
                <Copy className="w-4 h-4 mr-1" />
                Share Tracking
              </Button>
            )}

            {!isCancelled && (
              <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-1" />
                    Update Status
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Order Status</DialogTitle>
                    <DialogDescription>
                      Change the status of order #{order.order_number}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label>New Status</Label>
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_STEPS.map((step) => (
                          <SelectItem key={step.status} value={step.status}>
                            {step.label}
                          </SelectItem>
                        ))}
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpdateStatus}
                      disabled={!selectedStatus || updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                      Update Status
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {canCancel && (
              <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10">
                    <Ban className="w-4 h-4 mr-1" />
                    Cancel Order
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Order #{order.order_number}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. The order will be marked as cancelled.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-2">
                    <Label>Reason for cancellation</Label>
                    <Textarea
                      placeholder="Enter reason (optional)"
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      rows={3}
                      className="mt-2"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Order</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelOrder}
                      disabled={updateStatusMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {updateStatusMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        'Cancel Order'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Order Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isCancelled ? (
                  <div className="text-center py-6">
                    <XCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                    <p className="text-lg font-semibold text-destructive capitalize">
                      Order {order.status}
                    </p>
                    {order.cancellation_reason && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Reason: {order.cancellation_reason}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatSmartDate(order.cancelled_at || order.updated_at)}
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    {STATUS_STEPS.map((step, index) => {
                      const isComplete = index <= currentStepIndex;
                      const isCurrent = index === currentStepIndex;
                      const Icon = step.icon;

                      return (
                        <motion.div
                          key={step.status}
                          className={`flex items-start gap-4 ${index < STATUS_STEPS.length - 1 ? 'pb-6' : ''}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.1 }}
                        >
                          {/* Timeline connector */}
                          {index < STATUS_STEPS.length - 1 && (
                            <div
                              className={`absolute left-[19px] w-0.5 h-6 ${isComplete ? 'bg-primary' : 'bg-muted'}`}
                              style={{ top: `${index * 56 + 36}px` }}
                            />
                          )}

                          {/* Icon */}
                          <div
                            className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isCurrent ? 'ring-2 ring-offset-2 ring-primary' : ''
                            } ${isComplete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          {/* Label */}
                          <div className="flex-1 pt-2">
                            <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : isComplete ? '' : 'text-muted-foreground'}`}>
                              {step.label}
                            </p>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                            {isCurrent && (
                              <p className="text-xs text-primary mt-0.5">Current status</p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Items ({order.order_items?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right pr-6">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(order.order_items || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      (order.order_items || []).map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.variant && (
                                  <p className="text-xs text-muted-foreground">{item.variant}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell className="text-right pr-6 font-medium">
                            {formatCurrency(item.total_price)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Order Totals */}
                <div className="p-6 flex flex-col items-end gap-2 text-sm border-t">
                  <div className="flex justify-between w-48">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(order.subtotal || 0)}</span>
                  </div>
                  {(order.discount_amount || 0) > 0 && (
                    <div className="flex justify-between w-48 text-success">
                      <span>Discount</span>
                      <span>-{formatCurrency(order.discount_amount)}</span>
                    </div>
                  )}
                  {(order.tax_amount || 0) > 0 && (
                    <div className="flex justify-between w-48">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatCurrency(order.tax_amount)}</span>
                    </div>
                  )}
                  {(order.delivery_fee || 0) > 0 && (
                    <div className="flex justify-between w-48">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span>{formatCurrency(order.delivery_fee)}</span>
                    </div>
                  )}
                  <Separator className="my-2 w-48" />
                  <div className="flex justify-between w-48 font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Information */}
            {(order.delivery_address || order.delivery_notes || order.courier) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Delivery Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {order.delivery_method && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Delivery Method</Label>
                      <p className="text-sm font-medium capitalize">{order.delivery_method}</p>
                    </div>
                  )}
                  {order.delivery_address && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Delivery Address</Label>
                      <p className="text-sm">{order.delivery_address}</p>
                    </div>
                  )}
                  {order.delivery_notes && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Delivery Notes</Label>
                      <p className="text-sm">{order.delivery_notes}</p>
                    </div>
                  )}
                  {order.courier && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Assigned Courier</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{order.courier.full_name}</span>
                        {order.courier.phone && (
                          <span className="text-sm text-muted-foreground">· {order.courier.phone}</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Order Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Order Number</p>
                  <p className="font-semibold font-mono">{order.order_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Date Placed</p>
                  <p className="text-sm">{format(new Date(order.created_at), 'PPP p')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Source</p>
                  <Badge variant="outline" className="capitalize">
                    {order.order_source || 'Manual'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Payment Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <Badge
                      variant={order.payment_status === 'paid' ? 'default' : 'secondary'}
                      className={order.payment_status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}
                    >
                      {order.payment_status || 'pending'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{customerName}</span>
                </div>
                {customerEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{customerEmail}</span>
                  </div>
                )}
                {customerPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{customerPhone}</span>
                  </div>
                )}
                {order.customer_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => navigateToAdmin(`customers/${order.customer_id}`)}
                  >
                    View Customer Profile
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {timelineEvents.map((event, index) => (
                    <div key={index} className="flex gap-3 text-sm">
                      <div className="mt-0.5">
                        <div className={`h-2 w-2 rounded-full ${event.color}`} />
                      </div>
                      <div>
                        <p className="font-medium">{event.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(event.timestamp), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {order.notes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Related Entities Panel */}
            <OrderRelatedEntitiesPanel orderId={order.id} />
          </div>
        </div>
      </div>
    </SwipeBackWrapper>
  );
}

// Default export for lazy loading
export default OrderDetailsPage;
