import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";

interface InventoryTransferDialogProps {
  productId: string;
  productName: string;
  currentWarehouse: string;
  availableQuantity: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InventoryTransferDialog({ 
  productId, 
  productName, 
  currentWarehouse,
  availableQuantity,
  open, 
  onOpenChange 
}: InventoryTransferDialogProps) {
  const [targetWarehouse, setTargetWarehouse] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: async (data: any) => {
      // Create transfer log - directly insert without transaction check for MVP
      const { data: transferData, error } = await supabase
        .from("inventory_transfers")
        .insert([{
          product_id: data.product_id,
          from_warehouse: data.from_warehouse,
          to_warehouse: data.to_warehouse,
          quantity_lbs: data.quantity,
          notes: data.notes,
          status: "completed"
        }])
        .select()
        .single();

      if (error) throw error;

      // Update inventory (decrement from source)
      const { error: updateError } = await supabase
        .from("wholesale_inventory")
        .update({ 
          quantity_lbs: availableQuantity - parseFloat(data.quantity),
          updated_at: new Date().toISOString()
        })
        .eq("id", productId);

      if (updateError) throw updateError;

      return transferData;
    },
    onSuccess: () => {
      showSuccessToast("Transfer Completed", "Inventory has been transferred successfully");
      queryClient.invalidateQueries({ queryKey: ["wholesale-inventory"] });
      onOpenChange(false);
      setQuantity("");
      setNotes("");
      setTargetWarehouse("");
    },
    onError: (error: any) => {
      showErrorToast("Transfer Failed", error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    transferMutation.mutate({
      product_id: productId,
      from_warehouse: currentWarehouse,
      to_warehouse: targetWarehouse,
      quantity: parseFloat(quantity),
      notes
    });
  };

  const warehouses = ["Warehouse A", "Warehouse B", "Warehouse C"];
  const availableWarehouses = warehouses.filter(w => w !== currentWarehouse);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🔄 Transfer Inventory</DialogTitle>
          <DialogDescription>
            Transfer {productName} to another warehouse
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Current Location</Label>
            <div className="mt-1 p-2 bg-muted rounded-md text-sm font-medium">
              {currentWarehouse}
            </div>
          </div>

          <div>
            <Label>Available Quantity</Label>
            <div className="mt-1 p-2 bg-muted rounded-md text-sm font-mono font-bold">
              {availableQuantity} lbs
            </div>
          </div>

          <div>
            <Label htmlFor="target">Transfer To *</Label>
            <Select value={targetWarehouse} onValueChange={setTargetWarehouse} required>
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse..." />
              </SelectTrigger>
              <SelectContent>
                {availableWarehouses.map((warehouse) => (
                  <SelectItem key={warehouse} value={warehouse}>
                    {warehouse}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity">Quantity (lbs) *</Label>
            <Input
              id="quantity"
              type="number"
              step="0.01"
              min="0.01"
              max={availableQuantity}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <Label htmlFor="notes">Transfer Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for transfer, special handling, etc."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={!targetWarehouse || !quantity || transferMutation.isPending} className="flex-1">
              {transferMutation.isPending ? "Transferring..." : "Transfer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
