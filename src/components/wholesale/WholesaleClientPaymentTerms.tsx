/**
 * Wholesale Client Payment Terms Display
 * Shows payment terms and credit information for wholesale clients
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Clock, DollarSign, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";

interface PaymentTermsProps {
  creditLimit?: number;
  creditUsed?: number;
  paymentTerms: 'net_15' | 'net_30' | 'net_60' | 'due_on_receipt' | 'custom';
  customTermsDays?: number;
  overdueBalance?: number;
}

export function WholesaleClientPaymentTerms({
  creditLimit = 0,
  creditUsed = 0,
  paymentTerms,
  customTermsDays,
  overdueBalance = 0,
}: PaymentTermsProps) {
  const creditAvailable = creditLimit - creditUsed;
  const creditUtilization = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

  const getPaymentTermsLabel = () => {
    switch (paymentTerms) {
      case 'net_15':
        return 'Net 15 Days';
      case 'net_30':
        return 'Net 30 Days';
      case 'net_60':
        return 'Net 60 Days';
      case 'due_on_receipt':
        return 'Due on Receipt';
      case 'custom':
        return `Net ${customTermsDays || 0} Days`;
      default:
        return 'Not Set';
    }
  };

  const getCreditStatusColor = () => {
    if (creditUtilization >= 90) return 'destructive';
    if (creditUtilization >= 75) return 'warning';
    return 'default';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Terms & Credit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment Terms */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Payment Terms
            </span>
            <Badge variant="outline">{getPaymentTermsLabel()}</Badge>
          </div>
        </div>

        {/* Credit Information */}
        {creditLimit > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Credit Limit</span>
              <span className="font-bold">{formatCurrency(creditLimit)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Credit Used</span>
              <span>{formatCurrency(creditUsed)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Available Credit</span>
              <span className="font-medium text-success">
                {formatCurrency(creditAvailable)}
              </span>
            </div>

            {/* Credit Utilization Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Credit Utilization</span>
                <span>{creditUtilization.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    creditUtilization >= 90
                      ? 'bg-destructive'
                      : creditUtilization >= 75
                        ? 'bg-warning'
                        : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(creditUtilization, 100)}%` }}
                />
              </div>
            </div>

            {creditUtilization >= 90 && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">
                  Credit limit nearly exceeded. Please contact us to increase your limit.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Overdue Balance Warning */}
        {overdueBalance > 0 && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <DollarSign className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Overdue Balance</p>
              <p className="text-xs text-destructive/80">
                {formatCurrency(overdueBalance)} past due. Please remit payment to avoid
                account suspension.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
