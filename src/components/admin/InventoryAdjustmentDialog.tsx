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

interface InventoryAdjustmentDialogProps {
  productId: string;
  productName: string;
  currentQuantity: number;
  warehouse: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InventoryAdjustmentDialog({ 
  productId, 
  productName, 
  currentQuantity,
  warehouse,
  open, 
  onOpenChange 
}: InventoryAdjustmentDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const adjustmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const adjustedQuantity = data.type === "add" 
        ? currentQuantity + parseFloat(data.quantity)
        : currentQuantity - parseFloat(data.quantity);

      if (adjustedQuantity < 0) {
        throw new Error("Cannot adjust below zero");
      }

      // Log the adjustment
      const { data: adjustmentData, error: logError } = await supabase
        .from("inventory_adjustments")
        .insert([{
          product_id: data.product_id,
          warehouse: data.warehouse,
          adjustment_type: data.type,
          quantity_lbs: parseFloat(data.quantity),
          reason: data.reason,
          notes: data.notes
        }])
        .select()
        .single();

      if (logError) throw logError;

      // Update inventory
      const { error: updateError } = await supabase
        .from("wholesale_inventory")
        .update({ 
          quantity_lbs: adjustedQuantity,
          updated_at: new Date().toISOString()
        })
        .eq("id", productId);

      if (updateError) throw updateError;

      return adjustedQuantity;
    },
    onSuccess: (newQuantity) => {
      showSuccessToast(
        "Inventory Adjusted", 
        `New quantity: ${newQuantity.toFixed(2)} lbs`
      );
      queryClient.invalidateQueries({ queryKey: ["wholesale-inventory"] });
      onOpenChange(false);
      setQuantity("");
      setReason("");
      setNotes("");
    },
    onError: (error: any) => {
      showErrorToast("Adjustment Failed", error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adjustmentMutation.mutate({
      product_id: productId,
      warehouse,
      type: adjustmentType,
      quantity,
      reason,
      notes
    });
  };

  const newQuantity = adjustmentType === "add"
    ? currentQuantity + (parseFloat(quantity) || 0)
    : currentQuantity - (parseFloat(quantity) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>⚖️ Adjust Inventory</DialogTitle>
          <DialogDescription>
            Adjust quantity for {productName} at {warehouse}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Current Quantity</Label>
            <div className="mt-1 p-2 bg-muted rounded-md text-sm font-mono font-bold">
              {currentQuantity.toFixed(2)} lbs
            </div>
          </div>

          <div>
            <Label htmlFor="type">Adjustment Type *</Label>
            <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as "add" | "subtract")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">➕ Add Inventory</SelectItem>
                <SelectItem value="subtract">➖ Subtract Inventory</SelectItem>
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
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              required
            />
            {quantity && (
              <div className="mt-2 text-sm">
                New quantity will be: <span className="font-mono font-bold">{newQuantity.toFixed(2)} lbs</span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="reason">Reason *</Label>
            <Select value={reason} onValueChange={setReason} required>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="receiving">📦 Receiving/Restock</SelectItem>
                <SelectItem value="damage">💔 Damage/Loss</SelectItem>
                <SelectItem value="theft">🚨 Theft</SelectItem>
                <SelectItem value="quality">❌ Quality Issue</SelectItem>
                <SelectItem value="count">🔢 Count Correction</SelectItem>
                <SelectItem value="return">↩️ Return to Supplier</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide details about this adjustment..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!quantity || !reason || adjustmentMutation.isPending} 
              className="flex-1"
              variant={adjustmentType === "subtract" ? "destructive" : "default"}
            >
              {adjustmentMutation.isPending ? "Adjusting..." : "Adjust Inventory"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
