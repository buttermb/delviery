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
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { format } from "date-fns";
import { FileText, Loader2, Minus } from "lucide-react";

const creditNoteSchema = z.object({
  credit_amount: z.number().min(0.01, "Amount must be greater than 0"),
  reason: z.enum(["return", "discount", "overpayment", "adjustment", "other"]),
  notes: z.string().max(1000),
  issue_date: z.string(),
});

type CreditNoteFormData = z.infer<typeof creditNoteSchema>;

interface CreditNote {
  id: string;
  credit_note_number: string;
  credit_amount: number;
  reason: string;
  notes?: string;
  issue_date: string;
  status: "draft" | "issued" | "applied";
  created_at: string;
}

interface InvoiceCreditNoteSystemProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  invoiceAmount: number;
  creditNotes?: CreditNote[];
  onSuccess?: () => void;
}

/**
 * Task 299: Create invoice credit note system
 * Issue credit notes for returns, adjustments, and overpayments
 */
export function InvoiceCreditNoteSystem({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  invoiceAmount,
  creditNotes = [],
  onSuccess,
}: InvoiceCreditNoteSystemProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const totalCreditIssued = creditNotes.reduce((sum, note) => sum + note.credit_amount, 0);

  const form = useForm<CreditNoteFormData>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: {
      credit_amount: 0,
      reason: "return",
      notes: "",
      issue_date: new Date().toISOString().split("T")[0],
    },
  });

  const onSubmit = async (data: CreditNoteFormData) => {
    if (data.credit_amount > invoiceAmount) {
      toast.error("Credit amount cannot exceed invoice amount");
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Wire to Supabase invoice_credit_notes table
      logger.info("Creating credit note", { invoiceId, data });
      toast.success(`Credit note created for ${formatCurrency(data.credit_amount)}`);
      form.reset();
      setShowCreateForm(false);
      onSuccess?.();
    } catch (error) {
      logger.error("Failed to create credit note", { error });
      toast.error("Failed to create credit note");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      return: "Product Return",
      discount: "Discount Applied",
      overpayment: "Overpayment",
      adjustment: "Adjustment",
      other: "Other",
    };
    return labels[reason] || reason;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      draft: "secondary",
      issued: "default",
      applied: "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Credit Notes - Invoice #{invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Credit Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-sm text-muted-foreground">Invoice Amount</div>
                <div className="text-lg font-semibold">{formatCurrency(invoiceAmount)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Credits</div>
                <div className="text-lg font-semibold text-emerald-600">
                  -{formatCurrency(totalCreditIssued)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Existing Credit Notes */}
          {creditNotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Credit Notes ({creditNotes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {creditNotes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-start justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">#{note.credit_note_number}</span>
                          {getStatusBadge(note.status)}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatCurrency(note.credit_amount)} • {getReasonLabel(note.reason)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(note.issue_date), "MMM dd, yyyy")}
                        </div>
                        {note.notes && (
                          <div className="text-sm text-muted-foreground mt-2">{note.notes}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create Credit Note Form */}
          {showCreateForm ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Issue Credit Note</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="credit_amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Credit Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={invoiceAmount}
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              Max: {formatCurrency(invoiceAmount)}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reason</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="return">Product Return</SelectItem>
                                <SelectItem value="discount">Discount Applied</SelectItem>
                                <SelectItem value="overpayment">Overpayment</SelectItem>
                                <SelectItem value="adjustment">Adjustment</SelectItem>
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
                      name="issue_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Issue Date</FormLabel>
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
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Reason for credit note, reference numbers, etc..."
                              maxLength={1000}
                              rows={3}
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
                        onClick={() => setShowCreateForm(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Issue Credit Note
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          ) : (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="w-full"
              variant="outline"
            >
              <Minus className="mr-2 h-4 w-4" />
              Issue Credit Note
            </Button>
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
