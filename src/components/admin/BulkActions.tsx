import { logger } from '@/lib/logger';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
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
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      onClearSelection();
    },
    onError: (error: unknown) => {
      logger.error('Bulk update failed', error, { component: 'BulkActions' });
      toast({
        title: "Bulk update failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
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
      await queryClient.refetchQueries({ queryKey: ["admin-products"] });
      toast({ title: `✓ ${selectedCount} ${selectedCount === 1 ? 'product' : 'products'} deleted` });
      onClearSelection();
    },
    onError: (error: unknown) => {
      logger.error('Bulk delete failed', error, { component: 'BulkActions' });
      toast({
        title: "Bulk delete failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    }
  });

  const handleSetActive = () => {
    bulkUpdate.mutate(
      { updates: { in_stock: true } },
      {
        onSuccess: () => toast({ title: `${selectedCount} ${selectedCount === 1 ? 'product' : 'products'} set to active` }),
      }
    );
  };

  const handleSetInactive = () => {
    bulkUpdate.mutate(
      { updates: { in_stock: false } },
      {
        onSuccess: () => toast({ title: `${selectedCount} ${selectedCount === 1 ? 'product' : 'products'} set to inactive` }),
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
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSetActive} variant="outline" size="sm">
            <ToggleRight className="mr-2 h-4 w-4" />
            Set Active
          </Button>
          <Button onClick={handleSetInactive} variant="outline" size="sm">
            <ToggleLeft className="mr-2 h-4 w-4" />
            Set Inactive
          </Button>
          <Button
            onClick={handleBulkDelete}
            variant="destructive"
            size="sm"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
    </Card>
    </>
  );
}
