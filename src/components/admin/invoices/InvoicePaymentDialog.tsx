import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { supabase } from '@/integrations/supabase/client';
import { useAccountIdSafe } from '@/hooks/crm/useAccountId';
import { crmInvoiceKeys } from '@/hooks/crm/useInvoices';
import { invalidateOnEvent } from '@/lib/invalidation';
import { formatCurrency } from '@/utils/formatters';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { Loader2, AlertCircle, DollarSign } from 'lucide-react';
import { INVOICE_PAYMENT_METHODS } from '@/lib/constants/paymentMethods';
import { useDirtyFormGuard } from '@/hooks/useDirtyFormGuard';

interface InvoicePaymentDialogProps {
  invoiceId: string;
  amountDue: number;
  amountPaid: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function createPaymentSchema(remaining: number) {
  return z.object({
    amount: z
      .number({ required_error: 'Amount is required' })
      .positive('Amount must be greater than 0')
      .max(remaining, `Amount cannot exceed remaining balance of ${formatCurrency(remaining)}`),
    payment_method: z.enum(
      INVOICE_PAYMENT_METHODS.map(m => m.value) as [string, ...string[]],
      { required_error: 'Payment method is required' }
    ),
    payment_date: z.date({ required_error: 'Payment date is required' }),
    reference: z.string().optional(),
    notes: z.string().optional(),
  });
}

type PaymentFormValues = z.infer<ReturnType<typeof createPaymentSchema>>;

export function InvoicePaymentDialog({
  invoiceId,
  amountDue,
  amountPaid,
  open,
  onOpenChange,
  onSuccess,
}: InvoicePaymentDialogProps) {
  const accountId = useAccountIdSafe();
  const queryClient = useQueryClient();
  const remaining = amountDue - (amountPaid || 0);

  const schema = createPaymentSchema(remaining);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
    setValue,
    watch,
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: undefined,
      payment_method: undefined,
      payment_date: new Date(),
      reference: '',
      notes: '',
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      reset({
        amount: undefined,
        payment_method: undefined,
        payment_date: new Date(),
        reference: '',
        notes: '',
      });
    }
  }, [open, reset]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const { guardedOnOpenChange, dialogContentProps, DiscardAlert } = useDirtyFormGuard(isDirty, handleClose);

  const recordPayment = useMutation({
    mutationFn: async (values: PaymentFormValues) => {
      if (!accountId) throw new Error('Account ID required');

      const newAmountPaid = (amountPaid || 0) + values.amount;
      const newStatus = newAmountPaid >= amountDue ? 'paid' : 'partially_paid';

      // Build payment record for history
      const paymentRecord = {
        amount: values.amount,
        method: values.payment_method,
        date: values.payment_date.toISOString(),
        reference: values.reference || null,
        notes: values.notes || null,
        recorded_at: new Date().toISOString(),
      };

      // Fetch current payment_history to append
      const { data: current, error: fetchError } = await supabase
        .from('crm_invoices')
        .select('payment_history')
        .eq('id', invoiceId)
        .eq('account_id', accountId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const existingHistory = Array.isArray(current?.payment_history)
        ? current.payment_history
        : [];
      const updatedHistory = [...existingHistory, paymentRecord];

      const updateData: Record<string, unknown> = {
        amount_paid: newAmountPaid,
        payment_history: updatedHistory,
        status: newStatus,
      };

      if (newStatus === 'paid') {
        updateData.paid_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('crm_invoices')
        .update(updateData)
        .eq('id', invoiceId)
        .eq('account_id', accountId)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: crmInvoiceKeys.all });
      if (accountId) {
        invalidateOnEvent(queryClient, 'INVOICE_PAID', accountId, {
          invoiceId,
          customerId: (data as Record<string, unknown>)?.client_id as string,
        });
      }
      const newPaid = (amountPaid || 0) + (watch('amount') || 0);
      const isPaidInFull = newPaid >= amountDue;
      toast.success(
        isPaidInFull ? 'Invoice paid in full' : 'Payment recorded',
        { description: `${formatCurrency(watch('amount') || 0)} recorded` }
      );
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      logger.error('Failed to record payment', { error, invoiceId });
      toast.error('Failed to record payment', { description: error.message });
    },
  });

  const onSubmit = (values: PaymentFormValues) => {
    recordPayment.mutate(values);
  };

  const watchAmount = watch('amount');

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="sm:max-w-md" {...dialogContentProps}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Balance remaining: {formatCurrency(remaining)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Amount <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  id="payment-amount"
                  placeholder="0.00"
                  value={field.value !== undefined ? String(field.value) : ''}
                  onValueChange={(val) => field.onChange(val)}
                  className={errors.amount ? 'border-destructive' : ''}
                />
              )}
            />
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount.message}</p>
            )}
            {remaining > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-auto p-0"
                onClick={() => setValue('amount', remaining, { shouldValidate: true })}
              >
                Pay full balance: {formatCurrency(remaining)}
              </Button>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
            <Controller
              name="payment_method"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ''}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className={errors.payment_method ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.payment_method && (
              <p className="text-sm text-destructive">{errors.payment_method.message}</p>
            )}
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label>Payment Date <span className="text-destructive ml-0.5" aria-hidden="true">*</span></Label>
            <Controller
              name="payment_date"
              control={control}
              render={({ field }) => (
                <DatePickerWithPresets
                  date={field.value}
                  onDateChange={(date) => field.onChange(date)}
                  showPastPresets
                  placeholder="Select date"
                />
              )}
            />
            {errors.payment_date && (
              <p className="text-sm text-destructive">{errors.payment_date.message}</p>
            )}
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label htmlFor="payment-reference">Reference (optional)</Label>
            <Controller
              name="reference"
              control={control}
              render={({ field }) => (
                <Input
                  id="payment-reference"
                  placeholder="Check #, transaction ID, etc."
                  {...field}
                />
              )}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <Textarea
                  id="payment-notes"
                  placeholder="Additional notes..."
                  rows={2}
                  {...field}
                />
              )}
            />
          </div>

          {/* Summary */}
          {watchAmount !== undefined && watchAmount > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Recording {formatCurrency(watchAmount)} payment.{' '}
                {(amountPaid || 0) + watchAmount >= amountDue
                  ? 'This will mark the invoice as paid in full.'
                  : `Remaining after: ${formatCurrency(remaining - watchAmount)}`}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => guardedOnOpenChange(false)}
              disabled={recordPayment.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={recordPayment.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {recordPayment.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Payment'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <DiscardAlert />
    </>
  );
}
