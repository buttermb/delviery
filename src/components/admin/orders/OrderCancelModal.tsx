import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Package from "lucide-react/dist/esm/icons/package";
import { logger } from '@/lib/logger';
import { useOrderCancellation } from '@/hooks/useOrderCancellation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// Predefined cancellation reasons
const CANCELLATION_REASONS = [
  { value: 'customer_request', label: 'Customer requested cancellation' },
  { value: 'out_of_stock', label: 'Product out of stock' },
  { value: 'payment_failed', label: 'Payment failed or declined' },
  { value: 'unable_to_deliver', label: 'Unable to deliver to address' },
  { value: 'duplicate_order', label: 'Duplicate order' },
  { value: 'pricing_error', label: 'Pricing error' },
  { value: 'compliance_issue', label: 'Compliance issue' },
  { value: 'fraud_suspected', label: 'Suspected fraudulent order' },
  { value: 'other', label: 'Other (specify in notes)' },
] as const;

// Form validation schema
const cancelOrderSchema = z.object({
  reason: z.string().min(1, 'Please select a cancellation reason'),
  notes: z.string().optional(),
  restockItems: z.boolean().default(true),
});

type CancelOrderFormData = z.infer<typeof cancelOrderSchema>;

interface OrderCancelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber?: string;
  onSuccess?: () => void;
}

export function OrderCancelModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onSuccess,
}: OrderCancelModalProps) {
  const { cancelOrder, isCancelling } = useOrderCancellation();

  const form = useForm<CancelOrderFormData>({
    resolver: zodResolver(cancelOrderSchema),
    defaultValues: {
      reason: '',
      notes: '',
      restockItems: true,
    },
  });

  const handleSubmit = (data: CancelOrderFormData) => {
    // Build the full cancellation reason with notes
    const reasonLabel = CANCELLATION_REASONS.find(r => r.value === data.reason)?.label || data.reason;
    const fullReason = data.notes
      ? `${reasonLabel}: ${data.notes}`
      : reasonLabel;

    cancelOrder({
      orderId,
      reason: fullReason,
      restoreInventory: data.restockItems,
    });

    // Handle success locally
    logger.info('Order cancellation submitted', {
      orderId,
      reason: data.reason,
      restoreInventory: data.restockItems,
    });

    // Reset form and close modal
    form.reset();
    onOpenChange(false);
    onSuccess?.();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form when closing
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const selectedReason = form.watch('reason');
  const showNotesRequired = selectedReason === 'other';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancel Order
          </DialogTitle>
          <DialogDescription>
            {orderNumber
              ? `You are about to cancel order ${orderNumber}. This action cannot be undone.`
              : 'You are about to cancel this order. This action cannot be undone.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cancellation Reason *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-autofocus>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CANCELLATION_REASONS.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Additional Notes {showNotesRequired && '*'}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide any additional details about the cancellation..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {showNotesRequired
                      ? 'Please provide details for the cancellation.'
                      : 'Optional: Add context for the cancellation.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="restockItems"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <Label
                      htmlFor="restockItems"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Package className="h-4 w-4 text-muted-foreground" />
                      Restock Items
                    </Label>
                    <FormDescription>
                      Return items to inventory and reverse any balance changes.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isCancelling}
              >
                Keep Order
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isCancelling || !form.formState.isValid}
              >
                {isCancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cancel Order
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
