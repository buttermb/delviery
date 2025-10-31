import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

interface CreditStatusBadgeProps {
  balance: number;
  threshold?: number;
}

export function CreditStatusBadge({ balance, threshold = 20000 }: CreditStatusBadgeProps) {
  if (balance === 0) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
        🟢 Paid in Full
      </Badge>
    );
  }

  if (balance > threshold) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        🔴 HIGH BALANCE
      </Badge>
    );
  }

  return (
    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
      🟡 Outstanding
    </Badge>
  );
}
