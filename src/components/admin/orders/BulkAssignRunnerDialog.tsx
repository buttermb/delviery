import { useState } from 'react';
import { Star, Truck, User, Phone, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DialogFooterActions } from '@/components/ui/dialog-footer-actions';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAvailableRunners } from '@/hooks/useAvailableRunners';
import { BulkOperationProgress } from '@/components/ui/bulk-operation-progress';
import { useOrderBulkRunnerAssign } from '@/hooks/useOrderBulkRunnerAssign';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';

/**
 * Order information needed for bulk runner assignment
 */
export interface BulkAssignOrderInfo {
  id: string;
  order_number: string | null;
}

interface BulkAssignRunnerDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Array of selected orders to assign */
  selectedOrders: BulkAssignOrderInfo[];
  /** Callback after successful bulk assignment */
  onSuccess?: () => void;
}

/**
 * BulkAssignRunnerDialog - Dialog for bulk assigning orders to a delivery runner
 *
 * Features:
 * - Shows list of available runners with their stats
 * - Creates delivery records for each selected order
 * - Updates order status to 'assigned'
 * - Notifies the runner via notification
 * - Logs activity for each assignment
 * - Shows progress bar for large batches
 *
 * @example
 * ```tsx
 * <BulkAssignRunnerDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   selectedOrders={selectedOrders}
 *   onSuccess={() => {
 *     setSelectedOrders([]);
 *     refetch();
 *   }}
 * />
 * ```
 */
export function BulkAssignRunnerDialog({
  open,
  onOpenChange,
  selectedOrders,
  onSuccess,
}: BulkAssignRunnerDialogProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const [selectedRunnerId, setSelectedRunnerId] = useState('');

  // Fetch available runners
  const { data: runners, isLoading: isLoadingRunners } = useAvailableRunners({
    enabled: open,
    onlyAvailable: false, // Show all runners, filter by status badge
  });

  // Bulk assignment hook
  const bulkAssign = useOrderBulkRunnerAssign({
    tenantId: tenant?.id,
    userId: admin?.id,
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
      setSelectedRunnerId('');
    },
  });

  // Get selected runner info
  const selectedRunner = runners?.find(r => r.id === selectedRunnerId);

  // Handle assignment
  const handleAssign = async () => {
    if (!selectedRunnerId || !selectedRunner) return;

    await bulkAssign.executeBulkAssign(
      selectedOrders,
      selectedRunnerId,
      selectedRunner.full_name
    );
  };

  // Handle dialog close
  const handleClose = () => {
    if (!bulkAssign.isRunning) {
      onOpenChange(false);
      setSelectedRunnerId('');
    }
  };

  // Get runner status badge
  const getRunnerStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      available: 'default',
      busy: 'secondary',
      offline: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <>
      <Dialog open={open && !bulkAssign.showProgress} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Assign to Runner
            </DialogTitle>
            <DialogDescription>
              Assign {selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} to a delivery runner.
              Each order will be marked as assigned and the runner will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selected Orders Summary */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Selected Orders
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedOrders.slice(0, 10).map(order => (
                  <Badge key={order.id} variant="outline" className="font-mono text-xs">
                    #{order.order_number || order.id.slice(0, 8)}
                  </Badge>
                ))}
                {selectedOrders.length > 10 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedOrders.length - 10} more
                  </Badge>
                )}
              </div>
            </div>

            {/* Runner Selection */}
            <div className="space-y-2">
              <Label htmlFor="runner">Select Runner *</Label>
              <Select value={selectedRunnerId} onValueChange={setSelectedRunnerId}>
                <SelectTrigger id="runner">
                  <SelectValue placeholder="Choose a runner..." />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingRunners ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : !runners || runners.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No runners available
                    </SelectItem>
                  ) : (
                    runners.map((runner) => (
                      <SelectItem key={runner.id} value={runner.id}>
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-medium">{runner.full_name}</span>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Star className="h-3 w-3 fill-warning text-warning" />
                            <span className="text-xs">{runner.rating?.toFixed(1) || 'N/A'}</span>
                          </div>
                          {getRunnerStatusBadge(runner.status)}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Runner Details */}
            {selectedRunner && (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedRunner.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedRunner.vehicle_type}
                      {selectedRunner.vehicle_plate && ` - ${selectedRunner.vehicle_plate}`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedRunner.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedRunner.total_deliveries} deliveries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-warning text-warning" />
                    <span>Rating: {selectedRunner.rating?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    Status: {getRunnerStatusBadge(selectedRunner.status)}
                  </div>
                </div>

                {selectedRunner.status !== 'available' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Note: This runner is currently {selectedRunner.status}. Assignment will still proceed.
                  </p>
                )}
              </div>
            )}

            <DialogFooterActions
              primaryLabel={`Assign ${selectedOrders.length} Order${selectedOrders.length !== 1 ? 's' : ''}`}
              onPrimary={handleAssign}
              primaryDisabled={!selectedRunnerId}
              secondaryLabel="Cancel"
              onSecondary={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      <BulkOperationProgress
        open={bulkAssign.showProgress}
        onOpenChange={(open) => {
          if (!open) bulkAssign.closeProgress();
        }}
        title="Assigning Orders to Runner"
        description={selectedRunner ? `Assigning to ${selectedRunner.full_name}` : 'Processing assignments...'}
        total={bulkAssign.total}
        completed={bulkAssign.completed}
        succeeded={bulkAssign.succeeded}
        failed={bulkAssign.failed}
        failedItems={bulkAssign.failedItems}
        isRunning={bulkAssign.isRunning}
        isComplete={bulkAssign.isComplete}
        onCancel={bulkAssign.cancel}
      />
    </>
  );
}
