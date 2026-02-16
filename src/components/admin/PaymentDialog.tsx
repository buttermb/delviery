import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProcessPayment } from "@/hooks/useWholesaleData";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { sanitizeFormInput, sanitizeTextareaInput } from "@/lib/utils/sanitize";

interface PaymentDialogProps {
  clientId: string;
  clientName: string;
  outstandingBalance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentDialog({ clientId, clientName, outstandingBalance, open, onOpenChange }: PaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const processPayment = useProcessPayment();

  // Reset form when dialog closes without submit
  useEffect(() => {
    if (!open) {
      setAmount("");
      setPaymentMethod("cash");
      setReferenceNumber("");
      setNotes("");
    }
  }, [open]);

  // Validation for payment amount
  const paymentValidation = useMemo(() => {
    const numAmount = parseFloat(amount);

    if (!amount || isNaN(numAmount)) {
      return { valid: false, error: null }; // Empty is not an error, just not valid for submission
    }

    if (numAmount <= 0) {
      return { valid: false, error: "Payment amount must be greater than zero" };
    }

    if (numAmount > outstandingBalance) {
      return {
        valid: false,
        error: `Payment amount ($${numAmount.toLocaleString()}) cannot exceed outstanding balance ($${outstandingBalance.toLocaleString()})`
      };
    }

    return { valid: true, error: null };
  }, [amount, outstandingBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Double-check validation before submission
    const numAmount = parseFloat(amount);
    if (numAmount > outstandingBalance) {
      toast.error("Payment amount cannot exceed outstanding balance");
      return;
    }

    if (numAmount <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }

    await processPayment.mutateAsync({
      client_id: clientId,
      amount: numAmount,
      payment_method: paymentMethod,
      reference_number: referenceNumber ? sanitizeFormInput(referenceNumber, 100) : null,
      notes: notes ? sanitizeTextareaInput(notes, 500) : null
    });

    onOpenChange(false);
    // Reset form
    setAmount("");
    setReferenceNumber("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>💰 Process Payment</DialogTitle>
          <DialogDescription>
            Record payment for {clientName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Outstanding Balance</Label>
            <div className="text-2xl font-mono font-bold text-destructive">
              ${outstandingBalance.toLocaleString()}
            </div>
          </div>

          <div>
            <Label htmlFor="amount">Payment Amount *</Label>
            <CurrencyInput
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className={paymentValidation.error ? "border-destructive" : ""}
            />
            {paymentValidation.error && (
              <div className="flex items-center gap-1.5 mt-1.5 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{paymentValidation.error}</span>
              </div>
            )}
            {parseFloat(amount) > 0 && parseFloat(amount) <= outstandingBalance && (
              <div className="text-xs text-muted-foreground mt-1">
                Remaining balance after payment: ${Math.max(0, outstandingBalance - parseFloat(amount)).toLocaleString()}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="method">Payment Method *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">💵 Cash</SelectItem>
                <SelectItem value="check">📄 Check</SelectItem>
                <SelectItem value="wire_transfer">🏦 Wire Transfer</SelectItem>
                <SelectItem value="card">💳 Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod !== "cash" && (
            <div>
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Check #, Transaction ID, etc."
              />
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!paymentValidation.valid || processPayment.isPending}
              className="flex-1"
            >
              {processPayment.isPending ? "Processing..." : "Process Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
