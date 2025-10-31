import { AlertCircle, XCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface CreditCheckAlertProps {
  clientName: string;
  orderTotal: number;
  availableCredit: number;
  outstandingBalance: number;
  creditLimit: number;
  onApprove?: () => void;
  onCancel?: () => void;
}

export function CreditCheckAlert({
  clientName,
  orderTotal,
  availableCredit,
  outstandingBalance,
  creditLimit,
  onApprove,
  onCancel
}: CreditCheckAlertProps) {
  const exceedsLimit = orderTotal > availableCredit;
  const newBalance = outstandingBalance + orderTotal;
  const utilizationPercent = ((newBalance / creditLimit) * 100).toFixed(1);

  if (exceedsLimit) {
    return (
      <Alert variant="destructive" className="border-2">
        <XCircle className="h-5 w-5" />
        <AlertTitle className="font-bold">Credit Limit Exceeded</AlertTitle>
        <AlertDescription className="space-y-3">
          <div className="text-sm">
            <strong>{clientName}</strong> cannot be approved for this order.
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm font-mono">
            <div>Order Total:</div>
            <div className="text-right">${orderTotal.toLocaleString()}</div>
            <div>Available Credit:</div>
            <div className="text-right">${availableCredit.toLocaleString()}</div>
            <div className="font-bold pt-2 border-t">Exceeds By:</div>
            <div className="text-right font-bold pt-2 border-t">
              ${(orderTotal - availableCredit).toLocaleString()}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel Order
            </Button>
            <Button variant="destructive" size="sm">
              Request Manager Override
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (outstandingBalance > 0) {
    return (
      <Alert className="border-yellow-500 bg-yellow-500/5">
        <AlertCircle className="h-5 w-5 text-yellow-500" />
        <AlertTitle className="font-bold text-yellow-500">Outstanding Balance Warning</AlertTitle>
        <AlertDescription className="space-y-3">
          <div className="text-sm">
            <strong>{clientName}</strong> has existing debt. Proceed with caution.
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm font-mono">
            <div>Current Balance:</div>
            <div className="text-right text-yellow-600">${outstandingBalance.toLocaleString()}</div>
            <div>Order Total:</div>
            <div className="text-right">${orderTotal.toLocaleString()}</div>
            <div className="font-bold pt-2 border-t">New Balance:</div>
            <div className="text-right font-bold pt-2 border-t">
              ${newBalance.toLocaleString()}
            </div>
            <div className="text-muted-foreground">Credit Usage:</div>
            <div className="text-right text-muted-foreground">{utilizationPercent}%</div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button className="bg-yellow-500 hover:bg-yellow-600" size="sm" onClick={onApprove}>
              Approve Anyway
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-emerald-500 bg-emerald-500/5">
      <CheckCircle className="h-5 w-5 text-emerald-500" />
      <AlertTitle className="font-bold text-emerald-500">Credit Check Passed</AlertTitle>
      <AlertDescription className="space-y-2">
        <div className="text-sm">
          <strong>{clientName}</strong> is in good standing.
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm font-mono">
          <div>Order Total:</div>
          <div className="text-right">${orderTotal.toLocaleString()}</div>
          <div>Available Credit:</div>
          <div className="text-right text-emerald-600">${availableCredit.toLocaleString()}</div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
