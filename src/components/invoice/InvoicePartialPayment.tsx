import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DollarSign, CreditCard, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface InvoicePartialPaymentProps {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Task 298: Invoice Partial Payment Tracking
 * Records partial payments and updates invoice status
 */
export function InvoicePartialPayment({
  invoiceId,
  invoiceNumber,
  totalAmount,
  amountPaid,
  open,
  onOpenChange,
}: InvoicePartialPaymentProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  const remainingBalance = totalAmount - amountPaid;

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error("No tenant");

      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        throw new Error("Invalid payment amount");
      }
      if (paymentAmount > remainingBalance) {
        throw new Error("Payment amount exceeds remaining balance");
      }

      const newAmountPaid = amountPaid + paymentAmount;
      const newStatus = newAmountPaid >= totalAmount ? "paid" : "partially_paid";

      // Get current payment history
      const { data: currentInvoice } = await supabase
        .from("crm_invoices")
        .select("payment_history")
        .eq("id", invoiceId)
        .eq("account_id", tenant.id)
        .maybeSingle();

      const paymentHistory = (currentInvoice?.payment_history as unknown[]) || [];
      const newPayment = {
        amount: paymentAmount,
        date: paymentDate,
        method: paymentMethod,
        notes: notes || null,
        recorded_at: new Date().toISOString(),
      };

      // Update invoice
      const { error } = await supabase
        .from("crm_invoices")
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
          payment_history: [...paymentHistory, newPayment],
          paid_at: newStatus === "paid" ? new Date().toISOString() : null,
        })
        .eq("id", invoiceId)
        .eq("account_id", tenant.id);

      if (error) throw error;

      return { newStatus, paymentAmount };
    },
    onSuccess: ({ newStatus, paymentAmount }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.detail(invoiceId) });
      toast.success("Payment recorded", {
        description: `${formatCurrency(paymentAmount)} recorded. ${newStatus === "paid" ? "Invoice fully paid!" : `Balance: ${formatCurrency(remainingBalance - paymentAmount)}`}`,
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error("Failed to record payment", { description: error.message });
    },
  });

  function resetForm() {
    setAmount("");
    setPaymentMethod("bank_transfer");
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
    setNotes("");
  }

  const parsedAmount = parseFloat(amount) || 0;
  const newBalance = remainingBalance - parsedAmount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Record Partial Payment
          </DialogTitle>
          <DialogDescription>Invoice {invoiceNumber}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-muted/30">
            <div>
              <div className="text-xs text-muted-foreground">Total Amount</div>
              <div className="text-lg font-semibold">{formatCurrency(totalAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Already Paid</div>
              <div className="text-lg font-semibold">{formatCurrency(amountPaid)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground">Remaining Balance</div>
              <div className="text-2xl font-bold text-primary">{formatCurrency(remainingBalance)}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remainingBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9"
                placeholder="0.00"
              />
            </div>
            {parsedAmount > 0 && (
              <p className="text-sm text-muted-foreground">
                New balance: {formatCurrency(newBalance >= 0 ? newBalance : 0)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="paymentMethod">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="debit_card">Debit Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="pl-9"
                max={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Transaction reference, check number, etc."
              rows={2}
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => recordPaymentMutation.mutate()}
            disabled={recordPaymentMutation.isPending || !amount || parsedAmount <= 0}
          >
            {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
