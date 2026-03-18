import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { invalidateOnEvent } from "@/lib/invalidation";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { humanizeError } from "@/lib/humanizeError";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { INVOICE_PAYMENT_METHODS, formatPaymentMethod } from "@/lib/constants/paymentMethods";
import { format } from "date-fns";
import { DollarSign, Loader2 } from "lucide-react";

function createPaymentSchema(remainingAmount: number) {
  return z.object({
    amount: z
      .number({ required_error: "Amount is required" })
      .min(0.01, "Amount must be greater than 0")
      .max(remainingAmount, `Amount cannot exceed ${formatCurrency(remainingAmount)}`),
    payment_method: z.enum(
      INVOICE_PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]],
      { required_error: "Payment method is required" }
    ),
    payment_date: z.string().min(1, "Payment date is required"),
    notes: z.string().max(500).optional(),
  });
}

type PaymentFormData = z.infer<ReturnType<typeof createPaymentSchema>>;

interface PaymentHistoryEntry {
  amount: number;
  method: string;
  date: string;
  notes?: string | null;
  recorded_at: string;
}

interface InvoicePartialPaymentTrackerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  onSuccess?: () => void;
}

/**
 * Track partial payments against invoices with payment history.
 * Reads payment_history from crm_invoices and records new payments.
 */
export function InvoicePartialPaymentTracker({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  totalAmount,
  paidAmount,
  onSuccess,
}: InvoicePartialPaymentTrackerProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const remainingAmount = totalAmount - paidAmount;
  const percentPaid = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  const showAddPayment = remainingAmount > 0;

  const schema = createPaymentSchema(remainingAmount);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: undefined,
      payment_method: undefined,
      payment_date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        amount: undefined,
        payment_method: undefined,
        payment_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    }
  }, [open, form]);

  const recordPayment = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      if (!tenant?.id) throw new Error("No tenant context");

      const newAmountPaid = paidAmount + data.amount;
      const newStatus = newAmountPaid >= totalAmount ? "paid" : "partially_paid";

      // Fetch current payment_history to append
      const { data: current, error: fetchError } = await supabase
        .from("crm_invoices")
        .select("payment_history, client_id")
        .eq("id", invoiceId)
        .eq("account_id", tenant.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const existingHistory = Array.isArray(current?.payment_history)
        ? (current.payment_history as PaymentHistoryEntry[])
        : [];

      const newPayment: PaymentHistoryEntry = {
        amount: data.amount,
        method: data.payment_method,
        date: data.payment_date,
        notes: data.notes || null,
        recorded_at: new Date().toISOString(),
      };

      const updateData: Record<string, unknown> = {
        amount_paid: newAmountPaid,
        payment_history: [...existingHistory, newPayment],
        status: newStatus,
      };

      if (newStatus === "paid") {
        updateData.paid_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("crm_invoices")
        .update(updateData)
        .eq("id", invoiceId)
        .eq("account_id", tenant.id);

      if (updateError) throw updateError;

      return {
        newStatus,
        paymentAmount: data.amount,
        clientId: current?.client_id as string | undefined,
      };
    },
    onSuccess: ({ newStatus, paymentAmount, clientId }) => {
      if (tenant?.id) {
        invalidateOnEvent(queryClient, "INVOICE_PAID", tenant.id, {
          invoiceId,
          customerId: clientId,
        });
      }

      const isPaidInFull = newStatus === "paid";
      toast.success(
        isPaidInFull ? "Invoice paid in full" : "Payment recorded",
        {
          description: `${formatCurrency(paymentAmount)} recorded${
            !isPaidInFull
              ? `. Balance: ${formatCurrency(remainingAmount - paymentAmount)}`
              : ""
          }`,
        }
      );

      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      logger.error("Failed to record partial payment", { error, invoiceId });
      toast.error("Failed to record payment", {
        description: humanizeError(error),
      });
    },
  });

  // Fetch payment history from the invoice
  const { data: invoiceData } = useInvoicePaymentHistory(invoiceId, tenant?.id, open);
  const payments: PaymentHistoryEntry[] = Array.isArray(invoiceData?.payment_history)
    ? (invoiceData.payment_history as PaymentHistoryEntry[])
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Payment Tracking - Invoice #{invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(totalAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Paid</div>
                  <div className="text-lg font-semibold text-emerald-600">
                    {formatCurrency(paidAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                  <div className="text-lg font-semibold text-orange-600">
                    {formatCurrency(remainingAmount)}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{percentPaid.toFixed(1)}%</span>
                </div>
                <Progress value={percentPaid} className="h-2" />
              </div>
              {remainingAmount <= 0 && (
                <Badge className="w-full justify-center" variant="default">
                  Fully Paid
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payments.map((payment, idx) => (
                    <div
                      key={`${payment.recorded_at}-${idx}`}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">
                          {formatCurrency(payment.amount)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(payment.date), "MMM dd, yyyy")} &bull;{" "}
                          {formatPaymentMethod(payment.method)}
                        </div>
                        {payment.notes && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {payment.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Payment Form */}
          {showAddPayment && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) =>
                      recordPayment.mutate(data)
                    )}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={remainingAmount}
                                placeholder="0.00"
                                {...field}
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value
                                      ? Number(e.target.value)
                                      : undefined
                                  )
                                }
                              />
                            </FormControl>
                            <FormDescription>
                              Max: {formatCurrency(remainingAmount)}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="payment_method"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Method</FormLabel>
                            <Select
                              value={field.value ?? ""}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {INVOICE_PAYMENT_METHODS.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="payment_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Reference number, confirmation, etc..."
                              maxLength={500}
                              rows={2}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={recordPayment.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={recordPayment.isPending}
                      >
                        {recordPayment.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Record Payment
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Fetch payment history from the crm_invoices table */
function useInvoicePaymentHistory(
  invoiceId: string,
  tenantId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: [...queryKeys.crm.invoices.detail(invoiceId), "payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_invoices")
        .select("payment_history")
        .eq("id", invoiceId)
        .eq("account_id", tenantId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && !!invoiceId && enabled,
  });
}
