import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { invalidateOnEvent } from "@/lib/invalidation";

const REASON_OPTIONS = [
  { value: "receiving", label: "📦 Receiving/Restock" },
  { value: "damage", label: "💔 Damage/Loss" },
  { value: "theft", label: "🚨 Theft" },
  { value: "quality", label: "❌ Quality Issue" },
  { value: "count", label: "🔢 Count Correction" },
  { value: "sale", label: "💰 Sale" },
  { value: "other", label: "Other" },
] as const;

type ReasonType = typeof REASON_OPTIONS[number]['value'] | "";

interface StockAdjustmentDialogProps {
  productId: string;
  productName: string;
  currentQuantity: number;
  warehouse: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockAdjustmentDialog({ 
  productId, 
  productName, 
  currentQuantity,
  warehouse,
  open, 
  onOpenChange 
}: StockAdjustmentDialogProps) {
  const { tenant } = useTenantAdminAuth();
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<ReasonType>("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAdjustmentType("add");
      setQuantity("");
      setReason("");
      setNotes("");
    }
  }, [open]);

  interface AdjustmentData {
    warehouse: string;
    type: 'add' | 'subtract';
    quantity: string;
    reason: string;
    notes: string;
  }

  const adjustmentMutation = useMutation({
    mutationFn: async (data: AdjustmentData) => {
      const adjustedQuantity = data.type === "add" 
        ? currentQuantity + parseFloat(data.quantity)
        : currentQuantity - parseFloat(data.quantity);

      if (adjustedQuantity < 0) {
        throw new Error("Cannot adjust below zero");
      }

      // Simple direct update for MVP
      const { error: updateError } = await supabase
        .from("products")
        .update({ 
          stock_quantity: adjustedQuantity,
          updated_at: new Date().toISOString()
        })
        .eq("id", productId)
        .eq("tenant_id", tenant?.id);

      if (updateError) throw updateError;

      return adjustedQuantity;
    },
    onSuccess: (newQuantity) => {
      showSuccessToast(
        "Stock Adjusted",
        `New quantity: ${newQuantity.toFixed(2)} units`
      );

      // Cross-panel invalidation - stock changes affect inventory, POS, storefront, dashboard
      if (tenant?.id) {
        invalidateOnEvent(queryClient, 'INVENTORY_ADJUSTED', tenant.id, {
          productId,
        });
      }

      onOpenChange(false);
      setQuantity("");
      setReason("");
      setNotes("");
    },
    onError: (error: unknown) => {
      showErrorToast("Adjustment Failed", error instanceof Error ? error.message : "Unknown error");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    adjustmentMutation.mutate({
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
          <DialogTitle>⚖️ Adjust Stock</DialogTitle>
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
                <SelectItem value="add">➕ Add Stock</SelectItem>
                <SelectItem value="subtract">➖ Reduce Stock</SelectItem>
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
                New quantity: <span className="font-mono font-bold">{newQuantity.toFixed(2)} lbs</span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="reason">Reason *</Label>
            <Select
              value={reason || undefined}
              onValueChange={(v) => setReason(v as ReasonType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
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
              {adjustmentMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adjusting...</> : "Adjust Stock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
