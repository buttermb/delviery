import { useState, useEffect } from "react";
import { Calculator, Percent, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface InvoiceLateFeeCalculatorProps {
  invoiceTotal: number;
  dueDate: string;
  onLateFeeCalculated?: (fee: number) => void;
}

/**
 * Task 300: Invoice Late Fee Calculation
 * Calculates late fees based on days overdue and configurable rate
 */
export function InvoiceLateFeeCalculator({
  invoiceTotal,
  dueDate,
  onLateFeeCalculated,
}: InvoiceLateFeeCalculatorProps) {
  const [enableLateFees, setEnableLateFees] = useState(false);
  const [feeType, setFeeType] = useState<"percentage" | "fixed">("percentage");
  const [feeRate, setFeeRate] = useState("1.5"); // 1.5% per month default
  const [fixedFee, setFixedFee] = useState("25.00");

  const daysOverdue = Math.max(0, differenceInDays(new Date(), new Date(dueDate)));
  const isOverdue = daysOverdue > 0;

  const calculateLateFee = () => {
    if (!enableLateFees || !isOverdue) return 0;

    if (feeType === "percentage") {
      const rate = parseFloat(feeRate) || 0;
      const monthsOverdue = daysOverdue / 30;
      return (invoiceTotal * rate * monthsOverdue) / 100;
    } else {
      return parseFloat(fixedFee) || 0;
    }
  };

  const lateFee = calculateLateFee();
  const totalWithFee = invoiceTotal + lateFee;

  useEffect(() => {
    if (onLateFeeCalculated) {
      onLateFeeCalculated(lateFee);
    }
  }, [lateFee, onLateFeeCalculated]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              Late Fee Calculator
            </CardTitle>
            <CardDescription>Automatic late fee calculation</CardDescription>
          </div>
          <Switch checked={enableLateFees} onCheckedChange={setEnableLateFees} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isOverdue && (
          <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">Invoice is not overdue</p>
          </div>
        )}

        {isOverdue && (
          <div className="p-3 rounded-md bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <p className="text-sm text-orange-700 dark:text-orange-300">
                <span className="font-semibold">{daysOverdue} days</span> overdue
              </p>
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                Overdue
              </Badge>
            </div>
          </div>
        )}

        {enableLateFees && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFeeType("percentage")}
                className={`p-3 rounded-md border-2 transition-colors ${
                  feeType === "percentage"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <Percent className="h-5 w-5 mb-1 mx-auto" />
                <div className="text-sm font-medium">Percentage</div>
              </button>
              <button
                type="button"
                onClick={() => setFeeType("fixed")}
                className={`p-3 rounded-md border-2 transition-colors ${
                  feeType === "fixed"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30"
                }`}
              >
                <DollarSign className="h-5 w-5 mb-1 mx-auto" />
                <div className="text-sm font-medium">Fixed Fee</div>
              </button>
            </div>

            {feeType === "percentage" ? (
              <div className="space-y-2">
                <Label>Late Fee Rate (% per month)</Label>
                <div className="relative">
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={feeRate}
                    onChange={(e) => setFeeRate(e.target.value)}
                    className="pr-9"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Fixed Late Fee</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fixedFee}
                    onChange={(e) => setFixedFee(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 p-4 rounded-md bg-muted/30 border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice Amount</span>
                <span className="font-medium">{formatCurrency(invoiceTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Late Fee</span>
                <span className="font-medium text-orange-600">{formatCurrency(lateFee)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between">
                <span className="font-semibold">Total with Late Fee</span>
                <span className="text-lg font-bold">{formatCurrency(totalWithFee)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
