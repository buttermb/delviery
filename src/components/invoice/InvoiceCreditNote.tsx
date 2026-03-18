import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { format } from "date-fns";

interface InvoiceCreditNoteProps {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  totalAmount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Task 299: Invoice Credit Note System
 * Creates credit notes for refunds/adjustments
 */
export function InvoiceCreditNote({
  invoiceId,
  invoiceNumber,
  clientId,
  totalAmount,
  open,
  onOpenChange,
}: InvoiceCreditNoteProps) {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const createCreditNoteMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error("No tenant");

      const creditAmount = parseFloat(amount);
      if (isNaN(creditAmount) || creditAmount <= 0) {
        throw new Error("Invalid credit amount");
      }
      if (creditAmount > totalAmount) {
        throw new Error("Credit amount cannot exceed invoice total");
      }

      // Generate credit note number
      const creditNoteNumber = `CN-${invoiceNumber}-${format(new Date(), "yyyyMMdd")}`;

      // Insert credit note
      const { error } = await supabase
        .from("invoice_credit_notes")
        .insert({
          tenant_id: tenant.id,
          invoice_id: invoiceId,
          client_id: clientId,
          credit_note_number: creditNoteNumber,
          amount: creditAmount,
          reason,
          issued_date: new Date().toISOString(),
        });

      if (error) throw error;

      return { creditNoteNumber, creditAmount };
    },
    onSuccess: ({ creditNoteNumber, creditAmount }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.invoices.detail(invoiceId) });
      toast.success("Credit note created", {
        description: `${creditNoteNumber} for ${formatCurrency(creditAmount)}`,
      });
      onOpenChange(false);
      setAmount("");
      setReason("");
    },
    onError: (error: Error) => {
      toast.error("Failed to create credit note", { description: error.message });
    },
  });

  const parsedAmount = parseFloat(amount) || 0;

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
            onClick={() => createCreditNoteMutation.mutate()}
            disabled={createCreditNoteMutation.isPending || !amount || !reason || parsedAmount <= 0}
          >
            {createCreditNoteMutation.isPending ? "Creating..." : "Create Credit Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
