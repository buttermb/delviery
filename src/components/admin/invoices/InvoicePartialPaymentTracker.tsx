import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { format } from "date-fns";
import { DollarSign, Loader2, Plus } from "lucide-react";

const paymentSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  payment_method: z.enum(["cash", "card", "check", "bank_transfer", "other"]),
  payment_date: z.string(),
  notes: z.string().max(500).optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes?: string;
  created_at: string;
}

interface InvoicePartialPaymentTrackerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  payments?: Payment[];
  onSuccess?: () => void;
}

/**
 * Task 298: Wire invoice partial payment tracking
 * Track partial payments against invoices with payment history
 */
export function InvoicePartialPaymentTracker({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  totalAmount,
  paidAmount,
  payments = [],
  onSuccess,
}: InvoicePartialPaymentTrackerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

  const remainingAmount = totalAmount - paidAmount;
  const percentPaid = (paidAmount / totalAmount) * 100;

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: remainingAmount,
      payment_method: "card",
      payment_date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const onSubmit = async (data: PaymentFormData) => {
    setIsSubmitting(true);
    try {
      // TODO: Wire to Supabase invoice_payments table
      logger.info("Recording partial payment", { invoiceId, data });
      toast.success(`Payment of ${formatCurrency(data.amount)} recorded`);
      form.reset();
      setShowAddPayment(false);
      onSuccess?.();
    } catch (error) {
      logger.error("Failed to record payment", { error });
      toast.error("Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Payment Tracking - Invoice #{invoiceNumber}
            <Badge variant="outline" className="text-muted-foreground">Coming Soon</Badge>
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
                  <div className="text-lg font-semibold">{formatCurrency(totalAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Paid</div>
                  <div className="text-lg font-semibold text-emerald-600">{formatCurrency(paidAmount)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Remaining</div>
                  <div className="text-lg font-semibold text-orange-600">{formatCurrency(remainingAmount)}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{percentPaid.toFixed(1)}%</span>
                </div>
                <Progress value={percentPaid} className="h-2" />
              </div>
              {remainingAmount === 0 && (
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
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-semibold">{formatCurrency(payment.amount)}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(payment.payment_date), "MMM dd, yyyy")} • {payment.payment_method}
                        </div>
                        {payment.notes && (
                          <div className="text-sm text-muted-foreground mt-1">{payment.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add Payment Form */}
          {showAddPayment ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
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
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="check">Check</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
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
                        onClick={() => setShowAddPayment(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Record Payment
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          ) : (
            remainingAmount > 0 && (
              <Button
                onClick={() => setShowAddPayment(true)}
                className="w-full"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            )
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
