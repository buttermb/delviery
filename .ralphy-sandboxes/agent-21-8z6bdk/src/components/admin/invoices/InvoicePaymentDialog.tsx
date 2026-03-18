import { useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DatePickerWithPresets } from '@/components/ui/date-picker-with-presets';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { supabase } from '@/integrations/supabase/client';
import { useAccountIdSafe } from '@/hooks/crm/useAccountId';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOnEvent } from '@/lib/invalidation';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
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
  const remaining = amountDue - (amountPaid ?? 0);

  const schema = createPaymentSchema(remaining);

  const form = useForm<PaymentFormValues>({
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
      form.reset({
        amount: undefined,
        payment_method: undefined,
        payment_date: new Date(),
        reference: '',
        notes: '',
      });
    }
  }, [open, form]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const { guardedOnOpenChange, dialogContentProps, DiscardAlert } = useDirtyFormGuard(form.formState.isDirty, handleClose);

  const recordPayment = useMutation({
    mutationFn: async (values: PaymentFormValues) => {
      if (!accountId) throw new Error('Account ID required');

      const newAmountPaid = (amountPaid ?? 0) + values.amount;
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
        .select('id, client_id, amount_paid, status, paid_at, payment_history')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.all() });
      if (accountId) {
        invalidateOnEvent(queryClient, 'INVOICE_PAID', accountId, {
          invoiceId,
          customerId: (data as Record<string, unknown>)?.client_id as string,
        });
      }
      const newPaid = (amountPaid ?? 0) + (form.watch('amount') ?? 0);
      const isPaidInFull = newPaid >= amountDue;
      toast.success(
        isPaidInFull ? 'Invoice paid in full' : 'Payment recorded',
        { description: `${formatCurrency(form.watch('amount') ?? 0)} recorded` }
      );
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      logger.error('Failed to record payment', { error, invoiceId });
      toast.error('Failed to record payment', { description: humanizeError(error) });
    },
  });

  const onSubmit = (values: PaymentFormValues) => {
    recordPayment.mutate(values);
  };

  const watchAmount = form.watch('amount');

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

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Amount</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      placeholder="0.00"
                      value={field.value !== undefined ? String(field.value) : ''}
                      onValueChange={(val) => field.onChange(val)}
                    />
                  </FormControl>
                  <FormMessage />
                  {remaining > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-auto p-0"
                      onClick={() => form.setValue('amount', remaining, { shouldValidate: true })}
                    >
                      Pay full balance: {formatCurrency(remaining)}
                    </Button>
                  )}
                </FormItem>
              )}
            />

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Payment Method</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Date */}
            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Payment Date</FormLabel>
                  <FormControl>
                    <DatePickerWithPresets
                      date={field.value}
                      onDateChange={(date) => field.onChange(date)}
                      showPastPresets
                      placeholder="Select date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference */}
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Check #, transaction ID, etc."
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Summary */}
            {watchAmount !== undefined && watchAmount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Recording {formatCurrency(watchAmount)} payment.{' '}
                  {(amountPaid ?? 0) + watchAmount >= amountDue
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
        </Form>
      </DialogContent>
    </Dialog>
    <DiscardAlert />
    </>
  );
}
