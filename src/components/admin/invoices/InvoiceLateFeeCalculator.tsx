import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { differenceInDays, format } from "date-fns";
import { AlertTriangle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface InvoiceLateFeeCalculatorProps {
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  lateFeePercentage?: number;
  lateFeeApplied?: boolean;
  onApplyLateFee?: (feeAmount: number) => void;
}

/**
 * Task 300: Add invoice late fee calculation
 * Calculate and apply late fees for overdue invoices
 */
export function InvoiceLateFeeCalculator({
  invoiceId,
  invoiceNumber,
  totalAmount,
  paidAmount,
  dueDate,
  lateFeePercentage = 5,
  lateFeeApplied = false,
  onApplyLateFee,
}: InvoiceLateFeeCalculatorProps) {
  const daysOverdue = differenceInDays(new Date(), new Date(dueDate));
  const isOverdue = daysOverdue > 0 && paidAmount < totalAmount;
  const outstandingAmount = totalAmount - paidAmount;
  const lateFeeAmount = (outstandingAmount * lateFeePercentage) / 100;

  const handleApplyLateFee = () => {
    if (!isOverdue) {
      toast.error("Invoice is not overdue");
      return;
    }
    if (lateFeeApplied) {
      toast.error("Late fee already applied");
      return;
    }

    logger.info("Applying late fee", { invoiceId, lateFeeAmount });
    onApplyLateFee?.(lateFeeAmount);
    toast.success(`Late fee of ${formatCurrency(lateFeeAmount)} applied`);
  };

  if (!isOverdue) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-orange-900">
          <AlertTriangle className="h-5 w-5" />
          Late Fee Calculation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Days Overdue</div>
            <div className="font-semibold text-orange-900">{daysOverdue} days</div>
          </div>
          <div>
            <div className="text-muted-foreground">Due Date</div>
            <div className="font-semibold">{format(new Date(dueDate), "MMM dd, yyyy")}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Outstanding</div>
            <div className="font-semibold">{formatCurrency(outstandingAmount)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Late Fee ({lateFeePercentage}%)</div>
            <div className="font-semibold text-orange-900">{formatCurrency(lateFeeAmount)}</div>
          </div>
        </div>

        {lateFeeApplied ? (
          <Badge variant="outline" className="w-full justify-center">
            Late Fee Applied
          </Badge>
        ) : (
          <Button
            onClick={handleApplyLateFee}
            className="w-full"
            variant="outline"
            size="sm"
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Apply Late Fee ({formatCurrency(lateFeeAmount)})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
