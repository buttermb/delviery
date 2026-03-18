import { useState } from "react";
import { FileText, Minus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { useCreateCreditNote } from "@/hooks/crm/useCreditNotes";

interface InvoiceCreditNoteProps {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  totalAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Invoice Credit Note — creates credit notes for refunds/adjustments.
 * Uses shared useCreditNotes hook for Supabase integration.
 */
export function InvoiceCreditNote({
  invoiceId,
  invoiceNumber,
  clientId,
  totalAmount,
  open,
  onOpenChange,
}: InvoiceCreditNoteProps) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const createCreditNote = useCreateCreditNote();

  const parsedAmount = parseFloat(amount) || 0;

  const handleCreate = () => {
    if (parsedAmount <= 0 || parsedAmount > totalAmount) {
      toast.error("Invalid credit amount");
      return;
    }

    createCreditNote.mutate(
      {
        invoice_id: invoiceId,
        client_id: clientId,
        amount: parsedAmount,
        reason,
      },
      {
        onSuccess: (data) => {
          toast.success("Credit note created", {
            description: `${data?.credit_note_number ?? "Credit note"} for ${formatCurrency(parsedAmount)}`,
          });
          onOpenChange(false);
          setAmount("");
          setReason("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            Create Credit Note
          </DialogTitle>
          <DialogDescription>Invoice {invoiceNumber}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-md bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
            <p className="text-sm text-orange-800 dark:text-orange-200">
              A credit note reduces the amount owed on this invoice. Use it for refunds, discounts, or
              corrections.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 p-3 rounded-md bg-muted/30">
            <div>
              <div className="text-xs text-muted-foreground">Invoice Total</div>
              <div className="text-lg font-semibold">{formatCurrency(totalAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Max Credit</div>
              <div className="text-lg font-semibold">{formatCurrency(totalAmount)}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Credit Amount *</Label>
            <div className="relative">
              <Minus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={totalAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9"
                placeholder="0.00"
              />
            </div>
            {parsedAmount > 0 && (
              <p className="text-sm text-muted-foreground">
                New invoice total: {formatCurrency(totalAmount - parsedAmount)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Product return, service credit, billing error"
              rows={3}
              maxLength={500}
              required
            />
            <p className="text-xs text-muted-foreground">{reason.length}/500 characters</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createCreditNote.isPending || !amount || !reason || parsedAmount <= 0}
          >
            {createCreditNote.isPending ? "Creating..." : "Create Credit Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
