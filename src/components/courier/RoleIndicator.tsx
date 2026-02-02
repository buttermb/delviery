import { Badge } from '@/components/ui/badge';
import Truck from "lucide-react/dist/esm/icons/truck";
import Package from "lucide-react/dist/esm/icons/package";

interface RoleIndicatorProps {
  role: 'courier' | 'runner';
}

export function RoleIndicator({ role }: RoleIndicatorProps) {
  return (
    <Badge variant="outline" className="gap-1.5">
      {role === 'courier' ? (
        <>
          <Package className="h-3 w-3" />
          Retail Courier
        </>
      ) : (
        <>
          <Truck className="h-3 w-3" />
          Wholesale Runner
        </>
      )}
    </Badge>
  );
}
