import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface LowStockAlertProps {
  productName: string;
  requestedQty: number;
  availableQty: number;
  warehouseLocation: string;
}

export function LowStockAlert({
  productName,
  requestedQty,
  availableQty,
  warehouseLocation
}: LowStockAlertProps) {
  const shortage = requestedQty - availableQty;
  const isOutOfStock = availableQty === 0;

  if (isOutOfStock) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="text-sm font-semibold">Out of Stock</AlertTitle>
        <AlertDescription className="text-xs">
          <strong>{productName}</strong> is not available at {warehouseLocation}.
          <div className="mt-1">
            Requested: {requestedQty} lbs | Available: 0 lbs
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-yellow-500 bg-yellow-500/10">
      <AlertTriangle className="h-4 w-4 text-yellow-500" />
      <AlertTitle className="text-sm font-semibold text-yellow-600">Low Stock Warning</AlertTitle>
      <AlertDescription className="text-xs space-y-1">
        <div>
          <strong>{productName}</strong> - Short by {shortage.toFixed(1)} lbs
        </div>
        <div className="flex items-center gap-2">
          <span>Available: {availableQty} lbs at {warehouseLocation}</span>
          <Badge variant="outline" className="text-xs">
            {((availableQty / requestedQty) * 100).toFixed(0)}%
          </Badge>
        </div>
        <div className="text-muted-foreground">
          Consider reducing quantity or checking other warehouses
        </div>
      </AlertDescription>
    </Alert>
  );
}
