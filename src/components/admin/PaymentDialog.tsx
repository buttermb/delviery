import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProcessPayment } from "@/hooks/useWholesaleData";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await processPayment.mutateAsync({
      client_id: clientId,
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      reference_number: referenceNumber || null,
      notes: notes || null
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
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={outstandingBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
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
            <Button type="submit" disabled={!amount || processPayment.isPending} className="flex-1">
              {processPayment.isPending ? "Processing..." : "Process Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
