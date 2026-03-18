/**
 * Admin Order Details Page
 * Full order details view with status timeline, items, customer info, and actions
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbContext';
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
import { OrderPaymentStatusSync } from '@/components/admin/orders/OrderPaymentStatusSync';
import { OrderDeliveryStatusSync } from '@/components/admin/orders/OrderDeliveryStatusSync';
import { OrderProductQuickView } from '@/components/admin/orders/OrderProductQuickView';
import { DuplicateOrderButton } from '@/components/admin/orders/DuplicateOrderButton';
import { OrderThreadedNotes } from '@/components/admin/orders/OrderThreadedNotes';
import { OrderNotesSection } from '@/components/admin/orders/OrderNotesSection';
import { OrderTimeline } from '@/components/admin/orders/OrderTimeline';
import { OrderAuditLog } from '@/components/admin/orders/OrderAuditLog';
import { OrderCustomerCard } from '@/components/admin/orders/OrderCustomerCard';
import type { OrderCustomerData } from '@/components/admin/orders/OrderCustomerCard';
import { OrderAnalyticsInsights } from '@/components/admin/orders/OrderAnalyticsInsights';
import { OrderSourceInfo } from '@/components/admin/orders/OrderSourceInfo';
import { StorefrontSessionLink } from '@/components/admin/orders/StorefrontSessionLink';
import { AssignDeliveryRunnerDialog } from '@/components/admin/orders/AssignDeliveryRunnerDialog';
import { OrderAssignCourier } from '@/components/admin/OrderAssignCourier';
import { OrderDeliveryWindow } from '@/components/admin/orders/OrderDeliveryWindow';
import { DeliveryPLCard } from '@/components/admin/orders/DeliveryPLCard';
import { OrderEditModal } from '@/components/admin/OrderEditModal';
import { OrderRefundModal } from '@/components/admin/orders/OrderRefundModal';
import { OrderPrintDialog } from '@/components/admin/orders/OrderPrintDialog';
import { OrderExportButton } from '@/components/admin/orders/OrderExportButton';
import { DeliveryExceptions } from '@/components/admin/delivery';
import { useOrderInvoiceSave } from '@/components/admin/orders/OrderInvoiceGenerator';
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
import { humanizeError } from '@/lib/humanizeError';
import { motion } from 'framer-motion';
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Package from "lucide-react/dist/esm/icons/package";
import Truck from "lucide-react/dist/esm/icons/truck";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Edit from "lucide-react/dist/esm/icons/edit";
import Ban from "lucide-react/dist/esm/icons/ban";
import Copy from "lucide-react/dist/esm/icons/copy";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import FileText from "lucide-react/dist/esm/icons/file-text";
import UserPlus from "lucide-react/dist/esm/icons/user-plus";
import Printer from "lucide-react/dist/esm/icons/printer";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Save from "lucide-react/dist/esm/icons/save";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTenantFeatureToggles } from '@/hooks/useTenantFeatureToggles';
import { FeatureGate } from '@/components/admin/FeatureGate';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOnEvent } from '@/lib/invalidation';
import { getStatusColor, getStatusVariant } from '@/lib/utils/statusColors';
import { isValidUUID } from '@/lib/utils/uuidValidation';

// Status steps for the timeline
const STATUS_STEPS = [
  { status: 'pending', label: 'Order Placed', icon: Package, description: 'Order received' },
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle, description: 'Order confirmed' },
  { status: 'preparing', label: 'Preparing', icon: Clock, description: 'Being prepared' },
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
  source_menu_id: string | null;
  source_session_id: string | null;
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
  metadata?: {
    refund?: {
      type: string;
      amount: number;
      reason: string;
      method: string;
      notes?: string | null;
      restoreInventory?: boolean;
      processedAt: string;
      processedBy?: string | null;
      inventoryRestored?: boolean;
      lineItems?: Array<{
        product_id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
      }> | null;
    };
  } | null;
}

export function OrderDetailsPage() {
  const { orderId: rawOrderId } = useParams<{ orderId: string }>();
  const orderId = rawOrderId && isValidUUID(rawOrderId) ? rawOrderId : undefined;
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const queryClient = useQueryClient();
  const { isEnabled: isFeatureEnabled } = useTenantFeatureToggles();
  const deliveryEnabled = isFeatureEnabled('delivery_tracking');

  const [cancellationReason, setCancellationReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');

  // Product quick view state
  const [quickViewProductId, setQuickViewProductId] = useState<string | null>(null);
  const [quickViewProductName, setQuickViewProductName] = useState<string>('');

  // Runner assignment dialog state
  const [showAssignRunnerDialog, setShowAssignRunnerDialog] = useState(false);

  // Courier assignment dialog state
  const [showAssignCourierDialog, setShowAssignCourierDialog] = useState(false);

  // Edit order modal state
  const [showEditModal, setShowEditModal] = useState(false);

  // Refund modal state
  const [showRefundModal, setShowRefundModal] = useState(false);

  // Print dialog state
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  // Delivery exceptions dialog state
  const [showDeliveryExceptionsDialog, setShowDeliveryExceptionsDialog] = useState(false);

  // Delivery notes editing state
  const [deliveryNotesValue, setDeliveryNotesValue] = useState<string>('');
  const [isEditingDeliveryNotes, setIsEditingDeliveryNotes] = useState(false);

  // Fetch order details
  const { data: order, isLoading, error } = useQuery({
    queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId ?? ''),
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
          total_amount: unifiedOrder.total_amount ?? 0,
          subtotal: unifiedOrder.subtotal ?? 0,
          tax_amount: unifiedOrder.tax_amount ?? 0,
          discount_amount: unifiedOrder.discount_amount ?? 0,
          delivery_method: (unifiedOrder as Record<string, unknown>).delivery_method as string | null,
          delivery_address: unifiedOrder.delivery_address,
          delivery_notes: unifiedOrder.delivery_notes,
          delivery_fee: 0,
          order_source: unifiedOrder.source || 'admin',
          source_menu_id: (unifiedOrder as Record<string, unknown>).source_menu_id as string | null,
          source_session_id: (unifiedOrder as Record<string, unknown>).source_session_id as string | null,
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
          metadata: (unifiedOrder as Record<string, unknown>).metadata as OrderDetails['metadata'] ?? null,
          customer: unifiedOrder.customer,
          courier: unifiedOrder.courier,
          order_items: (unifiedOrder.items ?? []).map((item: Record<string, unknown>) => ({
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
        source_menu_id: (data as Record<string, unknown>).source_menu_id as string | null ?? null,
        source_session_id: (data as Record<string, unknown>).source_session_id as string | null ?? null,
        tax_amount: (data as Record<string, unknown>).tax_amount as number ?? 0,
        updated_at: (data as Record<string, unknown>).updated_at as string ?? data.created_at,
        metadata: (data as Record<string, unknown>).metadata as OrderDetails['metadata'] ?? null,
        order_items: data.order_items ?? [],
      } as unknown as OrderDetails;
    },
    enabled: !!tenant?.id && !!orderId,
  });

  // Set breadcrumb label to show order number
  useBreadcrumbLabel(order ? `Order #${order.order_number}` : null);

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

      logger.warn('unified_orders status update failed, falling back to orders table', {
        component: 'OrderDetailsPage',
        orderId,
        error: unifiedError,
      });

      // Fallback to orders table
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      // Restore inventory when cancelling
      if (variables.newStatus === 'cancelled' && order?.order_items?.length) {
        try {
          for (const item of order.order_items) {
            if (!item.product_id) continue;
            const { data: product } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.product_id)
              .eq('tenant_id', tenant?.id ?? '')
              .maybeSingle();
            if (product) {
              const previousQuantity = product.stock_quantity ?? 0;
              const newQuantity = previousQuantity + item.quantity;
              await supabase
                .from('products')
                .update({
                  stock_quantity: newQuantity,
                  available_quantity: newQuantity,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', item.product_id)
                .eq('tenant_id', tenant?.id ?? '');
              // Log to inventory_history for audit trail
              await supabase
                .from('inventory_history')
                .insert({
                  tenant_id: tenant?.id,
                  product_id: item.product_id,
                  change_type: 'return',
                  previous_quantity: previousQuantity,
                  new_quantity: newQuantity,
                  change_amount: item.quantity,
                  reference_type: 'order_cancelled',
                  reference_id: orderId,
                  reason: 'order_cancelled',
                  notes: `Order cancelled — inventory restored`,
                  performed_by: tenant?.id || null,
                  metadata: { order_id: orderId, source: 'order_details_page' },
                });
            }
          }
          logger.info('Inventory restored for cancelled order', { component: 'OrderDetailsPage', orderId });
          if (tenant?.id) {
            invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id);
          }
        } catch (stockError) {
          logger.error('Failed to restore inventory on cancel', stockError, { component: 'OrderDetailsPage', orderId });
          toast.error('Order cancelled but inventory restore failed — adjust stock manually');
        }
      }

      // Deduct stock on delivery/completion
      if (['delivered', 'completed'].includes(variables.newStatus) && order?.order_items?.length) {
        try {
          for (const item of order.order_items) {
            if (!item.product_id) continue;
            const { data: product } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.product_id)
              .eq('tenant_id', tenant?.id ?? '')
              .maybeSingle();
            if (product) {
              await supabase
                .from('products')
                .update({ stock_quantity: Math.max(0, (product.stock_quantity ?? 0) - item.quantity) })
                .eq('id', item.product_id)
                .eq('tenant_id', tenant?.id ?? '');
            }
          }
          logger.info('Stock deducted for delivered order', { component: 'OrderDetailsPage', orderId });
          if (tenant?.id) {
            invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id);
          }
        } catch (stockError) {
          logger.error('Failed to deduct stock on delivery', stockError, { component: 'OrderDetailsPage', orderId });
          toast.error('Order delivered but stock deduction failed — adjust stock manually');
        }
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId ?? '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
      toast.success('Order status updated');
      setShowStatusDialog(false);
      setShowCancelDialog(false);
      setCancellationReason('');
    },
    onError: (error) => {
      logger.error('Failed to update order status', error, { component: 'OrderDetailsPage' });
      toast.error('Failed to update order status', { description: humanizeError(error) });
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
    } catch (error) {
      toast.error('Failed to copy', { description: humanizeError(error) });
    }
  };

  // Save delivery notes mutation
  const saveDeliveryNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      if (!tenant?.id || !orderId) throw new Error('Missing required data');

      const updateData = { delivery_notes: notes || null };

      // Try unified_orders first
      const { error: unifiedError } = await supabase
        .from('unified_orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (!unifiedError) return;

      logger.warn('unified_orders delivery notes update failed, falling back to orders table', {
        component: 'OrderDetailsPage',
        orderId,
        error: unifiedError,
      });

      // Fallback to orders table
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId ?? '') });
      toast.success('Delivery notes saved');
      setIsEditingDeliveryNotes(false);
    },
    onError: (error) => {
      logger.error('Failed to save delivery notes', error, { component: 'OrderDetailsPage' });
      toast.error('Failed to save delivery notes', { description: humanizeError(error) });
    },
  });

  // Check if invoice already exists for this order
  const { data: existingInvoice } = useQuery({
    queryKey: [...queryKeys.customerInvoices.all, 'by-order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('customer_invoices')
        .select('id, invoice_number')
        .eq('order_id', orderId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!orderId,
  });

  // Create invoice from order data
  const { createInvoice, isCreating: isCreatingInvoice } = useOrderInvoiceSave();

  const handleCreateInvoice = async () => {
    if (!order?.customer_id) {
      toast.error('No customer linked to this order');
      return;
    }
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    try {
      await createInvoice({
        order: {
          id: order.id,
          tracking_code: order.order_number,
          created_at: order.created_at,
          total_amount: order.total_amount,
          status: order.status,
          delivery_address: order.delivery_address ?? '',
          order_items: (order.order_items ?? []).map(item => ({
            quantity: item.quantity,
            price: item.unit_price,
            product_name: item.product_name,
          })),
          subtotal: order.subtotal ?? 0,
          tax: order.tax_amount ?? 0,
          discount: order.discount_amount ?? 0,
          notes: order.notes || undefined,
        },
        customerId: order.customer_id,
        dueDate: dueDate.toISOString().split('T')[0],
        notes: `Auto-generated from Order #${order.order_number}`,
      });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.customerInvoices.all, 'by-order', orderId] });
    } catch {
      // Error already handled by useOrderInvoiceSave onError
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 max-w-5xl mx-auto">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-md" />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content skeleton */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Timeline card */}
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="space-y-1 flex-1 pt-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Order Items card */}
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="p-0">
                <div className="border-b px-6 py-3 flex gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12 ml-auto" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-6 py-4 border-b last:border-b-0">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
                <div className="p-6 flex flex-col items-end gap-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-6 w-48" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-6">
            {/* Order Info card */}
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </CardContent>
            </Card>

            {/* Customer Info card */}
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>

            {/* Activity Timeline card */}
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-36" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-2 w-2 rounded-full mt-1.5" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4 p-4 max-w-5xl mx-auto">
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
      <div className="space-y-4 p-4 pb-16 max-w-5xl mx-auto">
        {/* Print-only business header — hidden on screen, shown on print */}
        <div className="hidden print:block print-business-header border-b-2 border-black pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{tenant?.business_name || 'FloraIQ'}</h1>
              <p className="text-sm text-gray-600 mt-1">Order Confirmation</p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>Order #{order.order_number}</p>
              <p>{format(new Date(order.created_at), 'PPP')}</p>
              <p className="capitalize">Status: {order.status.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('orders')} aria-label="Back to orders">
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

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setShowPrintDialog(true)} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Printer className="w-4 h-4 mr-1" />}
              {updateStatusMutation.isPending ? 'Printing...' : 'Print'}
            </Button>

            <OrderExportButton
              orders={[{
                id: order.id,
                order_number: order.order_number,
                status: order.status,
                total_amount: order.total_amount,
                created_at: order.created_at,
                delivery_method: order.delivery_method || undefined,
                payment_status: order.payment_status,
                order_source: order.order_source,
                customer_name: customerName,
                customer_email: customerEmail || undefined,
                customer_phone: customerPhone || undefined,
                order_items: (order.order_items ?? []).map(item => ({
                  id: item.id,
                  product_id: item.product_id,
                  product_name: item.product_name,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                })),
              }]}
              filenamePrefix={`order-${order.order_number}`}
              variant="outline"
              size="sm"
              disabled={updateStatusMutation.isPending}
            />

            {order.tracking_token && (
              <Button variant="outline" size="sm" onClick={handleCopyTrackingUrl} disabled={updateStatusMutation.isPending}>
                {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Copy className="w-4 h-4 mr-1" />}
                {updateStatusMutation.isPending ? 'Sharing...' : 'Share Tracking'}
              </Button>
            )}

            {/* Edit Order Button — only for pending/confirmed */}
            {['pending', 'confirmed'].includes(order.status) && (
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)} disabled={updateStatusMutation.isPending}>
                {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Edit className="w-4 h-4 mr-1" />}
                {updateStatusMutation.isPending ? 'Editing...' : 'Edit Order'}
              </Button>
            )}

            {/* Refund Button — only for delivered/completed, disabled if already refunded */}
            {['delivered', 'completed'].includes(order.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRefundModal(true)}
                disabled={order.payment_status === 'refunded' || updateStatusMutation.isPending}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                {order.payment_status === 'refunded' ? 'Refunded' : 'Refund'}
              </Button>
            )}

            {/* Create Invoice Button — for delivered/completed orders with customer */}
            {['delivered', 'completed'].includes(order.status) && order.customer_id && !existingInvoice && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateInvoice}
                disabled={isCreatingInvoice || updateStatusMutation.isPending}
              >
                {isCreatingInvoice ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-1" />
                )}
                Create Invoice
              </Button>
            )}

            {/* View Invoice link — if invoice already exists for this order */}
            {existingInvoice && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToAdmin('customer-invoices')}
              >
                <FileText className="w-4 h-4 mr-1" />
                View Invoice
              </Button>
            )}

            {/* Report Delivery Issue Button — only for in-transit/out-for-delivery */}
            {['in_transit', 'out_for_delivery'].includes(order.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeliveryExceptionsDialog(true)}
                disabled={updateStatusMutation.isPending}
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                Report Issue
              </Button>
            )}

            {/* Duplicate Order Button */}
            <DuplicateOrderButton
              orderId={order.id}
              orderNumber={order.order_number}
              customerId={order.customer_id}
              wholesaleClientId={order.wholesale_client_id}
              deliveryAddress={order.delivery_address}
              deliveryNotes={order.delivery_notes}
              disabled={updateStatusMutation.isPending}
              orderItems={(order.order_items ?? []).map(item => ({
                id: item.id,
                product_id: item.product_id,
                product_name: item.product_name,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
              }))}
            />

            {/* Assign Runner Button - show when order is ready for delivery */}
            {!isCancelled && !order.courier_id && ['confirmed', 'preparing', 'ready', 'pending'].includes(order.status) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAssignRunnerDialog(true)}
                        disabled={!deliveryEnabled || updateStatusMutation.isPending}
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Assign Runner
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!deliveryEnabled && (
                    <TooltipContent>Enable Delivery Tracking in Settings</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Assign Courier Button - show when order needs courier and has delivery address */}
            {!isCancelled && !order.courier_id && order.delivery_address && ['confirmed', 'preparing', 'ready'].includes(order.status) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAssignCourierDialog(true)}
                disabled={updateStatusMutation.isPending}
              >
                <Truck className="w-4 h-4 mr-1" />
                Assign Courier
              </Button>
            )}

            {!isCancelled && (
              <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={updateStatusMutation.isPending}>
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
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10" disabled={updateStatusMutation.isPending}>
                    <Ban className="w-4 h-4 mr-1" />
                    Cancel Order
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. Inventory will be restored for all items in this order.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-2">
                    <Label required>Reason for cancellation</Label>
                    <Textarea
                      placeholder="Enter cancellation reason (required)"
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
                      disabled={updateStatusMutation.isPending || !cancellationReason.trim()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {updateStatusMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        'Confirm Cancellation'
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
                  Items ({order.order_items?.length ?? 0})
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
                    {(order.order_items ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      (order.order_items ?? []).map((item) => (
                        <TableRow
                          key={item.id}
                          className={item.product_id ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}
                          onClick={() => {
                            if (item.product_id) {
                              setQuickViewProductId(item.product_id);
                              setQuickViewProductName(item.product_name);
                            }
                          }}
                        >
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="w-10 h-10 rounded object-cover"
                                  loading="lazy"
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
                                {item.product_id && (
                                  <p className="text-xs text-primary print:hidden">Click to view details</p>
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
                    <span>{formatCurrency(order.subtotal ?? 0)}</span>
                  </div>
                  {(order.discount_amount ?? 0) > 0 && (
                    <div className="flex justify-between w-48 text-success">
                      <span>Discount</span>
                      <span>-{formatCurrency(order.discount_amount)}</span>
                    </div>
                  )}
                  {(order.tax_amount ?? 0) > 0 && (
                    <div className="flex justify-between w-48">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatCurrency(order.tax_amount)}</span>
                    </div>
                  )}
                  {(order.delivery_fee ?? 0) > 0 && (
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
                  {/* Delivery Status Timeline */}
                  {(() => {
                    const deliverySteps = [
                      {
                        key: 'ordered',
                        label: 'Ordered',
                        icon: Package,
                        timestamp: order.created_at,
                        reached: true,
                      },
                      {
                        key: 'assigned',
                        label: 'Courier Assigned',
                        icon: UserPlus,
                        timestamp: order.courier_id ? (order.confirmed_at || order.created_at) : null,
                        reached: !!order.courier_id,
                      },
                      {
                        key: 'picked_up',
                        label: 'Picked Up',
                        icon: Package,
                        timestamp: order.shipped_at,
                        reached: !!order.shipped_at || ['in_transit', 'out_for_delivery', 'delivered', 'completed'].includes(order.status),
                      },
                      {
                        key: 'in_transit',
                        label: 'In Transit',
                        icon: Truck,
                        timestamp: order.shipped_at,
                        reached: ['in_transit', 'out_for_delivery', 'delivered', 'completed'].includes(order.status),
                      },
                      {
                        key: order.status === 'cancelled' ? 'failed' : 'delivered',
                        label: order.status === 'cancelled' ? 'Failed' : 'Delivered',
                        icon: order.status === 'cancelled' ? XCircle : CheckCircle,
                        timestamp: order.delivered_at || order.cancelled_at,
                        reached: ['delivered', 'completed'].includes(order.status) || order.status === 'cancelled',
                      },
                    ];

                    return (
                      <div className="flex items-start justify-between gap-1 mb-4">
                        {deliverySteps.map((step, idx) => {
                          const StepIcon = step.icon;
                          const isFailed = step.key === 'failed' && step.reached;
                          const isActive = step.reached;

                          return (
                            <div key={step.key} className="flex items-start flex-1 min-w-0">
                              <div className="flex flex-col items-center text-center w-full">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    isFailed
                                      ? 'bg-destructive text-destructive-foreground'
                                      : isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  <StepIcon className="w-4 h-4" />
                                </div>
                                <p className={`text-xs font-medium mt-1 ${
                                  isFailed ? 'text-destructive' : isActive ? 'text-primary' : 'text-muted-foreground'
                                }`}>
                                  {step.label}
                                </p>
                                {step.timestamp && step.reached && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {format(new Date(step.timestamp), 'MMM d, h:mm a')}
                                  </p>
                                )}
                              </div>
                              {idx < deliverySteps.length - 1 && (
                                <div className={`h-0.5 mt-4 flex-1 min-w-2 ${
                                  deliverySteps[idx + 1].reached ? 'bg-primary' : 'bg-muted'
                                }`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <Separator />

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
                  {/* Editable Delivery Notes */}
                  <div className="print:hidden">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-muted-foreground">Delivery Notes</Label>
                      {!isEditingDeliveryNotes && !isCancelled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setDeliveryNotesValue(order.delivery_notes ?? '');
                            setIsEditingDeliveryNotes(true);
                          }}
                          disabled={saveDeliveryNotesMutation.isPending}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          {order.delivery_notes ? 'Edit' : 'Add'}
                        </Button>
                      )}
                    </div>
                    {isEditingDeliveryNotes ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Gate code, delivery instructions, special requests..."
                          aria-label="Delivery notes"
                          value={deliveryNotesValue}
                          onChange={(e) => setDeliveryNotesValue(e.target.value)}
                          rows={3}
                          maxLength={500}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {deliveryNotesValue.length}/500
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsEditingDeliveryNotes(false)}
                              disabled={saveDeliveryNotesMutation.isPending}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveDeliveryNotesMutation.mutate(deliveryNotesValue.trim())}
                              disabled={saveDeliveryNotesMutation.isPending}
                            >
                              {saveDeliveryNotesMutation.isPending ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3 mr-1" />
                              )}
                              Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : order.delivery_notes ? (
                      <p className="text-sm whitespace-pre-wrap">{order.delivery_notes}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No delivery notes</p>
                    )}
                  </div>
                  {/* Print-only delivery notes (non-editable) */}
                  {order.delivery_notes && (
                    <div className="hidden print:block">
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
              </CardContent>
            </Card>

            {/* Order Source with Traceability — hide on print */}
            <div className="print:hidden">
              <OrderSourceInfo
                source={order.order_source}
                sourceMenuId={order.source_menu_id}
                sourceSessionId={order.source_session_id}
              />
            </div>

            {/* Storefront Session Link - Customer Journey Details — hide on print */}
            {order.source_session_id && (
              <div className="print:hidden">
                <StorefrontSessionLink
                  sessionId={order.source_session_id}
                  menuId={order.source_menu_id}
                />
              </div>
            )}

            {/* Order Analytics Insights — hide on print, gated behind analytics_advanced */}
            <FeatureGate feature="analytics_advanced">
              <div className="print:hidden">
                <OrderAnalyticsInsights
                  orderId={order.id}
                  customerId={order.customer_id}
                  orderTotal={order.total_amount}
                  orderCreatedAt={order.created_at}
                  orderItems={order.order_items}
                />
              </div>
            </FeatureGate>

            {/* Payment Status with Real-time Sync — hide on print */}
            <div className="print:hidden">
              <OrderPaymentStatusSync
                orderId={order.id}
                orderAmount={order.total_amount}
                currentPaymentStatus={order.payment_status}
                autoUpdateOrderStatus={true}
                onPaymentStatusChange={() => {
                  queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId ?? '') });
                }}
              />
            </div>

            {/* Refund History — only render if refund data exists */}
            {order.metadata?.refund && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RotateCcw className="w-5 h-5" />
                    Refund History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={order.metadata.refund.type === 'full' ? 'destructive' : 'secondary'}>
                      {order.metadata.refund.type === 'full' ? 'Full Refund' : 'Partial Refund'}
                    </Badge>
                    {order.metadata.refund.inventoryRestored && (
                      <Badge variant="outline" className="text-xs">Inventory Restored</Badge>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium text-destructive">{formatCurrency(order.metadata.refund.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Method</span>
                      <span className="capitalize">{order.metadata.refund.method.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>{format(new Date(order.metadata.refund.processedAt), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    {order.metadata.refund.reason && (
                      <div>
                        <span className="text-muted-foreground">Reason</span>
                        <p className="mt-0.5">{order.metadata.refund.reason}</p>
                      </div>
                    )}
                    {order.metadata.refund.notes && (
                      <div>
                        <span className="text-muted-foreground">Notes</span>
                        <p className="mt-0.5">{order.metadata.refund.notes}</p>
                      </div>
                    )}
                  </div>
                  {order.metadata.refund.lineItems && order.metadata.refund.lineItems.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Refunded Items</p>
                        <div className="space-y-1">
                          {order.metadata.refund.lineItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{item.product_name} x{item.quantity}</span>
                              <span>{formatCurrency(item.unit_price * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Delivery Status with Real-time Sync — hide on print */}
            <div className="print:hidden">
              <OrderDeliveryStatusSync
                orderId={order.id}
                autoUpdateOrderStatus={true}
                onDeliveryStatusChange={() => {
                  queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId ?? '') });
                }}
              />
            </div>

            {/* Delivery Window — hide on print */}
            {order.delivery_address && (
              <div className="print:hidden">
                <OrderDeliveryWindow
                  scheduledDeliveryAt={(order as unknown as Record<string, unknown>).scheduled_delivery_at as string | null}
                  timeSlotLabel={(order as unknown as Record<string, unknown>).time_slot_label as string | null}
                  deliveryStatus={
                    (['pending', 'in_transit', 'delivered', 'cancelled'].includes(order.status)
                      ? order.status
                      : order.status === 'completed'
                        ? 'delivered'
                        : 'pending') as 'pending' | 'in_transit' | 'delivered' | 'cancelled'
                  }
                />
              </div>
            )}

            {/* Delivery P&L — hide on print */}
            {(order.delivery_fee > 0 || order.delivery_address) && (
              <div className="print:hidden">
                <DeliveryPLCard
                  orderId={order.id}
                  deliveryFee={order.delivery_fee ?? 0}
                  tipAmount={((order as unknown as Record<string, unknown>).tip_amount as number) ?? 0}
                  courierId={order.courier_id}
                  distanceMiles={((order as unknown as Record<string, unknown>).distance_miles as number) || null}
                  deliveryTimeMinutes={((order as unknown as Record<string, unknown>).eta_minutes as number) || null}
                  deliveryZone={((order as unknown as Record<string, unknown>).delivery_zone as string) || null}
                  deliveryBorough={((order as unknown as Record<string, unknown>).delivery_borough as string) || null}
                />
              </div>
            )}

            {/* Customer Info — enhanced card with stats and actions */}
            <OrderCustomerCard
              customer={
                order.customer
                  ? {
                      customer_id: order.customer_id || order.customer.id,
                      first_name: order.customer.first_name,
                      last_name: order.customer.last_name,
                      email: order.customer.email,
                      phone: order.customer.phone,
                    } as OrderCustomerData
                  : order.user
                    ? {
                        id: order.user.id,
                        full_name: order.user.full_name,
                        email: order.user.email,
                        phone: order.user.phone,
                      } as OrderCustomerData
                    : null
              }
              showActions={!isCancelled}
            />

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

            {/* Detailed Activity Timeline from activity_log — hide on print */}
            <div className="print:hidden">
              <OrderTimeline orderId={order.id} maxHeight="350px" />
            </div>

            {/* Order Notes Section (Internal / Customer tabs) — hide on print */}
            <div className="print:hidden">
              <OrderNotesSection
                orderId={order.id}
                internalNotes={order.notes}
                customerNotes={order.delivery_notes}
                tableName={'unified_orders' as 'marketplace_orders'}
                internalNotesField="notes"
                customerNotesField="delivery_notes"
                additionalFilter={{ field: 'tenant_id', value: tenant?.id ?? '' }}
                queryKeysToInvalidate={[
                  [...queryKeys.orders.detail(tenant?.id ?? '', orderId ?? '')],
                ]}
                readOnly={isCancelled}
              />
            </div>

            {/* Internal Threaded Notes with @mentions — hide on print */}
            <div className="print:hidden">
              <OrderThreadedNotes
                orderId={order.id}
                orderNumber={order.order_number}
              />
            </div>

            {/* Related Entities Panel — hide on print */}
            <div className="print:hidden">
              <OrderRelatedEntitiesPanel orderId={order.id} />
            </div>

            {/* Audit Log — hide on print */}
            <div className="print:hidden">
              <OrderAuditLog orderId={order.id} maxHeight="400px" />
            </div>
          </div>
        </div>
      </div>

      {/* Product Quick View Panel — hidden on print */}
      <div className="print:hidden">
        <OrderProductQuickView
          isOpen={!!quickViewProductId}
          onClose={() => {
            setQuickViewProductId(null);
            setQuickViewProductName('');
          }}
          productId={quickViewProductId}
          productName={quickViewProductName}
        />
      </div>

      {/* Order Edit Modal — hidden on print */}
      <div className="print:hidden">
        <OrderEditModal
          order={order ? {
            id: order.id,
            status: order.status,
            tracking_code: order.tracking_token || undefined,
            total_amount: order.total_amount,
            delivery_address: order.delivery_address || undefined,
            delivery_notes: order.delivery_notes || undefined,
            customer_notes: order.notes || undefined,
            created_at: order.created_at,
            order_items: (order.order_items ?? []).map(item => ({
              id: item.id,
              product_name: item.product_name,
              quantity: item.quantity,
              price: item.unit_price,
            })),
          } : null}
          open={showEditModal}
          onOpenChange={setShowEditModal}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId ?? '') });
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
            toast.success('Order updated');
          }}
        />
      </div>

      {/* Order Refund Modal — hidden on print */}
      <div className="print:hidden">
        <OrderRefundModal
          open={showRefundModal}
          onOpenChange={setShowRefundModal}
          order={order ? {
            id: order.id,
            tenant_id: tenant?.id ?? '',
            order_number: order.order_number,
            order_type: 'wholesale',
            source: order.order_source || 'admin',
            status: order.status as 'delivered' | 'completed',
            subtotal: order.subtotal ?? 0,
            tax_amount: order.tax_amount ?? 0,
            discount_amount: order.discount_amount ?? 0,
            total_amount: order.total_amount,
            payment_method: null,
            payment_status: (order.payment_status === 'partially_paid' ? 'partial' : order.payment_status) as 'paid' | 'unpaid' | 'refunded' | 'partial',
            customer_id: order.customer_id || null,
            wholesale_client_id: order.wholesale_client_id || null,
            menu_id: null,
            shift_id: null,
            delivery_address: order.delivery_address,
            delivery_notes: order.delivery_notes,
            courier_id: order.courier_id,
            contact_name: null,
            contact_phone: null,
            metadata: {},
            created_at: order.created_at,
            updated_at: order.updated_at,
            cancelled_at: order.cancelled_at,
            cancellation_reason: order.cancellation_reason,
            priority: 'normal',
            priority_set_at: null,
            priority_set_by: null,
            priority_auto_set: false,
            items: (order.order_items ?? []).map(item => ({
              id: item.id,
              order_id: order.id,
              product_id: item.product_id,
              inventory_id: null,
              product_name: item.product_name,
              sku: null,
              quantity: item.quantity,
              quantity_unit: 'unit',
              unit_price: item.unit_price,
              discount_amount: 0,
              total_price: item.total_price,
              metadata: {},
            })),
          } : null}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId ?? '') });
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
            toast.success('Refund processed successfully');
          }}
        />
      </div>

      {/* Delivery Exceptions Dialog — hidden on print */}
      <div className="print:hidden">
        <Dialog open={showDeliveryExceptionsDialog} onOpenChange={setShowDeliveryExceptionsDialog}>
          <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Report Delivery Issue</DialogTitle>
              <DialogDescription>
                Log delivery exceptions for order #{order.order_number}
              </DialogDescription>
            </DialogHeader>
            <DeliveryExceptions />
          </DialogContent>
        </Dialog>
      </div>

      {/* Assign Delivery Runner Dialog — hidden on print */}
      <div className="print:hidden">
        <AssignDeliveryRunnerDialog
          orderId={order.id}
          orderNumber={order.order_number}
          deliveryAddress={order.delivery_address}
          open={showAssignRunnerDialog}
          onOpenChange={setShowAssignRunnerDialog}
          onAssigned={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId ?? '') });
          }}
        />
      </div>

      {/* Order Assign Courier Dialog — hidden on print */}
      <div className="print:hidden">
        <OrderAssignCourier
          orderId={order.id}
          orderAddress={order.delivery_address ?? ''}
          orderNumber={order.order_number}
          open={showAssignCourierDialog}
          onOpenChange={setShowAssignCourierDialog}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId ?? '') });
          }}
        />
      </div>

      {/* Order Print Dialog — hidden on print */}
      <div className="print:hidden">
        <OrderPrintDialog
          open={showPrintDialog}
          onOpenChange={setShowPrintDialog}
          order={{
            id: order.id,
            order_number: order.order_number,
            created_at: order.created_at,
            status: order.status,
            total_amount: order.total_amount,
            subtotal: order.subtotal ?? 0,
            tax_amount: order.tax_amount ?? 0,
            discount_amount: order.discount_amount ?? 0,
            delivery_fee: order.delivery_fee ?? 0,
            delivery_method: order.delivery_method || undefined,
            payment_status: order.payment_status,
            notes: order.notes || undefined,
            customer: {
              name: customerName,
              email: customerEmail || undefined,
              phone: customerPhone || undefined,
            },
            delivery_address: order.delivery_address
              ? { street: order.delivery_address }
              : undefined,
            items: (order.order_items ?? []).map(item => ({
              product_name: item.product_name,
              quantity: item.quantity,
              price: item.unit_price,
            })),
            business: tenant?.business_name
              ? { name: tenant.business_name }
              : undefined,
          }}
        />
      </div>
    </SwipeBackWrapper>
  );
}

// Default export for lazy loading
export default OrderDetailsPage;
