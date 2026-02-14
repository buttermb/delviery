import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

interface CreditStatusBadgeProps {
  balance: number;
  threshold?: number;
}

export function CreditStatusBadge({ balance, threshold = 20000 }: CreditStatusBadgeProps) {
  if (balance === 0) {
    return (
      <Badge className="bg-success/10 text-success border-success/20 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        Paid in Full
      </Badge>
    );
  }

  if (balance > threshold) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        HIGH BALANCE
      </Badge>
    );
  }

  return (
    <Badge className="bg-warning/10 text-warning border-warning/20 flex items-center gap-1">
      <Clock className="h-3 w-3" />
      Outstanding
    </Badge>
  );
}
