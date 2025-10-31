import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { DollarSign, Calendar, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface Payment {
  id: string;
  amount: number;
  created_at: string;
  payment_method: string;
  status: string;
  notes?: string;
}

interface PaymentTrackingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  payments: Payment[];
  totalOwed: number;
  totalPaid: number;
}

export function PaymentTrackingModal({
  open,
  onOpenChange,
  clientName,
  payments,
  totalOwed,
  totalPaid
}: PaymentTrackingModalProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'pending':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Payment History - {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm text-muted-foreground mb-1">Total Owed</div>
              <div className="text-2xl font-bold text-red-500">
                ${totalOwed.toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm text-muted-foreground mb-1">Total Paid</div>
              <div className="text-2xl font-bold text-emerald-500">
                ${totalPaid.toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="text-sm text-muted-foreground mb-1">Balance</div>
              <div className="text-2xl font-bold">
                ${(totalOwed - totalPaid).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">Payment History</h3>
            {payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payment history available
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(payment.status)}
                          <span className="font-semibold">
                            ${payment.amount.toLocaleString()}
                          </span>
                          <Badge variant="outline" className={getStatusColor(payment.status)}>
                            {payment.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(payment.created_at), 'MMM dd, yyyy')}
                          </span>
                          <span className="capitalize">{payment.payment_method}</span>
                        </div>
                        {payment.notes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {payment.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
