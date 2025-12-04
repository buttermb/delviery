import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';

interface WholesaleOrder {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  payment_status: string;
  client_id?: string;
  client?: {
    id: string;
    business_name: string;
    outstanding_balance?: number;
    credit_limit?: number;
  };
}

interface CancelWholesaleOrderDialogProps {
  order: WholesaleOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CancelWholesaleOrderDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: CancelWholesaleOrderDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [reverseCreditImpact, setReverseCreditImpact] = useState(true);

  const handleCancel = async () => {
    if (!order) return;

    setIsSubmitting(true);

    try {
      // Update order status to cancelled
      const { error: orderError } = await supabase
        .from('wholesale_orders')
        .update({
          status: 'cancelled',
          delivery_notes: order.status !== 'cancelled' 
            ? `[CANCELLED] ${cancellationReason || 'No reason provided'}\n\n${order.status || ''}`
            : order.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // If the order was on credit and we're reversing the credit impact
      // Use client_id (not business_name) for reliable lookup
      const clientId = order.client_id || order.client?.id;
      if (reverseCreditImpact && order.payment_status !== 'paid' && clientId) {
        // Use atomic RPC to prevent race conditions on balance update
        // @ts-ignore - RPC function not in auto-generated types
        const { error: clientError } = await supabase.rpc('adjust_client_balance' as any, {
          p_client_id: clientId,
          p_amount: order.total_amount,
          p_operation: 'subtract'
        });

        if (clientError) {
          // Fallback to direct update if RPC doesn't exist yet
          if (clientError.code === 'PGRST202') {
            const currentBalance = order.client?.outstanding_balance || 0;
            const newBalance = Math.max(0, currentBalance - order.total_amount);
            
            await supabase
              .from('wholesale_clients')
              .update({
                outstanding_balance: newBalance,
                updated_at: new Date().toISOString(),
              })
              .eq('id', clientId);
          } else {
            logger.warn('Failed to reverse credit impact', { error: clientError, component: 'CancelWholesaleOrderDialog' });
          }
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });
      queryClient.invalidateQueries({ queryKey: ['wholesale-clients'] });

      toast.success('Order cancelled successfully');
      onOpenChange(false);
      setCancellationReason('');
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to cancel order', error, { component: 'CancelWholesaleOrderDialog' });
      toast.error('Failed to cancel order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  const isAlreadyCancelled = order.status === 'cancelled';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancel Order #{order.order_number}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            {isAlreadyCancelled ? (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">This order is already cancelled.</p>
              </div>
            ) : (
              <>
                <p>
                  This action will cancel the order and cannot be undone. The order will be marked
                  as cancelled in the system.
                </p>

                {/* Order Summary */}
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client:</span>
                    <span className="font-medium">{order.client?.business_name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order Total:</span>
                    <span className="font-mono font-semibold">{formatCurrency(order.total_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Current Status:</span>
                    <Badge variant="outline">{order.status}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Payment:</span>
                    <Badge variant="outline">{order.payment_status}</Badge>
                  </div>
                </div>

                {/* Credit Reversal Option */}
                {order.payment_status !== 'paid' && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <Checkbox
                      id="reverse-credit"
                      checked={reverseCreditImpact}
                      onCheckedChange={(checked) => setReverseCreditImpact(!!checked)}
                    />
                    <div>
                      <Label htmlFor="reverse-credit" className="cursor-pointer font-medium">
                        Reverse credit impact
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Reduce client's outstanding balance by {formatCurrency(order.total_amount)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Cancellation Reason */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Cancellation Reason (Optional)</Label>
                  <Textarea
                    id="reason"
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    placeholder="Why is this order being cancelled?"
                    rows={3}
                  />
                </div>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {isAlreadyCancelled ? 'Close' : 'Keep Order'}
          </AlertDialogCancel>
          {!isAlreadyCancelled && (
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel Order'
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default CancelWholesaleOrderDialog;

