import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Package from "lucide-react/dist/esm/icons/package";
import Truck from "lucide-react/dist/esm/icons/truck";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import Clock from "lucide-react/dist/esm/icons/clock";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OrderBulkStatusConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  selectedCount: number;
  targetStatus: string;
  isLoading?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; description: string; variant: 'default' | 'destructive' | 'warning' }> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="h-5 w-5 text-yellow-500" />,
    description: 'Orders will be moved back to pending state.',
    variant: 'default',
  },
  confirmed: {
    label: 'Confirmed',
    icon: <CheckCircle className="h-5 w-5 text-blue-500" />,
    description: 'Orders will be marked as confirmed and accepted.',
    variant: 'default',
  },
  preparing: {
    label: 'Preparing',
    icon: <Package className="h-5 w-5 text-orange-500" />,
    description: 'Orders will be marked as being prepared.',
    variant: 'default',
  },
  in_transit: {
    label: 'In Transit',
    icon: <Truck className="h-5 w-5 text-blue-600" />,
    description: 'Orders will be marked as in transit for delivery.',
    variant: 'default',
  },
  delivered: {
    label: 'Delivered',
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    description: 'Orders will be marked as delivered to the customer.',
    variant: 'default',
  },
  on_hold: {
    label: 'On Hold',
    icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    description: 'Orders will be placed on hold and processing will be paused.',
    variant: 'warning',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <XCircle className="h-5 w-5 text-destructive" />,
    description: 'Orders will be cancelled. This may affect inventory.',
    variant: 'destructive',
  },
};

export function OrderBulkStatusConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  selectedCount,
  targetStatus,
  isLoading = false,
}: OrderBulkStatusConfirmDialogProps) {
  const config = STATUS_CONFIG[targetStatus] || {
    label: targetStatus,
    icon: <AlertTriangle className="h-5 w-5" />,
    description: `Orders will be updated to "${targetStatus}".`,
    variant: 'default' as const,
  };

  const isDestructive = config.variant === 'destructive';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isDestructive ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              config.icon
            )}
            Confirm Bulk Status Update
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <span className="block">
              You are about to update <strong>{selectedCount}</strong> order{selectedCount !== 1 ? 's' : ''} to:
            </span>
            <span className="flex items-center gap-2">
              {config.icon}
              <Badge variant={isDestructive ? 'destructive' : 'secondary'} className="text-sm">
                {config.label}
              </Badge>
            </span>
            <span className="block text-sm">
              {config.description}
            </span>
            {isDestructive && (
              <span className="block text-sm text-destructive font-medium">
                This action may not be easily reversible.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Updating...' : `Update ${selectedCount} Order${selectedCount !== 1 ? 's' : ''}`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
