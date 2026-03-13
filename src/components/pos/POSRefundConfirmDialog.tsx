import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import { formatCurrency } from '@/lib/formatters';
import type { UnifiedOrder, UnifiedOrderItem } from '@/hooks/useUnifiedOrders';

const REFUND_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'original_method', label: 'Original Payment Method' },
] as const;

type RefundMethodValue = (typeof REFUND_METHODS)[number]['value'];

const refundFormSchema = z.object({
  refundAmount: z.number().positive('Refund amount must be greater than zero'),
  refundMethod: z.enum(['cash', 'original_method'] as const),
  notes: z.string().max(500).optional(),
});

export type RefundFormValues = z.infer<typeof refundFormSchema>;

type OrderWithItems = Pick<
  UnifiedOrder,
  'id' | 'order_number' | 'order_type' | 'status' | 'total_amount' |
  'payment_method' | 'payment_status' | 'subtotal' | 'tax_amount' |
  'discount_amount' | 'tenant_id' | 'created_at'
> & { unified_order_items: UnifiedOrderItem[] };

interface POSRefundConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderWithItems;
  selectedItems: Set<string>;
  selectedRefundTotal: number;
  onConfirm: (values: RefundFormValues) => void;
  isProcessing: boolean;
}

export function POSRefundConfirmDialog({
  open,
  onOpenChange,
  order,
  selectedItems,
  selectedRefundTotal,
  onConfirm,
  isProcessing,
}: POSRefundConfirmDialogProps) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RefundFormValues>({
    resolver: zodResolver(refundFormSchema),
    defaultValues: {
      refundAmount: selectedRefundTotal,
      refundMethod: 'cash',
      notes: '',
    },
  });

  const currentRefundAmount = watch('refundAmount');

  const onSubmit = (values: RefundFormValues) => {
    onConfirm(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Refund</DialogTitle>
          <DialogDescription>
            Review refund details for order {order.order_number}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Refund Summary */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Order Total</span>
              <span className="font-medium">{formatCurrency(order.total_amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Items Selected</span>
              <span className="font-medium">{selectedItems.size}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Calculated Refund</span>
              <span className="font-semibold">{formatCurrency(selectedRefundTotal)}</span>
            </div>
          </div>

          {/* Refund Amount */}
          <div className="space-y-2">
            <Label htmlFor="pos-refund-amount">
              Refund Amount <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
            </Label>
            <Controller
              name="refundAmount"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  id="pos-refund-amount"
                  value={field.value?.toString() ?? ''}
                  onValueChange={(val) => field.onChange(val ?? 0)}
                  placeholder="0.00"
                  className={errors.refundAmount ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.refundAmount && (
              <p className="text-sm text-destructive">{errors.refundAmount.message}</p>
            )}
          </div>

          {/* Refund Method */}
          <div className="space-y-2">
            <Label htmlFor="pos-refund-method">
              Refund Method <span className="text-destructive ml-0.5" aria-hidden="true">*</span>
            </Label>
            <Controller
              name="refundMethod"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) => field.onChange(val as RefundMethodValue)}
                >
                  <SelectTrigger id="pos-refund-method">
                    <SelectValue placeholder="Select refund method" />
                  </SelectTrigger>
                  <SelectContent>
                    {REFUND_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.refundMethod && (
              <p className="text-sm text-destructive">{errors.refundMethod.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="pos-refund-notes">Refund Reason (Optional)</Label>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <Textarea
                  id="pos-refund-notes"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Reason for return..."
                  rows={3}
                />
              )}
            />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>

          {/* Total Alert */}
          {currentRefundAmount > 0 && (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <span className="font-medium">Refund Total:</span>
                <span className="text-lg font-bold">{formatCurrency(currentRefundAmount)}</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Confirm Refund (${formatCurrency(currentRefundAmount)})`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
