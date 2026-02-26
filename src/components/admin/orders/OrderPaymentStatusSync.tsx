/**
 * OrderPaymentStatusSync Component
 *
 * Displays real-time payment status for an order with:
 * - Payment status from payments table
 * - Pay button when payment is pending
 * - Payment method and transaction ID when paid
 * - Real-time updates via Supabase subscription
 * - Auto-update order status on payment completion (if configured)
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useRealTimeSubscription } from '@/hooks/useRealtimeSubscription';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Clock from 'lucide-react/dist/esm/icons/clock';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw';
import DollarSign from 'lucide-react/dist/esm/icons/dollar-sign';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Receipt from 'lucide-react/dist/esm/icons/receipt';
import { ORDER_PAYMENT_METHODS } from '@/lib/constants/paymentMethods';

/** Payment record type */
interface PaymentRecord {
  id: string;
  order_id: string;
  tenant_id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
}

/** Props for OrderPaymentStatusSync */
interface OrderPaymentStatusSyncProps {
  /** The order ID to track payment for */
  orderId: string;
  /** The total order amount */
  orderAmount: number;
  /** Current order payment status (from order record) */
  currentPaymentStatus?: string;
  /** Whether to auto-update order status on payment completion */
  autoUpdateOrderStatus?: boolean;
  /** Callback when payment status changes */
  onPaymentStatusChange?: (newStatus: string) => void;
}

/** Payment methods available — imported from centralized constants */

/**
 * Get status configuration for visual display
 */
function getPaymentStatusConfig(status: string) {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'paid':
    case 'completed':
      return {
        icon: CheckCircle,
        label: 'Paid',
        variant: 'default' as const,
        className: 'bg-success/10 text-success border-success/20',
      };
    case 'pending':
      return {
        icon: Clock,
        label: 'Pending',
        variant: 'secondary' as const,
        className: 'bg-warning/10 text-warning border-warning/20',
      };
    case 'partial':
      return {
        icon: AlertCircle,
        label: 'Partial',
        variant: 'secondary' as const,
        className: 'bg-info/10 text-info border-info/20',
      };
    case 'refunded':
      return {
        icon: RotateCcw,
        label: 'Refunded',
        variant: 'outline' as const,
        className: 'bg-muted text-muted-foreground',
      };
    case 'failed':
      return {
        icon: AlertCircle,
        label: 'Failed',
        variant: 'destructive' as const,
        className: 'bg-destructive/10 text-destructive border-destructive/20',
      };
    default:
      return {
        icon: Clock,
        label: status.charAt(0).toUpperCase() + status.slice(1),
        variant: 'outline' as const,
        className: '',
      };
  }
}

export function OrderPaymentStatusSync({
  orderId,
  orderAmount,
  currentPaymentStatus = 'pending',
  autoUpdateOrderStatus = true,
  onPaymentStatusChange,
}: OrderPaymentStatusSyncProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [transactionId, setTransactionId] = useState('');

  // Query key for payment data
  const paymentQueryKey = queryKeys.payments.byOrder(orderId);

  // Fetch payment record for this order
  const {
    data: payment,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: paymentQueryKey,
    queryFn: async (): Promise<PaymentRecord | null> => {
      if (!tenant?.id || !orderId) return null;

      // Use type assertion since payments table may not be in generated types
      const { data, error: fetchError } = await supabase
        .from('payments')
        .select('id, order_id, tenant_id, amount, status, payment_method, transaction_id, paid_at, created_at')
        .eq('order_id', orderId)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (fetchError) {
        // Handle case where payments table doesn't exist
        if ((fetchError as { code?: string }).code === '42P01') {
          logger.debug('Payments table does not exist, using order payment status', {
            component: 'OrderPaymentStatusSync',
            orderId,
          });
          return null;
        }
        logger.error('Failed to fetch payment record', fetchError, {
          component: 'OrderPaymentStatusSync',
          orderId,
          tenantId: tenant.id,
        });
        throw fetchError;
      }

      return data as unknown as PaymentRecord | null;
    },
    enabled: !!tenant?.id && !!orderId,
    staleTime: 30_000,
  });

  // Real-time subscription for payment changes
  const { status: subscriptionStatus } = useRealTimeSubscription({
    table: 'payments',
    tenantId: tenant?.id ?? null,
    event: '*',
    enabled: !!tenant?.id && !!orderId,
    callback: useCallback(
      (payload) => {
        const newRecord = payload.new as unknown as PaymentRecord | null;
        const oldRecord = payload.old as unknown as PaymentRecord | null;

        // Only process if related to this order
        if (
          (newRecord?.order_id === orderId) ||
          (oldRecord?.order_id === orderId)
        ) {
          logger.debug('Payment update received', {
            component: 'OrderPaymentStatusSync',
            eventType: payload.eventType,
            orderId,
            paymentId: newRecord?.id || oldRecord?.id,
          });

          // Invalidate queries to refetch
          queryClient.invalidateQueries({ queryKey: paymentQueryKey });
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });

          // Notify parent of status change
          if (newRecord?.status && onPaymentStatusChange) {
            onPaymentStatusChange(newRecord.status);
          }

          // Auto-update order status if payment is completed
          if (
            autoUpdateOrderStatus &&
            payload.eventType === 'UPDATE' &&
            newRecord?.status === 'paid'
          ) {
            updateOrderPaymentStatus(newRecord.status);
          }
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps -- updateOrderPaymentStatus is a stable helper; tenant?.id is accessed from closure
      [orderId, queryClient, paymentQueryKey, onPaymentStatusChange, autoUpdateOrderStatus]
    ),
  });

  // Mutation to record a payment
  const recordPaymentMutation = useMutation({
    mutationFn: async (paymentData: {
      paymentMethod: string;
      transactionId?: string;
      amount: number;
    }) => {
      if (!tenant?.id || !orderId) throw new Error('Missing required data');

      const paymentRecord = {
        order_id: orderId,
        tenant_id: tenant.id,
        amount: paymentData.amount,
        status: 'paid',
        payment_method: paymentData.paymentMethod,
        transaction_id: paymentData.transactionId || null,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      // Insert payment record
      const { error: insertError } = await supabase
        .from('payments')
        .insert(paymentRecord);

      if (insertError) {
        // If payments table doesn't exist, update order directly
        if ((insertError as { code?: string }).code === '42P01') {
          logger.debug('Payments table not available, updating order directly', {
            component: 'OrderPaymentStatusSync',
          });
          await updateOrderPaymentStatus('paid');
          return;
        }
        throw insertError;
      }

      // Update order payment status
      await updateOrderPaymentStatus('paid');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id ?? '', orderId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists() });
      toast.success('Payment recorded successfully');
      setShowPaymentDialog(false);
      setPaymentMethod('cash');
      setTransactionId('');
    },
    onError: (error) => {
      logger.error('Failed to record payment', error, {
        component: 'OrderPaymentStatusSync',
        orderId,
      });
      toast.error('Failed to record payment', { description: humanizeError(error) });
    },
  });

  // Helper to update order payment status
  const updateOrderPaymentStatus = async (newStatus: string) => {
    if (!tenant?.id || !orderId) return;

    try {
      // Try unified_orders first
      const { error: unifiedError } = await supabase
        .from('unified_orders')
        .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (!unifiedError) {
        logger.debug('Updated payment status in unified_orders', {
          component: 'OrderPaymentStatusSync',
          orderId,
          newStatus,
        });
        return;
      }

      logger.warn('unified_orders payment update failed, falling back to orders table', {
        component: 'OrderPaymentStatusSync',
        orderId,
        error: unifiedError,
      });

      // Fallback to orders table
      const { error: ordersError } = await supabase
        .from('orders')
        .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (ordersError) {
        logger.error('Failed to update order payment status', ordersError, {
          component: 'OrderPaymentStatusSync',
          orderId,
        });
      }
    } catch (err) {
      logger.error('Error updating order payment status', err, {
        component: 'OrderPaymentStatusSync',
        orderId,
      });
    }
  };

  // Handle payment form submission
  const handleRecordPayment = () => {
    recordPaymentMutation.mutate({
      paymentMethod,
      transactionId: transactionId || undefined,
      amount: orderAmount,
    });
  };

  // Determine display status - prefer payment record status over order status
  const displayStatus = payment?.status || currentPaymentStatus;
  const statusConfig = getPaymentStatusConfig(displayStatus);
  const StatusIcon = statusConfig.icon;

  const isPending = displayStatus === 'pending' || displayStatus === 'unpaid';
  const isPaid = displayStatus === 'paid' || displayStatus === 'completed';

  // Effect to notify parent when payment record changes
  useEffect(() => {
    if (payment?.status && onPaymentStatusChange) {
      onPaymentStatusChange(payment.status);
    }
  }, [payment?.status, onPaymentStatusChange]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Unable to load payment information
          </div>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Status
            {subscriptionStatus === 'connected' && (
              <span className="ml-auto flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Payment Status Badge */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={statusConfig.variant} className={statusConfig.className}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Amount</span>
            <span className="font-semibold">{formatCurrency(orderAmount)}</span>
          </div>

          {/* Payment Details (when paid) */}
          {isPaid && payment && (
            <>
              <Separator />
              {payment.payment_method && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment Method</span>
                  <span className="text-sm font-medium capitalize">
                    {payment.payment_method.replace('_', ' ')}
                  </span>
                </div>
              )}
              {payment.transaction_id && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Transaction ID</span>
                  <span className="text-sm font-mono text-xs">{payment.transaction_id}</span>
                </div>
              )}
              {payment.paid_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Paid On</span>
                  <span className="text-sm">{formatSmartDate(payment.paid_at)}</span>
                </div>
              )}
            </>
          )}

          {/* Pay Button (when pending) */}
          {isPending && (
            <>
              <Separator />
              <Button
                className="w-full"
                onClick={() => setShowPaymentDialog(true)}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Record Payment
            </DialogTitle>
            <DialogDescription>
              Record a payment of {formatCurrency(orderAmount)} for this order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transaction-id">Transaction ID (Optional)</Label>
              <Input
                id="transaction-id"
                placeholder="Enter transaction reference"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-muted p-3">
              <div className="flex justify-between text-sm">
                <span>Amount to be recorded:</span>
                <span className="font-bold">{formatCurrency(orderAmount)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
              disabled={recordPaymentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={recordPaymentMutation.isPending}
            >
              {recordPaymentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Record Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default OrderPaymentStatusSync;
