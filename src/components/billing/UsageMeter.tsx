import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import { Badge } from "@/components/ui/badge";

interface UsageMeterProps {
  label: string;
  current: number;
  limit: number; // -1 for unlimited
  unit?: string;
  warningThreshold?: number; // Percentage at which to show warning (default: 80)
  overageCharge?: number; // Charge per unit over limit
}

export function UsageMeter({
  label,
  current,
  limit,
  unit = "",
  warningThreshold = 80,
  overageCharge,
}: UsageMeterProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);
  const isOverLimit = !isUnlimited && current > limit;
  const isWarning = !isUnlimited && percentage >= warningThreshold && !isOverLimit;
  const overage = isOverLimit ? current - limit : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="capitalize font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className={isOverLimit ? "text-red-600 font-semibold" : isWarning ? "text-yellow-600" : ""}>
            {current.toLocaleString()}{unit} / {isUnlimited ? "Unlimited" : `${limit.toLocaleString()}${unit}`}
            {!isUnlimited && ` (${percentage.toFixed(0)}%)`}
          </span>
          {isOverLimit && (
            <Badge variant="destructive">Over Limit</Badge>
          )}
          {isWarning && !isOverLimit && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Warning
            </Badge>
          )}
          {!isWarning && !isOverLimit && current > 0 && (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
        </div>
      </div>

      {!isUnlimited && (
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isOverLimit
                ? "bg-red-500"
                : isWarning
                ? "bg-yellow-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}

      {isOverLimit && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          <p className="font-semibold">⚠️ Over limit by {overage.toLocaleString()}{unit}</p>
          {overageCharge && (
            <p className="mt-1">
              Overage charge: ${(overage * overageCharge).toFixed(2)}
            </p>
          )}
        </div>
      )}

      {isWarning && !isOverLimit && (
        <p className="text-xs text-yellow-600">
          Approaching limit. Consider upgrading your plan.
        </p>
      )}
    </div>
  );
}

