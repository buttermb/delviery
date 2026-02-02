/**
 * BulkStatusUpdate - Batch status change component
 * Allows updating status for multiple selected items at once
 */

import { useState } from 'react';
import Check from "lucide-react/dist/esm/icons/check";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getStatusColor } from '@/lib/utils/statusColors';
import { toast } from 'sonner';
import { ORDER_STATUSES, WHOLESALE_ORDER_STATUSES, StatusOption } from './StatusDropdown';

interface BulkStatusUpdateProps {
  selectedIds: string[];
  entityType: 'order' | 'wholesale_order' | 'product' | 'custom';
  statuses?: StatusOption[];
  onBulkUpdate: (ids: string[], newStatus: string) => Promise<{ success: number; failed: number }>;
  disabled?: boolean;
  className?: string;
}

export function BulkStatusUpdate({
  selectedIds,
  entityType,
  statuses: customStatuses,
  onBulkUpdate,
  disabled = false,
  className,
}: BulkStatusUpdateProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [progress, setProgress] = useState(0);

  // Select appropriate status options based on entity type
  const statusOptions = customStatuses || (
    entityType === 'wholesale_order' ? WHOLESALE_ORDER_STATUSES : ORDER_STATUSES
  );

  const handleStatusSelect = (status: string) => {
    setSelectedStatus(status);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!selectedStatus || selectedIds.length === 0) return;

    setIsUpdating(true);
    setProgress(0);
    setShowConfirm(false);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const result = await onBulkUpdate(selectedIds, selectedStatus);
      
      clearInterval(progressInterval);
      setProgress(100);

      if (result.failed === 0) {
        toast.success(`Updated ${result.success} item${result.success !== 1 ? 's' : ''} to "${selectedStatus}"`);
      } else {
        toast.warning(
          `Updated ${result.success} item${result.success !== 1 ? 's' : ''}, ` +
          `${result.failed} failed`
        );
      }
    } catch (error) {
      logger.error('Bulk status update failed', error);
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(false);
      setSelectedStatus(null);
      setProgress(0);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || isUpdating}
            className={cn('gap-2', className)}
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Change Status
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Apply to {selectedIds.length} selected
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {statusOptions.map((status) => (
            <DropdownMenuItem
              key={status.value}
              onClick={() => handleStatusSelect(status.value)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  getStatusColor(status.value).split(' ')[0].replace('/10', '')
                )}
              />
              {status.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Status Update</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to change the status of {selectedIds.length} item
              {selectedIds.length !== 1 ? 's' : ''} to{' '}
              <span className="font-medium">
                "{statusOptions.find(s => s.value === selectedStatus)?.label || selectedStatus}"
              </span>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Update {selectedIds.length} Item{selectedIds.length !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Progress indicator during update */}
      {isUpdating && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg p-4 w-64 z-50">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Updating status...</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Processing {selectedIds.length} items
          </p>
        </div>
      )}
    </>
  );
}
