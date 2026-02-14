import { useState, useCallback } from 'react';
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import Package from "lucide-react/dist/esm/icons/package";
import Truck from "lucide-react/dist/esm/icons/truck";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import { BulkActionsBar, type BulkAction } from '@/components/ui/BulkActionsBar';
import { OrderBulkStatusConfirmDialog } from '@/components/admin/orders/OrderBulkStatusConfirmDialog';
import { BulkOperationProgress } from '@/components/ui/bulk-operation-progress';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { useOrderBulkStatusUpdate } from '@/hooks/useOrderBulkStatusUpdate';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { triggerHaptic } from '@/lib/utils/mobile';
import type { OrderStatus } from '@/types/order';

/**
 * Order information needed for bulk operations
 */
export interface BulkOrderInfo {
  id: string;
  order_number: string | null;
}

interface BulkOrderActionsProps {
  /** Array of selected order IDs */
  selectedOrderIds: string[];
  /** Array of all orders (needed to get order_number for each selected order) */
  orders: BulkOrderInfo[];
  /** Callback when selection should be cleared */
  onClearSelection: () => void;
  /** Callback after successful bulk operation */
  onOperationComplete?: () => void;
  /** Additional CSS classes for the actions bar */
  className?: string;
}

/**
 * BulkOrderActions component provides a floating action bar and dialogs
 * for performing bulk operations on selected orders.
 *
 * Features:
 * - Bulk status updates (confirmed, preparing, in_transit, delivered, cancelled)
 * - Bulk delete with confirmation
 * - Progress tracking for large batches
 * - Proper tenant isolation
 *
 * @example
 * ```tsx
 * <BulkOrderActions
 *   selectedOrderIds={selectedOrders}
 *   orders={orders}
 *   onClearSelection={() => setSelectedOrders([])}
 *   onOperationComplete={() => refetch()}
 * />
 * ```
 */
export function BulkOrderActions({
  selectedOrderIds,
  orders,
  onClearSelection,
  onOperationComplete,
  className,
}: BulkOrderActionsProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Status update confirmation dialog state
  const [statusConfirm, setStatusConfirm] = useState<{
    open: boolean;
    targetStatus: OrderStatus | '';
  }>({ open: false, targetStatus: '' });

  // Delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk status update hook with userId for activity logging
  const bulkStatusUpdate = useOrderBulkStatusUpdate({
    tenantId: tenant?.id,
    userId: admin?.id,
    onSuccess: () => {
      onClearSelection();
      onOperationComplete?.();
    },
  });

  // Get order info for selected orders
  const getSelectedOrdersInfo = useCallback((): BulkOrderInfo[] => {
    const selectedSet = new Set(selectedOrderIds);
    return orders.filter(order => selectedSet.has(order.id));
  }, [selectedOrderIds, orders]);

  // Handle initiating a bulk status change
  const handleBulkStatusChange = useCallback((status: OrderStatus) => {
    if (selectedOrderIds.length === 0) {
      toast.error('No orders selected');
      return;
    }
    setStatusConfirm({ open: true, targetStatus: status });
  }, [selectedOrderIds.length]);

  // Handle confirming and executing the bulk status change
  const handleConfirmStatusChange = useCallback(async () => {
    if (!statusConfirm.targetStatus || !tenant?.id) {
      setStatusConfirm({ open: false, targetStatus: '' });
      return;
    }

    const selectedOrders = getSelectedOrdersInfo();

    // Close the confirmation dialog
    setStatusConfirm({ open: false, targetStatus: '' });

    // Execute the bulk update using the hook
    await bulkStatusUpdate.executeBulkUpdate(selectedOrders, statusConfirm.targetStatus);
  }, [statusConfirm.targetStatus, tenant?.id, getSelectedOrdersInfo, bulkStatusUpdate]);

  // Handle initiating bulk delete
  const handleBulkDelete = useCallback(() => {
    if (selectedOrderIds.length === 0) {
      toast.error('No orders selected');
      return;
    }
    setDeleteConfirm(true);
  }, [selectedOrderIds.length]);

  // Handle confirming and executing bulk delete
  const handleConfirmDelete = useCallback(async () => {
    if (!tenant?.id) {
      toast.error('No tenant context available');
      setDeleteConfirm(false);
      return;
    }

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', selectedOrderIds)
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      const count = selectedOrderIds.length;
      toast.success(`${count} order${count !== 1 ? 's' : ''} deleted successfully`);
      triggerHaptic('heavy');

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });

      onClearSelection();
      onOperationComplete?.();
    } catch (error) {
      logger.error('Error deleting orders in bulk', error instanceof Error ? error : new Error(String(error)), {
        component: 'BulkOrderActions',
        tenantId: tenant.id,
        orderCount: selectedOrderIds.length,
      });
      toast.error('Failed to delete orders');
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(false);
    }
  }, [tenant?.id, selectedOrderIds, queryClient, onClearSelection, onOperationComplete]);

  // Define bulk action buttons
  const bulkActions: BulkAction[] = [
    {
      id: 'mark-confirmed',
      label: 'Confirmed',
      icon: <CheckCircle className="h-4 w-4" />,
      onClick: async () => handleBulkStatusChange('confirmed'),
    },
    {
      id: 'mark-delivered',
      label: 'Delivered',
      icon: <CheckCircle className="h-4 w-4" />,
      onClick: async () => handleBulkStatusChange('delivered'),
    },
    {
      id: 'mark-preparing',
      label: 'Preparing',
      icon: <Package className="h-4 w-4" />,
      onClick: async () => handleBulkStatusChange('preparing'),
    },
    {
      id: 'mark-in-transit',
      label: 'In Transit',
      icon: <Truck className="h-4 w-4" />,
      onClick: async () => handleBulkStatusChange('in_transit'),
    },
    {
      id: 'mark-cancelled',
      label: 'Cancel',
      icon: <XCircle className="h-4 w-4" />,
      variant: 'destructive',
      onClick: async () => handleBulkStatusChange('cancelled'),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4" />,
      variant: 'destructive',
      onClick: async () => handleBulkDelete(),
    },
  ];

  return (
    <>
      {/* Floating Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedOrderIds}
        onClearSelection={onClearSelection}
        actions={bulkActions}
        className={className}
      />

      {/* Bulk Status Update Confirmation Dialog */}
      <OrderBulkStatusConfirmDialog
        open={statusConfirm.open}
        onOpenChange={(open) => setStatusConfirm(prev => ({ ...prev, open }))}
        onConfirm={handleConfirmStatusChange}
        selectedCount={selectedOrderIds.length}
        targetStatus={statusConfirm.targetStatus}
        isLoading={bulkStatusUpdate.isRunning}
      />

      {/* Bulk Status Update Progress Dialog */}
      <BulkOperationProgress
        open={bulkStatusUpdate.showProgress}
        onOpenChange={(open) => { if (!open) bulkStatusUpdate.closeProgress(); }}
        title="Updating Order Status"
        description={statusConfirm.targetStatus ? `Changing status to "${statusConfirm.targetStatus}"` : 'Processing orders...'}
        total={bulkStatusUpdate.total}
        completed={bulkStatusUpdate.completed}
        succeeded={bulkStatusUpdate.succeeded}
        failed={bulkStatusUpdate.failed}
        failedItems={bulkStatusUpdate.failedItems}
        isRunning={bulkStatusUpdate.isRunning}
        isComplete={bulkStatusUpdate.isComplete}
        onCancel={bulkStatusUpdate.cancel}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        onConfirm={handleConfirmDelete}
        itemName={`${selectedOrderIds.length} order${selectedOrderIds.length !== 1 ? 's' : ''}`}
        description="This action cannot be undone. All selected orders and their associated data will be permanently removed."
        isLoading={isDeleting}
      />
    </>
  );
}

/**
 * Hook to manage order selection state
 *
 * @example
 * ```tsx
 * const { selectedIds, selectAll, selectOne, clearSelection, isSelected, isAllSelected } = useOrderSelection();
 * ```
 */
export function useOrderSelection(orders: { id: string }[] = []) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(orders.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  }, [orders]);

  const selectOne = useCallback((orderId: string, checked: boolean) => {
    setSelectedIds(prev =>
      checked ? [...prev, orderId] : prev.filter(id => id !== orderId)
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const isSelected = useCallback((orderId: string) => {
    return selectedIds.includes(orderId);
  }, [selectedIds]);

  const isAllSelected = orders.length > 0 && selectedIds.length === orders.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < orders.length;

  return {
    selectedIds,
    setSelectedIds,
    selectAll,
    selectOne,
    clearSelection,
    isSelected,
    isAllSelected,
    isSomeSelected,
    selectedCount: selectedIds.length,
  };
}
