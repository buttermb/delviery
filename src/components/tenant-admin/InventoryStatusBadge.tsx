import { Badge } from '@/components/ui/badge';

interface InventoryStatusBadgeProps {
  quantity: number;
  reorderPoint?: number;
  showLabel?: boolean;
  className?: string;
}

export function InventoryStatusBadge({ quantity, reorderPoint = 10, showLabel, className }: InventoryStatusBadgeProps) {
  if (quantity <= 0) {
    return <Badge variant="destructive" className={className}>{showLabel !== false ? 'Out of Stock' : ''}</Badge>;
  }
  if (quantity <= reorderPoint) {
    return <Badge variant="secondary" className={className}>Low Stock</Badge>;
  }
  return <Badge variant="secondary" className={className}>In Stock</Badge>;
}
