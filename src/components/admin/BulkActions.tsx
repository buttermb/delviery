import { logger } from '@/lib/logger';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ToggleLeft, ToggleRight, Trash2, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { ConfirmDeleteDialog } from "@/components/shared/ConfirmDeleteDialog";

interface BulkActionsProps {
  selectedCount: number;
  selectedProducts: string[];
  onClearSelection: () => void;
}

export function BulkActions({
  selectedCount,
  selectedProducts,
  onClearSelection,
}: BulkActionsProps) {
  const queryClient = useQueryClient();

  const bulkUpdate = useMutation({
    mutationFn: async ({ updates }: { updates: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("products")
        .update(updates)
        .in("id", selectedProducts);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: queryKeys.adminProducts.all });
      onClearSelection();
    },
    onError: (error: unknown) => {
      logger.error('Bulk update failed', error, { component: 'BulkActions' });
      toast.error('Bulk update failed', { description: humanizeError(error) });
    }
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .delete()
        .in("id", selectedProducts);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: queryKeys.adminProducts.all });
      toast.success(`${selectedCount} ${selectedCount === 1 ? 'product' : 'products'} deleted`);
      onClearSelection();
    },
    onError: (error: unknown) => {
      logger.error('Bulk delete failed', error, { component: 'BulkActions' });
      toast.error('Bulk delete failed', { description: humanizeError(error) });
    }
  });

  const handleSetActive = () => {
    bulkUpdate.mutate(
      { updates: { in_stock: true } },
      {
        onSuccess: () => toast.success(`${selectedCount} ${selectedCount === 1 ? 'product' : 'products'} set to active`),
      }
    );
  };

  const handleSetInactive = () => {
    bulkUpdate.mutate(
      { updates: { in_stock: false } },
      {
        onSuccess: () => toast.success(`${selectedCount} ${selectedCount === 1 ? 'product' : 'products'} set to inactive`),
      }
    );
  };

  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  const handleBulkDelete = () => {
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    bulkDelete.mutate();
    setBulkDeleteDialogOpen(false);
  };

  return (
    <>
      <ConfirmDeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        onConfirm={confirmBulkDelete}
        itemName={`${selectedCount} ${selectedCount === 1 ? 'product' : 'products'}`}
        itemType="products"
        isLoading={bulkDelete.isPending}
      />
      <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{selectedCount} {selectedCount === 1 ? 'product' : 'products'} selected</span>
          <Button
            onClick={onClearSelection}
            variant="ghost"
            size="sm"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSetActive} variant="outline" size="sm" disabled={bulkUpdate.isPending}>
            {bulkUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ToggleRight className="mr-2 h-4 w-4" />}
            Set Active
          </Button>
          <Button onClick={handleSetInactive} variant="outline" size="sm" disabled={bulkUpdate.isPending}>
            {bulkUpdate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ToggleLeft className="mr-2 h-4 w-4" />}
            Set Inactive
          </Button>
          <Button
            onClick={handleBulkDelete}
            variant="destructive"
            size="sm"
            disabled={bulkDelete.isPending}
          >
            {bulkDelete.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete
          </Button>
        </div>
      </div>
    </Card>
    </>
  );
}
