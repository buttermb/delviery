import { Badge } from '@/components/ui/badge';
import { Truck, Package } from 'lucide-react';

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
