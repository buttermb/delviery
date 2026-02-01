import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showSuccessToast, showErrorToast } from "@/utils/toastHelpers";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { invalidateOnEvent } from "@/lib/invalidation";
import { logger } from "@/lib/logger";
import {
  Loader2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Replace,
  Package,
} from "lucide-react";

type AdjustmentType = "add" | "subtract" | "set";

const REASON_OPTIONS = [
  { value: "receiving", label: "Receiving/Restock", icon: "📦" },
  { value: "damage", label: "Damage/Loss", icon: "💔" },
  { value: "theft", label: "Theft", icon: "🚨" },
  { value: "quality", label: "Quality Issue", icon: "❌" },
  { value: "count", label: "Count Correction", icon: "🔢" },
  { value: "disposal", label: "Disposal/Expired", icon: "🗑️" },
  { value: "transfer", label: "Transfer", icon: "🔄" },
  { value: "audit", label: "Audit Adjustment", icon: "📋" },
  { value: "other", label: "Other", icon: "📝" },
] as const;

type ReasonType = (typeof REASON_OPTIONS)[number]["value"] | "";

interface StockAdjustmentModalProps {
  productId: string;
  productName: string;
  currentQuantity: number;
  warehouse?: string;
  batchId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface AdjustmentData {
  type: AdjustmentType;
  quantity: number;
  reason: string;
  notes: string;
}

export function StockAdjustmentModal({
  productId,
  productName,
  currentQuantity,
  warehouse = "Warehouse A",
  batchId,
  open,
  onOpenChange,
  onComplete,
}: StockAdjustmentModalProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<ReasonType>("");
  const [notes, setNotes] = useState("");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAdjustmentType("add");
      setQuantity("");
      setReason("");
      setNotes("");
    }
  }, [open]);

  const parsedQuantity = parseFloat(quantity) || 0;

  // Calculate preview values
  const preview = useMemo(() => {
    if (!parsedQuantity || parsedQuantity <= 0) {
      return { newQuantity: currentQuantity, change: 0, error: null };
    }

    let newQuantity: number;
    let change: number;

    switch (adjustmentType) {
      case "add":
        newQuantity = currentQuantity + parsedQuantity;
        change = parsedQuantity;
        break;
      case "subtract":
        newQuantity = Math.max(0, currentQuantity - parsedQuantity);
        change = -Math.min(parsedQuantity, currentQuantity);
        break;
      case "set":
        newQuantity = parsedQuantity;
        change = parsedQuantity - currentQuantity;
        break;
    }

    const error =
      adjustmentType === "subtract" && parsedQuantity > currentQuantity
        ? "Quantity will be set to 0 (cannot go negative)"
        : null;

    return { newQuantity, change, error };
  }, [adjustmentType, parsedQuantity, currentQuantity]);

  // Map reason to change_type for inventory_history
  const getChangeType = (
    adjustType: AdjustmentType,
    reasonValue: string
  ): string => {
    // Map specific reasons to change_type values
    const reasonToChangeType: Record<string, string> = {
      receiving: "stock_in",
      damage: "disposal",
      theft: "disposal",
      quality: "disposal",
      disposal: "disposal",
      transfer: "transfer",
    };

    // If reason maps to a specific type, use it
    if (reasonToChangeType[reasonValue]) {
      return reasonToChangeType[reasonValue];
    }

    // Otherwise base it on adjustment direction
    if (adjustType === "add") return "stock_in";
    if (adjustType === "subtract") return "stock_out";
    return "adjustment";
  };

  const adjustmentMutation = useMutation({
    mutationFn: async (data: AdjustmentData) => {
      if (!tenant?.id) throw new Error("No tenant context");

      const newQuantity = preview.newQuantity;
      const changeAmount = preview.change;

      // Update the product stock_quantity
      const { error: updateError } = await supabase
        .from("products")
        .update({
          stock_quantity: newQuantity,
          available_quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId)
        .eq("tenant_id", tenant.id);

      if (updateError) {
        logger.error("Failed to update product stock", updateError, {
          component: "StockAdjustmentModal",
          productId,
        });
        throw updateError;
      }

      // Record in inventory_history for audit trail
      const historyEntry = {
        tenant_id: tenant.id,
        product_id: productId,
        change_type: getChangeType(data.type, data.reason),
        previous_quantity: currentQuantity,
        new_quantity: newQuantity,
        change_amount: changeAmount,
        reference_type: "manual",
        location_id: null, // Could be enhanced to support warehouse IDs
        batch_id: batchId || null,
        reason: data.reason,
        notes: data.notes || null,
        performed_by: admin?.id || null,
        metadata: {
          adjustment_type: data.type,
          warehouse: warehouse,
          source: "stock_adjustment_modal",
        },
      };

      const { error: historyError } = await (supabase as any)
        .from("inventory_history")
        .insert(historyEntry);

      if (historyError) {
        // Log but don't fail - stock was already updated
        logger.error("Failed to record inventory history", historyError, {
          component: "StockAdjustmentModal",
          productId,
        });
      }

      return { newQuantity, changeAmount };
    },
    onSuccess: ({ newQuantity }) => {
      showSuccessToast(
        "Stock Adjusted",
        `New quantity: ${newQuantity.toFixed(2)} units`
      );

      // Cross-panel invalidation
      if (tenant?.id) {
        invalidateOnEvent(queryClient, "INVENTORY_ADJUSTED", tenant.id, {
          productId,
        });
      }

      onOpenChange(false);
      onComplete?.();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to adjust stock";
      logger.error("Stock adjustment failed", error, {
        component: "StockAdjustmentModal",
        productId,
      });
      showErrorToast("Adjustment Failed", message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedQuantity || !reason) return;

    adjustmentMutation.mutate({
      type: adjustmentType,
      quantity: parsedQuantity,
      reason,
      notes,
    });
  };

  const getAdjustmentIcon = () => {
    switch (adjustmentType) {
      case "add":
        return <ArrowUp className="h-4 w-4 text-emerald-500" />;
      case "subtract":
        return <ArrowDown className="h-4 w-4 text-destructive" />;
      case "set":
        return <Replace className="h-4 w-4 text-blue-500" />;
    }
  };

  const isValid = parsedQuantity > 0 && reason !== "";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !adjustmentMutation.isPending) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Adjust Stock
          </DialogTitle>
          <DialogDescription>
            Adjust quantity for <strong>{productName}</strong>
            {warehouse && ` at ${warehouse}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Quantity Display */}
          <div className="space-y-1">
            <Label>Current Quantity</Label>
            <div className="p-3 bg-muted rounded-md">
              <span className="font-mono text-lg font-bold">
                {currentQuantity.toFixed(2)}
              </span>
              <span className="text-muted-foreground ml-1">units</span>
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label htmlFor="adjustment-type">Adjustment Type *</Label>
            <Select
              value={adjustmentType}
              onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}
            >
              <SelectTrigger id="adjustment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">
                  <span className="flex items-center gap-2">
                    <ArrowUp className="h-3 w-3 text-emerald-500" />
                    Add Stock
                  </span>
                </SelectItem>
                <SelectItem value="subtract">
                  <span className="flex items-center gap-2">
                    <ArrowDown className="h-3 w-3 text-destructive" />
                    Reduce Stock
                  </span>
                </SelectItem>
                <SelectItem value="set">
                  <span className="flex items-center gap-2">
                    <Replace className="h-3 w-3 text-blue-500" />
                    Set to Amount
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              {adjustmentType === "set" ? "New Quantity" : "Quantity"} *
            </Label>
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
          </div>

          {/* Preview */}
          {parsedQuantity > 0 && (
            <div className="p-3 border rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                {getAdjustmentIcon()}
                <span>Preview Change</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current:</span>
                <span className="font-mono">{currentQuantity.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Change:</span>
                <Badge
                  variant={
                    preview.change > 0
                      ? "default"
                      : preview.change < 0
                        ? "destructive"
                        : "secondary"
                  }
                  className="font-mono"
                >
                  {preview.change > 0 ? "+" : ""}
                  {preview.change.toFixed(2)}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm border-t pt-2">
                <span className="font-medium">New Quantity:</span>
                <span className="font-mono font-bold text-lg">
                  {preview.newQuantity.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Warning for negative stock */}
          {preview.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{preview.error}</AlertDescription>
            </Alert>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Select
              value={reason || undefined}
              onValueChange={(v) => setReason(v as ReasonType)}
            >
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <span>{option.icon}</span>
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details about this adjustment..."
              rows={2}
            />
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={adjustmentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || adjustmentMutation.isPending}
              variant={adjustmentType === "subtract" ? "destructive" : "default"}
            >
              {adjustmentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adjusting...
                </>
              ) : (
                "Adjust Stock"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
